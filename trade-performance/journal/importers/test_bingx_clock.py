"""Offline clock-skew regressions; no keys, network or database."""
import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import bingx_api_sync as bx


class ClockTest(unittest.TestCase):
    def test_private_signs_with_exchange_time_despite_local_skew(self):
        calls = []

        def serve(req, timeout=30):
            url = req.full_url if hasattr(req, 'full_url') else req
            calls.append(url)
            if '/server/time' in url:
                return io.BytesIO(json.dumps({'code': 0, 'data': {'serverTime': 1020000}}).encode())
            stamp = int(parse_qs(urlsplit(url).query)['timestamp'][0])
            ok = abs(stamp - 1020000) < 1000
            return io.BytesIO(json.dumps({'code': 0 if ok else 109400,
                                        'msg': '' if ok else 'timestamp is invalid', 'data': []}).encode())

        with patch.dict(os.environ, {'BINGX_API_KEY': 'offline', 'BINGX_SECRET_KEY': 'offline'}), \
             patch.object(bx, '_CLOCK', {} , create=True), \
             patch.object(bx.time, 'time', return_value=1000), \
             patch.object(bx.urllib.request, 'urlopen', side_effect=serve):
            self.assertEqual(bx.private('/openApi/swap/v2/user/positions'), [])
        self.assertTrue(any('/server/time' in u for u in calls))


if __name__ == '__main__':
    unittest.main()
