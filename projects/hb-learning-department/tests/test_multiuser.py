"""HTTP-level acceptance checks for independent employees and lesson sequencing."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import urllib.parse
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT.parents[1] / 'docs/training/hb-learning-department'

class MultiUserTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'HB_MENTOR':'off','HB_API_KEY':'','HB_API_URL':'','HB_MODEL':''})
        self.env.start(); self.addCleanup(self.env.stop)
        self.tmp = tempfile.TemporaryDirectory(prefix='hb-profiles-', dir=os.environ.get('TMPDIR'))
        self.addCleanup(self.tmp.cleanup)
        spec = importlib.util.spec_from_file_location('hb_multi_app', ROOT/'app.py')
        assert spec is not None and spec.loader is not None
        self.mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.mod)
        self.assertTrue(hasattr(self.mod, 'LearningHub'), 'Named, isolated student hub is not implemented')
        self.hub = self.mod.LearningHub(Path(self.tmp.name), COURSE)
        self.tokens = {'owner':self.hub.tokens['owner'], **{sid:app.tokens['student'] for sid,app in self.hub.workspaces.items()}}
        self.server = self.mod.make_server(self.hub, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        self.addCleanup(self.stop)
        self.base = 'http://127.0.0.1:' + str(self.server.server_port)

    def stop(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()

    def req(self, path, body=None, who='test', selected=None):
        headers = {'Content-Type':'application/json','Authorization':'Bearer '+self.tokens[who]}
        if selected is not None: headers['X-Student-ID'] = selected
        request = urllib.request.Request(self.base+path, headers=headers, data=None if body is None else json.dumps(body).encode())
        try: response = urllib.request.urlopen(request)
        except urllib.error.HTTPError as error: response = error
        return response.status, json.loads(response.read())

    def project(self, who='test', content='<h1>TEST</h1>'):
        self.assertEqual(self.req('/api/project', {'name':'Учебный проект '+who},who)[0],200)
        self.assertEqual(self.req('/api/file', {'path':'index.html','content':content},who)[0],200)

    def submit(self, day=1, who='test'):
        return self.req('/api/submissions', {'day':day,'operation_id':'day-'+str(day), 'explanation':'Объяснение ученика',
            'evidence':[{'criterion':'C1','method':'Ручной прогон','expected':'Ожидание','actual':'Наблюдение','result':'passed'}]},who)

    def test_named_accounts_and_owner_roster(self):
        status, result = self.req('/api/students', who='owner')
        self.assertEqual(status,200)
        self.assertEqual([(x['id'],x['name']) for x in result['students']], [('test','Тест'),('matvey','Матвей')])
        self.assertEqual(self.req('/api/state',who='matvey')[1]['student']['name'],'Матвей')
        self.assertNotEqual(self.tokens['test'],self.tokens['matvey'])
        for token in self.tokens.values(): self.assertNotIn(token,json.dumps(result))

    def test_lesson_two_requires_acceptance_of_lesson_one(self):
        self.project()
        self.assertEqual(self.req('/api/lesson?day=2')[0],403)
        self.assertEqual(self.submit(2)[0],403)
        status, submitted = self.submit()
        self.assertEqual(status,200)
        self.assertEqual(self.req('/api/lesson?day=2')[0],403)
        self.assertEqual(self.req('/api/decision', {'id':submitted['submission']['id'],'decision':'accepted','note':'Проверка куратора'},'owner','test')[0],200)
        self.assertEqual(self.req('/api/lesson?day=2')[0],200)
        self.assertEqual(self.req('/api/state')[1]['current_day'],2)
        self.assertEqual(self.req('/api/state',who='matvey')[1]['current_day'],1)
        self.assertEqual(self.req('/api/lesson?day=2',who='matvey')[0],403)

    def test_messages_are_scoped_and_body_cannot_spoof_student(self):
        self.assertEqual(self.req('/api/messages',{'text':'ONLY-TEST','role':'owner','student_id':'matvey'})[0],200)
        self.assertEqual(self.req('/api/messages',who='matvey')[1]['messages'],[])
        self.req('/api/messages',{'text':'ONLY-MATVEY'},'matvey')
        test=self.req('/api/messages',who='owner',selected='test')[1]['messages']
        matvey=self.req('/api/messages',who='owner',selected='matvey')[1]['messages']
        self.assertEqual([x['text'] for x in test],['ONLY-TEST'])
        self.assertEqual(test[0]['role'],'student')
        self.assertEqual([x['text'] for x in matvey],['ONLY-MATVEY'])
        roster=self.req('/api/students',who='matvey')[1]['students']
        self.assertEqual([x['id'] for x in roster],['matvey'])

    def test_files_and_submissions_are_scoped(self):
        self.project(content='<h1>ONLY-TEST</h1>')
        self.project('matvey','<h1>ONLY-MATVEY</h1>')
        self.assertEqual(self.req('/api/file?path=index.html')[1]['content'],'<h1>ONLY-TEST</h1>')
        self.assertEqual(self.req('/api/file?path=index.html',who='matvey')[1]['content'],'<h1>ONLY-MATVEY</h1>')
        self.assertEqual(self.req('/api/files',who='matvey',selected='test')[0],403)
        self.assertEqual(self.req('/api/file?path=index.html&student_id=matvey')[1]['content'],'<h1>ONLY-TEST</h1>')
        self.assertEqual(self.submit()[0],200)
        self.assertEqual(self.req('/api/submissions',who='matvey')[1]['submissions'],[])
        self.assertEqual(self.req('/api/decision',{'id':1,'decision':'accepted','note':'Чужая работа','role':'owner'},'matvey')[0],403)
        self.assertEqual(self.req('/api/state')[1]['accepted_days'],[])

    def test_owner_selection_and_path_names_cannot_create_arbitrary_workspace(self):
        self.assertEqual(self.req('/api/state',who='owner',selected='matvey')[1]['student']['id'],'matvey')
        for sid in ['unknown','../outside','/etc/passwd']:
            self.assertEqual(self.req('/api/state',who='owner',selected=sid)[0],404)
        self.assertEqual(self.req('/api/state',who='matvey',selected='test')[0],403)
        self.assertEqual(self.req('/api/state',who='test',selected='matvey')[0],403)

    def test_repository_and_credentials_are_not_exposed(self):
        self.project('matvey')
        for path in ['../tokens.json','../../app.py','/etc/passwd','.env','.git/config','../../../../.hermes/auth.json']:
            self.assertEqual(self.req('/api/file?path='+urllib.parse.quote(path),who='matvey')[0],403)
            self.assertEqual(self.req('/api/file',{'path':path,'content':'forbidden'},'matvey')[0],403)
        self.assertEqual(self.req('/api/material?name=../../.env',who='matvey')[0],403)
        self.assertEqual(self.req('/api/incidents',who='matvey')[0],403)

    def test_queue_is_private_without_claiming_a_model_answer(self):
        for who in ['test','matvey']:
            self.req('/api/messages',{'text':'PRIVATE-'+who},who)
            status,result=self.req('/api/mentor',{'message_id':1,'operation_id':'same-operation'},who)
            self.assertEqual(status,503)
            self.assertEqual(result['error'],'провайдер не подключен')
            self.assertEqual(len(self.req('/api/jobs',who=who)[1]['jobs']),1)
            self.assertEqual(len(self.req('/api/messages',who=who)[1]['messages']),1)
        self.assertEqual(self.req('/api/jobs',who='matvey',selected='test')[0],403)

    def test_profiles_and_credentials_survive_recreation(self):
        self.project('matvey','PERSISTENT-MATVEY')
        self.req('/api/messages',{'text':'Сохранённый диалог'},'matvey')
        restored=self.mod.LearningHub(Path(self.tmp.name),COURSE)
        self.assertEqual(restored.workspaces['matvey'].file('index.html')['content'],'PERSISTENT-MATVEY')
        self.assertEqual(restored.workspaces['matvey'].messages()[0]['text'],'Сохранённый диалог')
        self.assertIsNone(restored.workspaces['test'].project())
        self.assertEqual(restored.workspaces['matvey'].tokens['student'],self.tokens['matvey'])
        self.assertEqual(restored.tokens['owner'],self.tokens['owner'])

    def test_full_course_and_production_are_independent(self):
        self.project()
        gate={'enabled':True,'attested':True,'scope':'Только контрольный локальный прогон','note':'Проверка тестового профиля'}
        self.assertEqual(self.req('/api/production',gate,'owner','test')[0],409)
        for day in range(1,25):
            status,item=self.submit(day)
            self.assertEqual(status,200)
            self.assertEqual(self.req('/api/decision',{'id':item['submission']['id'],'decision':'accepted','note':'Контрольный прогон'},'owner','test')[0],200)
        self.assertEqual(self.req('/api/state')[1]['accepted_days'],list(range(1,25)))
        self.assertFalse(self.req('/api/state')[1]['production']['enabled'])
        self.assertEqual(self.req('/api/production',gate,'owner','test')[0],200)
        self.assertTrue(self.req('/api/state')[1]['production']['enabled'])
        self.assertFalse(self.req('/api/state',who='matvey')[1]['production']['enabled'])
        self.assertEqual(self.req('/api/state',who='matvey')[1]['current_day'],1)
        self.assertEqual(self.req('/api/production',{**gate,'role':'owner'},'matvey')[0],403)

    def test_authenticated_incidents_belong_to_the_correct_student(self):
        self.project('matvey')
        self.assertEqual(self.req('/api/file',{'path':'../forbidden.html','content':'blocked'},'matvey')[0],403)
        matvey=self.req('/api/incidents',who='owner',selected='matvey')[1]['incidents']
        test=self.req('/api/incidents',who='owner',selected='test')[1]['incidents']
        self.assertEqual([x['code'] for x in matvey],['unsafe_path'])
        self.assertEqual(test,[])

    def test_private_access_files_contain_only_their_own_credential(self):
        access=Path(self.tmp.name)/'access'
        for sid in ['test','matvey','owner']:
            file=access/(sid+'.json')
            self.assertTrue(file.is_file(), 'Separate private login file is missing: '+sid)
            raw=file.read_text(); credential=json.loads(raw)
            self.assertEqual(credential['token'],self.tokens[sid])
            self.assertEqual(file.stat().st_mode & 0o777,0o600)
            for other in self.tokens:
                if other != sid: self.assertNotIn(self.tokens[other],raw)
        self.assertEqual(access.stat().st_mode & 0o777,0o700)

    def test_public_syllabus_does_not_unlock_practical_progression(self):
        # The curriculum and PDF are reference material, not secret lesson payloads.
        # A readable syllabus must not grant access to the next practical day.
        course=self.req('/api/course')[1]
        self.assertFalse(course['lessons'][1]['unlocked'])
        self.assertTrue(course['lessons'][1]['text'])
        self.assertIn('#### День 02',self.req('/api/material?name=course.md')[1]['text'])
        self.assertEqual(self.req('/api/lesson?day=2')[0],403)
        self.project()
        self.assertEqual(self.submit(2)[0],403)
        self.assertEqual(self.req('/api/state')[1]['current_day'],1)
        self.assertEqual(self.req('/api/state')[1]['accepted_days'],[])

if __name__ == '__main__': unittest.main()
