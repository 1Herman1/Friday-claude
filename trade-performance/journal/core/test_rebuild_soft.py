import unittest
from unittest.mock import MagicMock
from datetime import datetime,timezone,timedelta
from decimal import Decimal as D
from rebuild import rebuild

class SoftDeleteTest(unittest.TestCase):
    def test_bingx_rebuild_never_issues_delete(self):
        cur=MagicMock();cur.rowcount=0
        t=datetime(2026,11,1,tzinfo=timezone.utc)
        cur.fetchall.return_value=[('e1','order:1','i','BUY','long',D(10),D(2),D(2),D(20),D('.1'),D(0),False,t,'org'),
                                   ('e2','order:2','i','SELL','long',D(11),D(2),D(2),D(22),D('.1'),D(2),False,t+timedelta(hours=1),'org')]
        cur.fetchone.return_value=('trade',)
        r=rebuild(cur,'account',soft_delete=True)
        statements=[args.args[0].strip().upper() for args in cur.execute.call_args_list]
        self.assertFalse(any(s.startswith('DELETE') for s in statements))
        self.assertTrue(any(s.startswith('UPDATE TRADES SET DELETED_AT') for s in statements))
        self.assertEqual(r['trades'],1)

if __name__=='__main__':unittest.main()
