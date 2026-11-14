import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch as envpatch
from typing import Any
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT.parents[1] / 'docs/training/hb-learning-department'

class APITest(unittest.TestCase):
    def setUp(self):
        self.environment = envpatch.dict(os.environ, {'HB_MENTOR': 'off', 'HB_API_KEY': '', 'HB_API_URL': '', 'HB_MODEL': ''})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT)
        self.addCleanup(self.tmp.cleanup)
        spec = importlib.util.spec_from_file_location('hb_app', ROOT / 'app.py')
        self.assertTrue((ROOT / 'app.py').exists(), 'Importable app.py is not implemented')
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)
        self.app = self.mod.App(Path(self.tmp.name), COURSE)
        self.server = self.mod.make_server(self.app, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)
        self.base = 'http://127.0.0.1:' + str(self.server.server_port)
        self.tokens = json.loads((Path(self.tmp.name) / 'tokens.json').read_text())

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def req(self, path, data=None, role='student', method=None, headers=None) -> tuple[int, Any, dict]:
        h = {'Content-Type': 'application/json'}
        if role:
            h['Authorization'] = 'Bearer ' + self.tokens.get(role, role)
        h.update(headers or {})
        req = urllib.request.Request(self.base + path, data=None if data is None else json.dumps(data).encode(), headers=h, method=method)
        try:
            r = urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            r = e
        raw = r.read()
        if r.headers.get_content_type() == 'application/pdf':
            return r.status, raw, dict(r.headers)
        try:
            body = json.loads(raw)
        except ValueError:
            body = raw.decode()
        return r.status, body, dict(r.headers)

    def test_course_extracts_exactly_24_days(self):
        status, course, _ = self.req('/api/course')
        self.assertEqual(status, 200)
        self.assertEqual([x['day'] for x in course['lessons']], list(range(1, 25)))
        self.assertIn('Карта системы', course['lessons'][0]['title'])
        self.assertIn('Практика', course['lessons'][23]['text'])
        self.assertEqual(self.req('/api/material?name=mentor-and-interface.md')[0], 200)
        self.assertEqual(self.req('/api/material?name=../../.env')[0], 403)

    def test_dialogue_persists_and_cannot_spoof_author(self):
        self.assertEqual(self.req('/api/messages', {'text': '<script>bad()</script>', 'role': 'owner'})[0], 200)
        messages = self.req('/api/messages')[1]['messages']
        self.assertEqual(messages[-1]['role'], 'student')
        other = self.mod.App(Path(self.tmp.name), COURSE)
        self.assertEqual(other.messages(), messages)

    def test_message_empty_is_rejected(self):
        self.assertEqual(self.req('/api/messages', {'text': ' '})[0], 400)

    def test_message_length_limit(self):
        self.assertEqual(self.req('/api/messages', {'text': 'a' * 8001})[0], 400)

    def project(self):
        return self.req('/api/project', {'name': 'FORMA · учебный проект'})

    def put(self, path='index.html', content='<h1>FORMA</h1>'):
        return self.req('/api/file', {'path': path, 'content': content})

    def test_project_create_and_file_roundtrip(self):
        self.assertEqual(self.project()[0], 200)
        self.assertEqual(self.put('pages/index.html')[0], 200)
        self.assertEqual(self.put('pages/index.html', '<h1>Изменено</h1>')[0], 200)
        self.assertEqual(self.req('/api/file?path=pages/index.html')[1]['content'], '<h1>Изменено</h1>')
        self.assertEqual(self.req('/api/files')[1]['files'], ['pages/index.html'])
        other = self.mod.App(Path(self.tmp.name), COURSE)
        self.assertEqual(other.project()['name'], 'FORMA · учебный проект')

    def test_file_before_project_rejected(self):
        self.assertEqual(self.put()[0], 409)

    def test_duplicate_project_does_not_replace_files(self):
        self.project()
        self.put()
        self.assertEqual(self.project()[0], 409)
        self.assertEqual(self.req('/api/file?path=index.html')[0], 200)

    def test_paths_reject_traversal_absolute_and_special_files(self):
        self.project()
        for path in ('../escape.html', '/etc/passwd', 'a/../../x.html', 'a//b.html', './index.html', '.env', 'a\\b.html', '%2e%2e/x.html', 'bad<script>.html'):
            with self.subTest(path=path):
                self.assertEqual(self.put(path)[0], 403)

    def test_symlink_file_and_directory_rejected(self):
        self.assertEqual(self.project()[0], 200)
        root = self.app.project_root()
        outside = Path(self.tmp.name) / 'control.html'
        outside.write_text('secret')
        (root / 'link.html').symlink_to(outside)
        (root / 'dir').symlink_to(outside.parent, target_is_directory=True)
        self.assertEqual(self.req('/api/file?path=link.html')[0], 403)
        self.assertEqual(self.put('dir/control.html')[0], 403)
        self.assertEqual(outside.read_text(), 'secret')

    def test_file_size_and_count_limits(self):
        self.project()
        self.assertEqual(self.put(content='a' * (128 * 1024 + 1))[0], 413)
        for i in range(64):
            self.assertEqual(self.put(str(i) + '.txt', 'a')[0], 200)
        self.assertEqual(self.put('overflow.txt', 'a')[0], 413)

    def submission(self, day=1, op='submit-1'):
        return {'day': day, 'operation_id': op, 'explanation': 'Проверил сам и могу объяснить.',
                'evidence': [{'criterion': 'D01-C1', 'method': 'Ручная проверка', 'expected': 'Заголовок FORMA', 'actual': 'Заголовок FORMA', 'result': 'passed'}]}

    def test_submission_snapshot_and_owner_decision(self):
        self.project()
        self.put()
        status, item, _ = self.req('/api/submissions', self.submission())
        self.assertEqual(status, 200)
        self.assertEqual(item['submission']['snapshot']['index.html'], '<h1>FORMA</h1>')
        self.put(content='Changed later')
        sid = item['submission']['id']
        self.assertEqual(self.req('/api/decision', {'id': sid, 'decision': 'accepted', 'note': 'Проверено'}, role='owner')[0], 200)
        state = self.req('/api/state')[1]
        self.assertEqual(state['accepted_days'], [1])
        self.assertFalse(state['production']['enabled'])
        other = self.mod.App(Path(self.tmp.name), COURSE)
        self.assertEqual(other.submissions()[0]['status'], 'accepted')
        self.assertEqual(other.submissions()[0]['snapshot']['index.html'], '<h1>FORMA</h1>')

    def test_student_cannot_decide_even_with_owner_role_in_body(self):
        self.project()
        self.put()
        sid = self.req('/api/submissions', self.submission())[1]['submission']['id']
        self.assertEqual(self.req('/api/decision', {'id': sid, 'decision': 'accepted', 'note': 'fake', 'role': 'owner'})[0], 403)
        self.assertEqual(self.req('/api/state')[1]['accepted_days'], [])

    def test_submission_requires_evidence_and_explanation(self):
        self.project()
        self.put()
        data = self.submission()
        data['evidence'] = []
        self.assertEqual(self.req('/api/submissions', data)[0], 400)
        data = self.submission()
        data['explanation'] = ''
        self.assertEqual(self.req('/api/submissions', data)[0], 400)
        data = self.submission()
        data['evidence'][0]['actual'] = ''
        self.assertEqual(self.req('/api/submissions', data)[0], 400)

    def test_submission_rejects_invalid_days(self):
        self.project()
        self.put()
        for day in (0, 25, -1, '1', True, 1.5):
            with self.subTest(day=day):
                self.assertEqual(self.req('/api/submissions', self.submission(day))[0], 400)

    def test_submission_retry_is_idempotent(self):
        self.project()
        self.put()
        first = self.req('/api/submissions', self.submission())
        retry = self.req('/api/submissions', self.submission())
        self.assertEqual(retry[0], 200)
        self.assertEqual(first[1]['submission']['id'], retry[1]['submission']['id'])
        self.assertEqual(len(self.req('/api/submissions')[1]['submissions']), 1)

    def test_owner_decision_validated_and_immutable(self):
        self.project()
        self.put()
        sid = self.req('/api/submissions', self.submission())[1]['submission']['id']
        self.assertEqual(self.req('/api/decision', {'id': sid, 'decision': 'whatever', 'note': 'x'}, role='owner')[0], 400)
        self.assertEqual(self.req('/api/decision', {'id': 999, 'decision': 'accepted', 'note': 'x'}, role='owner')[0], 404)
        data = {'id': sid, 'decision': 'returned', 'note': 'Доработать'}
        self.assertEqual(self.req('/api/decision', data, role='owner')[0], 200)
        data['decision'] = 'accepted'
        self.assertEqual(self.req('/api/decision', data, role='owner')[0], 409)

    def test_submission_requires_nonempty_artifact(self):
        self.project()
        self.assertEqual(self.req('/api/submissions', self.submission())[0], 400)

    def test_lesson_fixed_day_detail_fallback_without_path_input(self):
        fixture = Path(self.tmp.name) / 'materials'
        fixture.mkdir()
        (fixture / 'course.md').write_text((COURSE / 'course.md').read_text())
        self.app.course_dir = fixture
        self.assertEqual(self.req('/api/lesson?day=1')[0], 200)
        self.assertIn('Мини-урок', self.req('/api/lesson?day=1')[1]['text'])
        for day in ('../course.md', '/etc/passwd', '01/../../x', '25', '0'):
            self.assertEqual(self.req('/api/lesson?day=' + day)[0], 400)
        (fixture / 'lessons').mkdir()
        (fixture / 'lessons' / 'day-01.md').write_text('# Подробный день 1')
        self.app.course_dir = fixture
        self.assertEqual(self.req('/api/lesson?day=1')[1]['text'], '# Подробный день 1')
        self.assertIn('Мини-урок', self.req('/api/lesson?day=2')[1]['text'])

    def test_production_requires_24_acceptances_and_explicit_owner_attestation(self):
        self.project()
        self.put()
        data = {'enabled': True, 'attested': True, 'scope': 'Только локальный прототип', 'note': 'Защита проверена'}
        self.assertEqual(self.req('/api/production', data)[0], 403)
        self.assertEqual(self.req('/api/production', data, role='owner')[0], 409)
        for day in range(1, 25):
            sid = self.req('/api/submissions', self.submission(day, 'day-' + str(day)))[1]['submission']['id']
            self.assertEqual(self.req('/api/decision', {'id': sid, 'decision': 'accepted', 'note': 'Защита проверена'}, role='owner')[0], 200)
        self.assertFalse(self.req('/api/state')[1]['production']['enabled'])
        data['attested'] = False
        self.assertEqual(self.req('/api/production', data, role='owner')[0], 400)
        data['attested'] = True
        self.assertEqual(self.req('/api/production', data, role='owner')[0], 200)
        self.assertTrue(self.req('/api/state')[1]['production']['enabled'])
        other = self.mod.App(Path(self.tmp.name), COURSE)
        self.assertTrue(other.state('student')['production']['enabled'])
        data['enabled'] = False
        self.assertEqual(self.req('/api/production', data, role='owner')[0], 200)
        self.assertFalse(self.req('/api/state')[1]['production']['enabled'])
        with self.app.db() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events WHERE kind='production'").fetchone()[0], 2)

    def test_incident_dedup_redaction_and_owner_inbox(self):
        self.project()
        for _ in range(3):
            self.assertEqual(self.put('../SECRET-MARKER.html')[0], 403)
        status, data, _ = self.req('/api/incidents', role='owner')
        self.assertEqual(status, 200)
        self.assertEqual(len(data['incidents']), 1)
        item = data['incidents'][0]
        self.assertEqual(item['count'], 3)
        self.assertNotIn('SECRET-MARKER', json.dumps(data))
        self.assertEqual(self.req('/api/incidents')[0], 403)
        self.assertEqual(self.req('/api/incidents', {'id': item['id'], 'status': 'closed'}, role='owner')[0], 200)
        self.assertEqual(next(x for x in self.req('/api/incidents', role='owner')[1]['incidents'] if x['id'] == item['id'])['status'], 'closed')
        other = self.mod.App(Path(self.tmp.name), COURSE)
        self.assertTrue(other.incidents())

    def test_provider_absence_has_durable_queue_and_no_fake_answer(self):
        self.req('/api/messages', {'text': 'Помоги с заданием'})
        mid = self.req('/api/messages')[1]['messages'][-1]['id']
        status, result, _ = self.req('/api/mentor', {'message_id': mid, 'operation_id': 'mentor-1'})
        self.assertEqual(status, 503)
        self.assertEqual(result['error'], 'провайдер не подключен')
        jobs = self.req('/api/jobs')[1]['jobs']
        self.assertEqual(jobs[0]['status'], 'queued')
        self.assertEqual(len(self.req('/api/messages')[1]['messages']), 1)
        self.req('/api/mentor', {'message_id': mid, 'operation_id': 'mentor-1'})
        self.assertEqual(len(self.req('/api/jobs')[1]['jobs']), 1)
        self.assertEqual(self.mod.App(Path(self.tmp.name), COURSE).jobs()[0]['status'], 'queued')
        self.assertIn('provider_off', str(self.req('/api/incidents', role='owner')[1]))

    def test_long_conversation_keeps_system_safety_instruction(self):
        received = []
        class Upstream(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                received.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
                self.send_response(503)
                self.end_headers()
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        try:
            with self.app.db() as db:
                db.executemany('INSERT INTO messages(role,text) VALUES("student",?)', [('Учебный вопрос ' + str(i),) for i in range(25)])
            mid = self.req('/api/messages')[1]['messages'][-1]['id']
            with envpatch.dict(os.environ, {'HB_MENTOR':'openai', 'HB_API_KEY':'TEST-ONLY', 'HB_API_URL':'http://127.0.0.1:' + str(upstream.server_port) + '/v1', 'HB_MODEL':'test-only'}):
                self.assertEqual(self.req('/api/mentor', {'message_id':mid, 'operation_id':'long-context'})[0], 502)
            self.assertEqual(received[0]['messages'][0]['role'], 'system')
            self.assertIn('нет инструментов', received[0]['messages'][0]['content'])
            self.assertLessEqual(len(received[0]['messages']), 22)
        finally:
            upstream.shutdown()
            upstream.server_close()
            thread.join()

    def test_configured_provider_http_failure_is_redacted_and_retryable(self):
        class UpstreamFailure(BaseHTTPRequestHandler):
            def do_POST(handler):
                handler.send_response(500)
                handler.end_headers()
                handler.wfile.write(b'UPSTREAM-SECRET-MARKER')
            def log_message(handler, *args):
                pass
        upstream = ThreadingHTTPServer(('127.0.0.1', 0), UpstreamFailure)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        try:
            os.environ.update({'HB_MENTOR': 'openai', 'HB_API_KEY': 'TEST-NOT-REAL', 'HB_API_URL': 'http://127.0.0.1:' + str(upstream.server_port) + '/v1', 'HB_MODEL': 'protocol-test'})
            self.req('/api/messages', {'text': 'Question'})
            mid = self.req('/api/messages')[1]['messages'][-1]['id']
            self.assertEqual(self.req('/api/mentor', {'message_id': mid, 'operation_id': 'bad-upstream'})[0], 502)
            jobs = self.req('/api/jobs')[1]['jobs']
            self.assertEqual(jobs[0]['status'], 'failed')
            self.assertNotIn('UPSTREAM-SECRET', json.dumps(jobs))
            self.assertNotIn('TEST-NOT-REAL', json.dumps(self.req('/api/state')[1]))
            self.assertEqual(self.req('/api/mentor/retry', {'id': jobs[0]['id']})[0], 403)
            self.assertEqual(self.req('/api/mentor/retry', {'id': jobs[0]['id']}, role='owner')[0], 502)
            self.assertEqual(len(self.req('/api/messages')[1]['messages']), 1)
        finally:
            upstream.shutdown()
            upstream.server_close()
            thread.join()

    def test_preview_is_html_css_only_and_cannot_navigate_or_script(self):
        self.project()
        self.put(content='<h1 onclick="alert(1)">FORMA</h1><script>parent.alert(1)</script><iframe src="https://example.com"></iframe><a href="https://example.com">link</a><meta http-equiv="refresh" content="0;url=https://example.com"><link rel="stylesheet" href="https://example.com/a.css">')
        self.put('style.css', 'h1 {color: rebeccapurple}')
        status, result, _ = self.req('/api/preview?path=index.html&css=style.css')
        self.assertEqual(status, 200)
        rendered = result['html']
        self.assertIn("default-src 'none'", rendered)
        self.assertIn("connect-src 'none'", rendered)
        self.assertIn('rebeccapurple', rendered)
        for marker in ('<script', 'onclick=', 'href=', '<iframe', 'http-equiv="refresh"', 'parent.alert(1)'):
            self.assertNotIn(marker, rendered)
        self.assertIn('JS preview недоступен', result['notice'])
        self.put('app.js', 'alert(1)')
        self.assertEqual(self.req('/api/preview?path=app.js')[0], 400)

    def test_foreign_origin_and_dns_rebinding_rejected(self):
        self.assertEqual(self.req('/api/messages', {'text': 'bad'}, headers={'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.req('/api/state', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.req('/api/state', headers={'Origin': self.base})[0], 200)

    def test_request_body_limit(self):
        self.assertEqual(self.req('/api/messages', {'text': 'a' * (256 * 1024)})[0], 413)

    def test_request_rate_limit(self):
        self.app.request_limit = 2
        self.assertEqual(self.req('/api/state')[0], 200)
        self.assertEqual(self.req('/api/state')[0], 200)
        self.assertEqual(self.req('/api/state')[0], 429)

    def test_handbook_pdf_is_authenticated_and_fixed_path(self):
        self.assertEqual(self.req('/api/handbook', role=None)[0], 401)
        status, content, headers = self.req('/api/handbook')
        self.assertEqual(status, 200)
        self.assertTrue(content.startswith(b'%PDF-'))
        self.assertEqual(headers['Content-Type'], 'application/pdf')
        self.assertEqual(self.req('/api/handbook?path=../../.env')[1], content)

    def test_cli_explains_local_start_without_printing_tokens(self):
        import subprocess
        import sys
        process = subprocess.run([sys.executable, str(ROOT / 'app.py'), '--help'], capture_output=True, text=True)
        self.assertEqual(process.returncode, 0)
        self.assertIn('--data-dir', process.stdout)
        self.assertIn('--port', process.stdout)
        self.assertNotIn(self.tokens['owner'], process.stdout)

    def test_public_ui_has_no_secrets_and_preview_sandbox(self):
        status, page, headers = self.req('/', role=None)
        self.assertEqual(status, 200)
        self.assertIn('sandbox=""', page)
        self.assertIn('H&B', page)
        self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
        for path in ('/app.js', '/style.css'):
            self.assertEqual(self.req(path, role=None)[0], 200)
        for token in self.tokens.values():
            self.assertNotIn(token, page)
        for path in ('/.local/tokens.json', '/app.py', '/api/config', '/../../.env'):
            self.assertNotEqual(self.req(path, role=None)[0], 200)
        self.assertNotIn(self.tokens['owner'], json.dumps(self.req('/api/state')[1]))

    def test_bootstrap_auth_roles(self):
        self.assertEqual(self.req('/api/state', role=None)[0], 401)
        self.assertEqual(self.req('/api/state', role='wrong')[0], 401)
        self.assertEqual(self.req('/api/state')[1]['role'], 'student')
        self.assertEqual(self.req('/api/state', role='owner')[1]['role'], 'owner')
        self.assertNotEqual(self.tokens['owner'], self.tokens['student'])
        self.assertEqual(os.stat(Path(self.tmp.name) / 'tokens.json').st_mode & 0o777, 0o600)
