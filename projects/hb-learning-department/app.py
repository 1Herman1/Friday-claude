"""H&B Learning Department: local, single-student HTTP application."""
import argparse
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

BASE = Path(__file__).resolve().parent
DEFAULT_COURSE = BASE.parents[1] / 'docs/training/hb-learning-department'

class Fault(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code

class App:
    def __init__(self, data_dir=None, course_dir=DEFAULT_COURSE):
        self.data = Path(data_dir or BASE / '.local')
        self.data.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.request_limit = 240
        self.request_buckets = {}
        self.course_dir = Path(course_dir)
        token_file = self.data / 'tokens.json'
        if not token_file.exists():
            fd = os.open(token_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w') as f:
                json.dump({r: secrets.token_urlsafe(32) for r in ('owner', 'student')}, f)
        self.tokens = json.loads(token_file.read_text())
        os.chmod(token_file, 0o600)
        self.dbpath = self.data / 'learning.sqlite3'
        with self.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,role TEXT,text TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP)')
            db.execute('CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY,day INTEGER,operation_id TEXT UNIQUE,explanation TEXT,evidence TEXT,snapshot TEXT,status TEXT DEFAULT "submitted",note TEXT DEFAULT "",created TEXT DEFAULT CURRENT_TIMESTAMP)')
            db.execute('CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,role TEXT,kind TEXT,payload TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP)')
            db.execute('CREATE TABLE IF NOT EXISTS incidents(id INTEGER PRIMARY KEY,code TEXT UNIQUE,count INTEGER DEFAULT 1,status TEXT DEFAULT "new",first_seen TEXT DEFAULT CURRENT_TIMESTAMP,last_seen TEXT DEFAULT CURRENT_TIMESTAMP)')
            db.execute('CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,operation_id TEXT UNIQUE,message_id INTEGER,status TEXT,error TEXT DEFAULT "",created TEXT DEFAULT CURRENT_TIMESTAMP)')
        os.chmod(self.dbpath, 0o600)

    def db(self):
        db = sqlite3.connect(self.dbpath)
        db.row_factory = sqlite3.Row
        return db

    def role(self, auth):
        for role, token in self.tokens.items():
            if hmac.compare_digest(auth, 'Bearer ' + token):
                return role
        raise Fault(401, 'unauthorized')

    @staticmethod
    def text(value, limit=8000):
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise Fault(400, 'invalid_text')
        return value.strip()

    def messages(self):
        with self.db() as db:
            return [dict(x) for x in db.execute('SELECT * FROM messages ORDER BY id DESC LIMIT 500')][::-1]

    def project(self):
        with self.db() as db:
            row = db.execute("SELECT value FROM meta WHERE key='project'").fetchone()
            return json.loads(row[0]) if row else None

    def project_root(self):
        project = self.project()
        if not project:
            raise Fault(409, 'create_project_first')
        root = self.data / 'projects' / project['id']
        if root.is_symlink() or root.parent.is_symlink():
            raise Fault(403, 'unsafe_path')
        return root

    def files(self):
        root = self.project_root()
        result = []
        for directory, dirs, files in os.walk(root, followlinks=False):
            for name in dirs + files:
                if (Path(directory) / name).is_symlink():
                    raise Fault(403, 'unsafe_path')
            result.extend(str((Path(directory) / name).relative_to(root)) for name in files)
        return sorted(result)

    def file(self, path, content=None):
        import re
        if not isinstance(path, str) or len(path) > 180:
            raise Fault(403, 'unsafe_path')
        parts = path.split('/')
        if len(parts) > 8 or any(not re.fullmatch(r'[A-Za-z0-9_А-Яа-яЁё-][A-Za-z0-9_А-Яа-яЁё. -]{0,63}', x) for x in parts):
            raise Fault(403, 'unsafe_path')
        if Path(path).suffix.lower() not in ('.html', '.css', '.js', '.ts', '.tsx', '.json', '.md', '.txt'):
            raise Fault(403, 'file_type_not_allowed')
        root = self.project_root()
        if content is not None:
            if not isinstance(content, str):
                raise Fault(400, 'invalid_content')
            raw = content.encode('utf-8')
            if len(raw) > 128 * 1024:
                raise Fault(413, 'file_too_large')
            files = self.files()
            if path not in files and len(files) >= 64:
                raise Fault(413, 'too_many_files')
            total = sum((root / f).stat().st_size for f in files if f != path)
            if total + len(raw) > 2 * 1024 * 1024:
                raise Fault(413, 'project_too_large')
        fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            for part in parts[:-1]:
                if content is not None:
                    try:
                        os.mkdir(part, mode=0o700, dir_fd=fd)
                    except FileExistsError:
                        pass
                next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd)
                fd = next_fd
            flags = os.O_NOFOLLOW | (os.O_WRONLY | os.O_CREAT | os.O_TRUNC if content is not None else os.O_RDONLY)
            target = os.open(parts[-1], flags, 0o600, dir_fd=fd)
            with os.fdopen(target, 'w' if content is not None else 'r', encoding='utf-8') as f:
                if content is not None:
                    f.write(content)
                    return {'path': path, 'saved': True}
                text = f.read(128 * 1024 + 1)
                if len(text.encode()) > 128 * 1024:
                    raise Fault(413, 'file_too_large')
                return {'path': path, 'content': text}
        except FileNotFoundError:
            raise Fault(404, 'file_not_found')
        except OSError:
            raise Fault(403, 'unsafe_path')
        finally:
            os.close(fd)

    def submissions(self):
        with self.db() as db:
            result = [dict(x) for x in db.execute('SELECT * FROM submissions ORDER BY id')]
        for item in result:
            for key in ('evidence', 'snapshot'):
                item[key] = json.loads(item[key])
        return result

    def state(self, role):
        accepted = sorted({x['day'] for x in self.submissions() if x['status'] == 'accepted'})
        with self.db() as db:
            gate = db.execute("SELECT value FROM meta WHERE key='production'").fetchone()
        production = json.loads(gate[0]) if gate else {'enabled': False, 'scope': ''}
        production['enabled'] = production['enabled'] and accepted == list(range(1, 25))
        return {'role': role, 'project': self.project(), 'accepted_days': accepted,
                'production': production}

    def incident(self, code):
        # Codes come from server constants, never raw user paths or provider exceptions.
        with self.db() as db:
            db.execute('INSERT INTO incidents(code) VALUES(?) ON CONFLICT(code) DO UPDATE SET count=count+1,status="new",last_seen=CURRENT_TIMESTAMP', (code,))

    def incidents(self):
        with self.db() as db:
            return [dict(x) for x in db.execute('SELECT * FROM incidents ORDER BY id DESC')]

    def jobs(self):
        with self.db() as db:
            return [dict(x) for x in db.execute('SELECT * FROM jobs ORDER BY id')]

    def mentor(self, body):
        op = self.text(body.get('operation_id'), 100)
        mid = body.get('message_id')
        message = next((x for x in self.messages() if x['id'] == mid and x['role'] == 'student'), None)
        if not message:
            raise Fault(400, 'student_message_required')
        job = next((x for x in self.jobs() if x['operation_id'] == op), None)
        if not job:
            with self.db() as db:
                db.execute('INSERT INTO jobs(operation_id,message_id,status) VALUES(?,?,"queued")', (op, mid))
        job = next(x for x in self.jobs() if x['operation_id'] == op)
        if job['status'] == 'succeeded':
            return {'job': job}
        if job['status'] == 'failed':
            raise Fault(409, 'owner_retry_required')
        return self.run_mentor(job['id'])

    def run_mentor(self, jid):
        import urllib.request
        import urllib.error
        import urllib.parse
        job = next((x for x in self.jobs() if x['id'] == jid), None)
        if not job:
            raise Fault(404, 'job_not_found')
        if job['status'] == 'succeeded':
            return {'job': job}
        mode = os.environ.get('HB_MENTOR', 'off')
        key = os.environ.get('HB_API_KEY', '')
        url = os.environ.get('HB_API_URL', '')
        model = os.environ.get('HB_MODEL', '')
        if mode != 'openai' or not all((key, url, model)):
            self.incident('provider_off')
            raise Fault(503, 'провайдер не подключен')
        parsed = urllib.parse.urlsplit(url)
        if (parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost'))) or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise Fault(503, 'invalid_provider_config')
        with self.db() as db:
            db.execute('UPDATE jobs SET status="running",error="" WHERE id=?', (jid,))
        conversation = [{'role': 'system', 'content': 'Ты учебный наставник H&B. Помогай по шагам. У тебя нет инструментов и выполненных проверок. Не утверждай, что ты запускал код. Не аттестуй ученика.'}]
        conversation.extend({'role': 'assistant' if x['role'] == 'mentor' else 'user', 'content': x['text']} for x in self.messages() if x['id'] <= job['message_id'])
        payload = json.dumps({'model': model, 'messages': conversation[:1] + conversation[1:][-21:], 'max_tokens': 1200, 'stream': False}).encode()
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                raise ValueError('redirect_rejected')
        request = urllib.request.Request(url.rstrip('/') + '/chat/completions', data=payload, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, method='POST')
        try:
            opener = urllib.request.build_opener(NoRedirect)
            with opener.open(request, timeout=30) as response:
                raw = response.read(128 * 1024 + 1)
            if len(raw) > 128 * 1024:
                raise ValueError('oversized_response')
            content = self.text(json.loads(raw)['choices'][0]['message']['content'], 16000)
            with self.db() as db:
                db.execute('INSERT INTO messages(role,text) VALUES("mentor",?)', (content,))
                db.execute('UPDATE jobs SET status="succeeded",error="" WHERE id=?', (jid,))
        except (OSError, ValueError, KeyError, IndexError, TypeError, Fault, urllib.error.URLError):
            with self.db() as db:
                db.execute('UPDATE jobs SET status="failed",error="provider_request_failed" WHERE id=?', (jid,))
            self.incident('provider_request_failed')
            raise Fault(502, 'provider_request_failed')
        return {'job': next(x for x in self.jobs() if x['id'] == jid)}

    def preview(self, path, css_path=''):
        import html
        from html.parser import HTMLParser
        if not path.endswith('.html') or (css_path and not css_path.endswith('.css')):
            raise Fault(400, 'preview_html_css_only')
        source = self.file(path)['content']
        css = self.file(css_path)['content'] if css_path else ''
        class SafeHTML(HTMLParser):
            tags = set('html head body title style main header footer nav section article aside div span h1 h2 h3 h4 h5 h6 p br hr ul ol li dl dt dd strong em b i small blockquote pre code button label table thead tbody tr th td a img figure figcaption details summary'.split())
            attrs = {'class', 'id', 'style', 'title', 'alt', 'role', 'aria-label', 'lang', 'dir'}
            def __init__(self):
                super().__init__(convert_charrefs=True)
                self.out = []
                self.in_style = False
                self.suppressed = []
            def handle_starttag(self, tag, attrs):
                if tag in {'script', 'iframe', 'object', 'svg', 'math', 'template', 'noscript'}:
                    self.suppressed.append(tag)
                    return
                if self.suppressed or tag not in self.tags:
                    return
                self.in_style = tag == 'style' or self.in_style
                clean = ''.join(' ' + k + '="' + html.escape(v or '', quote=True) + '"' for k, v in attrs if k in self.attrs)
                self.out.append('<' + tag + clean + '>')
            def handle_startendtag(self, tag, attrs):
                self.handle_starttag(tag, attrs)
                self.handle_endtag(tag)
            def handle_endtag(self, tag):
                if self.suppressed:
                    if tag == self.suppressed[-1]:
                        self.suppressed.pop()
                    return
                if tag == 'style':
                    self.in_style = False
                if tag in self.tags:
                    self.out.append('</' + tag + '>')
            def handle_data(self, data):
                if self.suppressed:
                    return
                self.out.append(data.replace('<', '\\3c ') if self.in_style else html.escape(data))
        parser = SafeHTML()
        parser.feed(source)
        csp = "default-src 'none'; script-src 'none'; connect-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
        document = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><style>' + css.replace('<', '\\3c ') + '</style>' + ''.join(parser.out)
        return {'html': document, 'notice': 'Только HTML/CSS. JS preview недоступен в v0.1. Сеть, ссылки, формы и внешние ресурсы отключены.'}

    def material(self, name):
        if name not in ('course.md', 'mentor-and-interface.md'):
            raise Fault(403, 'material_not_allowed')
        file = self.course_dir / name
        if file.is_symlink() or not file.is_file():
            raise Fault(503, 'course_unavailable')
        return file.read_text(encoding='utf-8')

    def course(self):
        import re
        text = self.material('course.md')
        matches = list(re.finditer(r'^#### День (\d{2}) — (.+)$', text, re.M))
        lessons = []
        for i, match in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else text.index('\n## 6.')
            content = re.split(r'\n### Неделя ', text[match.end():end])[0].strip()
            lessons.append({'day': int(match[1]), 'title': match[2], 'text': content})
        if [x['day'] for x in lessons] != list(range(1, 25)):
            raise Fault(503, 'invalid_course')
        return {'lessons': lessons}

    def dispatch(self, role, method, path, body, query):
        if method == 'GET' and path == '/api/preview':
            return self.preview(query.get('path', ['index.html'])[0], query.get('css', [''])[0])
        if method == 'POST' and path == '/api/mentor/retry':
            if role != 'owner':
                raise Fault(403, 'owner_required')
            return self.run_mentor(body.get('id'))
        if method == 'GET' and path == '/api/jobs':
            return {'jobs': self.jobs()}
        if method == 'POST' and path == '/api/mentor':
            return self.mentor(body)
        if path == '/api/incidents':
            if role != 'owner':
                raise Fault(403, 'owner_required')
            if method == 'POST':
                if body.get('status') not in ('new', 'in_progress', 'closed'):
                    raise Fault(400, 'invalid_incident_status')
                with self.db() as db:
                    cursor = db.execute('UPDATE incidents SET status=? WHERE id=?', (body['status'], body.get('id')))
                    if not cursor.rowcount:
                        raise Fault(404, 'incident_not_found')
            return {'incidents': self.incidents()}
        if method == 'POST' and path == '/api/production':
            if role != 'owner':
                raise Fault(403, 'owner_required')
            if type(body.get('enabled')) is not bool:
                raise Fault(400, 'invalid_gate')
            if body['enabled']:
                if self.state(role)['accepted_days'] != list(range(1, 25)):
                    raise Fault(409, '24_accepted_lessons_required')
                if body.get('attested') is not True:
                    raise Fault(400, 'explicit_attestation_required')
                self.text(body.get('scope'), 1000)
            self.text(body.get('note'), 2000)
            gate = {'enabled': body['enabled'], 'scope': body.get('scope', ''), 'note': body['note']}
            with self.db() as db:
                db.execute("INSERT OR REPLACE INTO meta VALUES('production',?)", (json.dumps(gate),))
                db.execute('INSERT INTO events(role,kind,payload) VALUES(?,?,?)', (role, 'production', json.dumps(gate)))
            return self.state(role)
        if path == '/api/submissions':
            if method == 'POST':
                if type(body.get('day')) is not int or not 1 <= body['day'] <= 24:
                    raise Fault(400, 'invalid_day')
                self.text(body.get('explanation'))
                evidence = body.get('evidence')
                if not isinstance(evidence, list) or not 1 <= len(evidence) <= 30:
                    raise Fault(400, 'evidence_required')
                for item in evidence:
                    if not isinstance(item, dict):
                        raise Fault(400, 'invalid_evidence')
                    for key in ('criterion', 'method', 'expected', 'actual'):
                        self.text(item.get(key), 2000)
                    if item.get('result') not in ('passed', 'failed', 'unverified', 'blocked'):
                        raise Fault(400, 'invalid_evidence_result')
                op = self.text(body.get('operation_id'), 100)
                previous = next((x for x in self.submissions() if x['operation_id'] == op), None)
                if previous:
                    return {'submission': previous}
                snapshot = {f: self.file(f)['content'] for f in self.files()}
                if not snapshot:
                    raise Fault(400, 'artifact_required')
                with self.db() as db:
                    cursor = db.execute('INSERT INTO submissions(day,operation_id,explanation,evidence,snapshot) VALUES(?,?,?,?,?)',
                                        (body['day'], body['operation_id'], body['explanation'], json.dumps(body['evidence']), json.dumps(snapshot)))
                    sid = cursor.lastrowid
                return {'submission': next(x for x in self.submissions() if x['id'] == sid)}
            return {'submissions': self.submissions()}
        if method == 'POST' and path == '/api/decision':
            if role != 'owner':
                raise Fault(403, 'owner_required')
            if body.get('decision') not in ('accepted', 'returned'):
                raise Fault(400, 'invalid_decision')
            self.text(body.get('note'), 2000)
            item = next((x for x in self.submissions() if x['id'] == body.get('id')), None)
            if not item:
                raise Fault(404, 'submission_not_found')
            if item['status'] != 'submitted':
                raise Fault(409, 'decision_already_recorded')
            with self.db() as db:
                db.execute('UPDATE submissions SET status=?,note=? WHERE id=?', (body['decision'], body['note'], body['id']))
                db.execute('INSERT INTO events(role,kind,payload) VALUES(?,?,?)', (role, 'decision', json.dumps(body)))
            return {'saved': True}
        if path == '/api/project':
            if method == 'POST':
                if self.project():
                    raise Fault(409, 'project_already_exists')
                project = {'id': secrets.token_hex(12), 'name': self.text(body.get('name'), 100)}
                (self.data / 'projects' / project['id']).mkdir(mode=0o700, parents=True)
                with self.db() as db:
                    db.execute("INSERT INTO meta VALUES('project',?)", (json.dumps(project),))
            return {'project': self.project()}
        if method == 'GET' and path == '/api/files':
            return {'files': self.files()}
        if path == '/api/file':
            if method == 'POST':
                if 'content' not in body or body['content'] is None:
                    raise Fault(400, 'invalid_content')
                return self.file(body.get('path'), body['content'])
            return self.file(query.get('path', [''])[0])
        if path == '/api/messages':
            if method == 'POST':
                text = self.text(body.get('text'))
                with self.db() as db:
                    db.execute('INSERT INTO messages(role,text) VALUES(?,?)', (role, text))
            return {'messages': self.messages()}
        if method == 'GET' and path == '/api/lesson':
            day = query.get('day', [''])[0]
            if day not in [str(i) for i in range(1, 25)]:
                raise Fault(400, 'invalid_day')
            lesson = self.course()['lessons'][int(day) - 1].copy()
            directory = self.course_dir / 'lessons'
            detail = directory / ('day-%02d.md' % int(day))
            if directory.is_symlink() or detail.is_symlink():
                raise Fault(403, 'unsafe_material')
            if detail.is_file():
                if detail.stat().st_size > 256 * 1024:
                    raise Fault(413, 'material_too_large')
                lesson['text'] = detail.read_text(encoding='utf-8')
                lesson['source'] = 'detail'
            else:
                lesson['source'] = 'course'
            return lesson
        if method == 'GET' and path == '/api/course':
            return self.course()
        if method == 'GET' and path == '/api/material':
            return {'text': self.material(query.get('name', [''])[0])}
        if method == 'GET' and path == '/api/state':
            return self.state(role)
        raise Fault(404, 'not_found')


def make_server(app, host='127.0.0.1', port=8765):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log Authorization or paths containing user input.

        def do_GET(self):
            self.handle_request()

        def do_POST(self):
            self.handle_request()

        def handle_request(self):
            try:
                port = self.server.server_port
                hosts = {'127.0.0.1:' + str(port), 'localhost:' + str(port)}
                if self.headers.get('Host') not in hosts:
                    raise Fault(403, 'invalid_host')
                origin = self.headers.get('Origin')
                if origin is not None and origin not in {'http://' + x for x in hosts}:
                    raise Fault(403, 'invalid_origin')
                import time
                authorization = self.headers.get('Authorization', '')
                bucket = 'owner' if hmac.compare_digest(authorization, 'Bearer ' + app.tokens['owner']) else 'student' if hmac.compare_digest(authorization, 'Bearer ' + app.tokens['student']) else 'anonymous'
                with app.lock:
                    minute = int(time.monotonic() // 60)
                    previous_minute, count = app.request_buckets.get(bucket, (minute, 0))
                    count = count + 1 if previous_minute == minute else 1
                    app.request_buckets[bucket] = (minute, count)
                    if count > (app.request_limit if bucket != 'anonymous' else 30):
                        raise Fault(429, 'rate_limited')
                url = urlsplit(self.path)
                public = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
                if self.command == 'GET' and url.path in public:
                    name, mime = public[url.path]
                    return self.respond(200, (BASE / 'static' / name).read_text(encoding='utf-8'), mime)
                role = app.role(authorization)
                if self.command == 'GET' and url.path == '/api/handbook':
                    directory = app.course_dir / 'handbook'
                    file = directory / 'HB-Web-Development-Handbook.pdf'
                    if directory.is_symlink() or file.is_symlink():
                        raise Fault(403, 'unsafe_material')
                    if not file.is_file():
                        raise Fault(503, 'handbook_unavailable')
                    if file.stat().st_size > 10 * 1024 * 1024:
                        raise Fault(413, 'material_too_large')
                    return self.respond(200, file.read_bytes(), 'application/pdf')
                body = {}
                if self.command == 'POST':
                    if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Length') is None:
                        raise Fault(411, 'content_length_required')
                    length = int(self.headers['Content-Length'])
                    if length < 0 or length > 256 * 1024:
                        raise Fault(413, 'body_too_large')
                    self.connection.settimeout(5)
                    raw = self.rfile.read(length)
                    if len(raw) != length:
                        raise Fault(400, 'incomplete_body')
                    body = json.loads(raw or '{}')
                    if not isinstance(body, dict):
                        raise Fault(400, 'json_object_required')
                with app.lock:
                    result = app.dispatch(role, self.command, url.path, body, parse_qs(url.query))
                self.respond(200, result)
            except Fault as e:
                if e.status in (401, 403, 413, 429, 502, 503):
                    app.incident(e.code)
                self.respond(e.status, {'error': e.code})
            except (ValueError, TypeError, KeyError):
                self.respond(400, {'error': 'invalid_request'})

        def respond(self, status, result, mime='application/json'):
            raw = result if isinstance(result, bytes) else (json.dumps(result, ensure_ascii=False) if mime == 'application/json' else result).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', mime + ('; charset=utf-8' if mime.startswith('text/') or mime == 'application/json' else ''))
            if mime == 'application/pdf':
                self.send_header('Content-Disposition', 'attachment; filename="HB-Web-Development-Handbook.pdf"')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)
    return ThreadingHTTPServer((host, port), Handler)


def main():
    parser = argparse.ArgumentParser(description='H&B Learning Department — local learning workspace')
    parser.add_argument('--host', choices=('127.0.0.1', 'localhost'), default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--data-dir', type=Path, default=BASE / '.local')
    parser.add_argument('--course-dir', type=Path, default=DEFAULT_COURSE)
    parser.add_argument('--bootstrap', action='store_true', help='Create local state and tokens, then exit; token values are not printed')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be in range 0..65535')
    app = App(args.data_dir, args.course_dir)
    print('Private access file:', app.data.resolve() / 'tokens.json', flush=True)
    if args.bootstrap:
        print('Local state initialized. No model or Telegram connection was made.', flush=True)
        return
    server = make_server(app, args.host, args.port)
    print('H&B Learning Department: http://127.0.0.1:%s' % server.server_port, flush=True)
    print('Live mentor is off unless an approved server-side provider is configured.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
