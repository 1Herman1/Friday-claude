#!/usr/bin/env python3
"""Evidence gate for the autonomous review loop. Executes no model, shell task or deployment."""
import argparse
import fcntl
import hashlib
import json
import os
import re
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

from changes import ROOT, collect, reviewers, effective_level


def safe_task_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', value):
        raise ValueError('Task id must contain only letters, numbers, _ or -')
    return value


def runtime(root):
    path = Path(root) / '.codex/.runtime'
    path.mkdir(parents=True, exist_ok=True)
    return path


def save(path, value):
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.task-')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


@contextmanager
def locked(root):
    with (runtime(root) / 'task-gate.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def create(root, task_id, level, criteria, required_checks, implementer, owner_session=None, scope_paths=None):
    if not criteria or not implementer.strip() or not required_checks or not owner_session:
        raise ValueError('Criteria, implementer, owner session and required checks are mandatory')
    path = runtime(root) / 'tasks' / (safe_task_id(task_id) + '.json')
    if path.exists():
        raise ValueError('Task already exists; resume it instead of resetting evidence')
    path.parent.mkdir(exist_ok=True)
    scope = collect(root)
    task = {'id': task_id, 'level': level, 'base': scope['head'], 'implementer': implementer,
            'scope': scope_paths,
            'owner_session': owner_session, 'status': 'active', 'criteria': criteria,
            'required_checks': sorted(set(required_checks)), 'evidence': {}, 'checks': {}, 'reviews': {},
            'blocker': None}
    active = active_path(root, owner_session)
    if active.exists():
        previous = json.loads(active.read_text())['task_id']
        previous_task = json.loads((runtime(root) / 'tasks' / (safe_task_id(previous) + '.json')).read_text())
        if previous_task['status'] == 'active':
            raise ValueError('Finish or explicitly block the existing task before starting another')
    save(path, task)
    save(active, {'task_id': task_id})
    return task


def evaluate(task, scope):
    reasons = []
    if scope.get('index_worktree_conflicts'):
        reasons.append('Index and working tree contain different versions; align before approval: ' +
                       ', '.join(scope['index_worktree_conflicts']))
    revision = scope['revision']
    for name in task['criteria']:
        row = task['evidence'].get(name, {})
        if row.get('revision') != revision or not row.get('evidence'):
            reasons.append('Criterion lacks current evidence: ' + name)
    for name in task['required_checks']:
        row = task['checks'].get(name, {})
        if row.get('revision') != revision or row.get('status') != 'pass' or not row.get('evidence'):
            reasons.append('Required check is not a current pass: ' + name)
    level = effective_level(scope['paths'], task['level'])
    needed = reviewers(scope['paths'], level)
    for role in needed:
        row = task['reviews'].get(role, {})
        if (row.get('revision') != revision or row.get('status') != 'pass' or row.get('findings')
                or not row.get('reviewer') or row.get('reviewer') == task['implementer']
                or not row.get('evidence')):
            reasons.append('Independent review is missing, stale or has findings: ' + role)
    return {'ready': not reasons, 'revision': revision, 'level': level, 'reviewers': needed, 'reasons': reasons}


def mutate(root, task, operation, name, status, evidence, reviewer=None, findings=None):
    scope = collect(root, task['base'], task.get('scope'))
    if operation == 'criterion':
        if name not in task['criteria']:
            raise ValueError('Unknown criterion')
        task['evidence'][name] = {'revision': scope['revision'], 'evidence': evidence}
    elif operation == 'check':
        if name not in task['required_checks']:
            raise ValueError('Unknown check')
        task['checks'][name] = {'revision': scope['revision'], 'status': status, 'evidence': evidence}
    elif operation == 'review':
        if not isinstance(reviewer, str) or not reviewer.strip() or reviewer.strip() == task['implementer'].strip():
            raise ValueError('A separate reviewer identity is required')
        task['reviews'][name] = {'revision': scope['revision'], 'status': status, 'evidence': evidence,
                                 'reviewer': reviewer.strip(), 'findings': findings or []}
    else:
        raise ValueError('Unknown operation')
    task['status'] = 'active'
    task['blocker'] = None
    return task


def active_path(root, session_id):
    folder = runtime(root) / 'active-tasks'
    folder.mkdir(exist_ok=True)
    key = hashlib.sha256(str(session_id).encode()).hexdigest()
    return folder / (key + '.json')


def stop(root, payload):
    # Subagents must finish their own assigned scope; only the task owner runs the global loop.
    if payload.get('agent_id') or payload.get('agent_type'):
        return {}
    if not payload.get('session_id'):
        return {}
    active = active_path(root, payload['session_id'])
    if not active.exists():
        return {}
    task_id = safe_task_id(json.loads(active.read_text())['task_id'])
    task = json.loads((runtime(root) / 'tasks' / (task_id + '.json')).read_text())
    if task.get('owner_session') and payload.get('session_id') != task['owner_session']:
        return {}
    if task['status'] == 'blocked':
        return {}
    result = evaluate(task, collect(root, task['base'], task.get('scope')))
    if result['ready']:
        return {}
    return {'decision': 'block', 'reason': 'Задача не соответствует ТЗ. Исправь дефекты и повтори ревью '
            'на текущей ревизии. Если нужен внешний доступ или решение Гермеса, запиши явный блокер '
            'через task_gate.py blocked.\n' + '\n'.join(result['reasons'])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['init', 'criterion', 'check', 'review', 'status', 'complete', 'blocked', 'stop', 'session'])
    parser.add_argument('--task')
    parser.add_argument('--level', choices=['routine', 'standard', 'critical'], default='standard')
    parser.add_argument('--criterion', action='append', default=[])
    parser.add_argument('--required-check', action='append', default=[])
    parser.add_argument('--implementer', default='')
    parser.add_argument('--owner-session')
    parser.add_argument('--scope', action='append')
    parser.add_argument('--name')
    parser.add_argument('--status', choices=['pass', 'fail', 'skip'], default='pass')
    parser.add_argument('--evidence', default='')
    parser.add_argument('--reviewer')
    parser.add_argument('--finding', action='append', default=[])
    args = parser.parse_args()
    if args.action == 'session':
        payload = json.load(sys.stdin)
        session = payload.get('session_id')
        text = ('ID текущей сессии для task_gate.py --owner-session: ' + str(session) +
                '. Для задачи с изменениями инициализируй task gate по .codex/workflows/review-loop.md.')
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': text}}, ensure_ascii=False))
        return
    if args.action == 'stop':
        with locked(ROOT):
            print(json.dumps(stop(ROOT, json.load(sys.stdin)), ensure_ascii=False))
        return
    with locked(ROOT):
        if args.action == 'init':
            result = create(ROOT, args.task, args.level, args.criterion, args.required_check, args.implementer, args.owner_session, args.scope)
        else:
            path = runtime(ROOT) / 'tasks' / (safe_task_id(args.task) + '.json')
            task = json.loads(path.read_text())
            if args.action in {'criterion', 'check', 'review'}:
                if not args.name or not args.evidence.strip():
                    raise ValueError('Name and evidence are mandatory')
                result = mutate(ROOT, task, args.action, args.name, args.status, args.evidence, args.reviewer, args.finding)
                save(path, task)
            else:
                result = evaluate(task, collect(ROOT, task['base'], task.get('scope')))
                if args.action == 'complete':
                    if not result['ready']:
                        print(json.dumps(result, ensure_ascii=False, indent=2))
                        raise SystemExit(1)
                    task['status'] = 'complete'
                    save(path, task)
                elif args.action == 'blocked':
                    if not args.evidence.strip():
                        raise ValueError('Describe the actual external blocker')
                    task['status'], task['blocker'] = 'blocked', args.evidence
                    save(path, task)
                    result['blocked'] = args.evidence
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
