import json
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
import codex_client as c


class CodexClientTest(unittest.TestCase):
    def test_subscription_command_and_usage(self):
        events = '\n'.join(json.dumps(e) for e in [
            {'type':'item.completed','item':{'type':'agent_message','text':'Разбор'}},
            {'type':'turn.completed','usage':{'input_tokens':20,'cached_input_tokens':5,'output_tokens':9}}])
        with patch.object(c.subprocess,'run',return_value=subprocess.CompletedProcess([],0,events,'')) as run:
            r=c.call_codex('данные','правила',model='gpt-6.1-sol')
        self.assertTrue(r['ok'])
        self.assertEqual(r['text'],'Разбор')
        self.assertEqual((r['in'],r['cache'],r['out']),(20,5,9))
        self.assertEqual(r['provider'],'openai-codex')
        self.assertIsNone(r['cost'])
        args=run.call_args.args[0]
        self.assertIn('exec',args)
        self.assertIn('--ignore-user-config',args)
        self.assertIn('gpt-6.1-sol',args)
        self.assertNotIn('OPENAI_API_KEY',run.call_args.kwargs['env'])

    def test_nonzero_does_not_accept_partial_text(self):
        events=json.dumps({'type':'item.completed','item':{'type':'agent_message','text':'partial'}})
        with patch.object(c.subprocess,'run',return_value=subprocess.CompletedProcess([],1,events,'auth failed')):
            self.assertFalse(c.call_codex('p','s')['ok'])

    def test_missing_completion_is_failure(self):
        with patch.object(c.subprocess,'run',return_value=subprocess.CompletedProcess([],0,'','')):
            self.assertFalse(c.call_codex('p','s')['ok'])

    def test_timeout_is_reported(self):
        with patch.object(c.subprocess,'run',side_effect=subprocess.TimeoutExpired('codex',900)):
            self.assertFalse(c.call_codex('p','s')['ok'])


if __name__=='__main__': unittest.main()
