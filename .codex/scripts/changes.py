#!/usr/bin/env python3
"""One review scope: committed since baseline + index + working tree + untracked/deleted."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, timeout=15)
    if result.returncode:
        raise RuntimeError('Git scope could not be read: ' + args[0])
    return result.stdout


def collect(root=ROOT, base=None, scope_paths=None):
    root = Path(root).resolve()
    git(root, 'rev-parse', '--show-toplevel')
    head_result = subprocess.run(['git', '-C', str(root), 'rev-parse', '--verify', 'HEAD'],
                                 capture_output=True, timeout=15)
    unborn = head_result.returncode != 0
    head = (git(root, 'hash-object', '-t', 'tree', '/dev/null') if unborn else head_result.stdout).decode().strip()
    paths = set()
    commands = [('diff', '--cached', '--name-only', '-z'),
                ('diff', '--name-only', '-z'),
                ('ls-files', '--others', '--exclude-standard', '-z')]
    if base:
        git(root, 'rev-parse', '--verify', base + '^{tree}')
        commands.append(('diff', '--name-only', '-z', base, head))
    for args in commands:
        paths.update(p.decode('utf-8', 'surrogateescape') for p in git(root, *args).split(b'\0') if p)
    paths = sorted(p for p in paths if not p.startswith(('.codex/.runtime/', '.codex/node_modules/', '.codex/screenshots/')))
    if scope_paths:
        prefixes = []
        for item in scope_paths:
            path = Path(item)
            if path.is_absolute() or '..' in path.parts or not path.parts:
                raise ValueError('Scope must contain repository-relative paths')
            prefixes.append(path.as_posix().rstrip('/'))
        paths = [p for p in paths if any(p == prefix or p.startswith(prefix + '/') for prefix in prefixes)]
    staged = {p.decode('utf-8', 'surrogateescape') for p in git(root, 'diff', '--cached', '--name-only', '-z').split(b'\0') if p}
    unstaged = {p.decode('utf-8', 'surrogateescape') for p in git(root, 'diff', '--name-only', '-z').split(b'\0') if p}
    untracked = {p.decode('utf-8', 'surrogateescape') for p in git(root, 'ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p}
    conflicts = sorted(staged & (unstaged | untracked) & set(paths))
    # Committing the reviewed tree must not invalidate identical content.
    fingerprint = hashlib.sha256((base or head).encode())
    for name in paths:
        path = root / name
        fingerprint.update(name.encode('utf-8', 'surrogateescape') + b'\0')
        if path.is_symlink():
            fingerprint.update(('symlink:' + str(path.readlink())).encode())
        elif path.is_file():
            fingerprint.update(b'executable' if path.stat().st_mode & 0o111 else b'non-executable')
            fingerprint.update(path.read_bytes())
        else:
            fingerprint.update(b'<deleted>')
        if name in conflicts:
            # An unsafe staged blob cannot hide behind an unchanged working copy.
            fingerprint.update(git(root, 'ls-files', '--stage', '-z', '--', name))
    return {'head': head, 'head_is_unborn': unborn, 'base': base, 'paths': paths, 'revision': fingerprint.hexdigest(),
            'index_worktree_conflicts': conflicts}


def reviewers(paths, level='standard'):
    level = effective_level(paths, level)
    roles = {'code-reviewer', 'security-secrets-scanner'}
    for name in paths:
        path = Path(name)
        suffix = path.suffix.lower()
        if suffix in {'.ts', '.tsx', '.js', '.jsx', '.mjs'}:
            roles.add('typescript-reviewer')
        if suffix in {'.tsx', '.jsx'}:
            roles.update({'react-reviewer', 'design-reviewer'})
        if suffix in {'.css', '.html', '.astro'}:
            roles.add('design-reviewer')
        if suffix == '.prisma' or '/migrations/' in name:
            roles.update({'database-reviewer', 'migration-guard'})
        if name.startswith('.github/') or suffix in {'.sh', '.yml', '.yaml'}:
            roles.add('devops')
        if '/routes/' in name or '/auth' in name:
            roles.update({'security-auth-access', 'security-api-surface'})
        if any(token in name.lower() for token in ['payment', 'checkout', 'bonus', 'risk', 'order.service']):
            roles.update({'security-business-logic', 'qa-engineer'})
    if level == 'critical':
        roles.update({'qa-engineer', 'silent-failure-hunter'})
    return sorted(roles)


def effective_level(paths, requested):
    """A low label cannot remove review of money, auth, deployment or trading risk."""
    if any(any(token in name.lower() for token in
               ['payment', 'checkout', 'bonus', '/auth', '/migrations/', 'schema.prisma',
                'risk.py', 'risk/', '.github/workflows/']) for name in paths):
        return 'critical'
    if requested == 'routine' and any(Path(name).suffix.lower() in
                                     {'.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.sh', '.yml', '.yaml'}
                                     for name in paths):
        return 'standard'
    return requested


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base')
    parser.add_argument('--scope', action='append')
    parser.add_argument('--level', choices=['routine', 'standard', 'critical'], default='standard')
    args = parser.parse_args()
    scope = collect(base=args.base, scope_paths=args.scope)
    scope['reviewers'] = reviewers(scope['paths'], args.level)
    print(json.dumps(scope, ensure_ascii=False, indent=2))
