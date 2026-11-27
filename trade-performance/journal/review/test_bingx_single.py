import unittest
from unittest.mock import MagicMock
import bingx_review as b

class SingleReviewTest(unittest.TestCase):
    def test_single_scope_filters_exact_id_without_closed_only_filter(self):
        cur=MagicMock();cur.fetchall.return_value=[('trade',155,'BULLA','OPEN')]
        rows=b.select_positions(cur,'trade')
        sql,params=cur.execute.call_args.args
        self.assertIn('t.id=%s',sql)
        self.assertEqual(params,('trade',))
        self.assertNotIn("t.status='CLOSED'",sql)
        self.assertEqual(len(rows),1)

    def test_running_row_is_completed_in_place_without_delete(self):
        cur=MagicMock();cur.fetchone.return_value=('review',)
        rid=b.store_review(cur,'trade','done','result',{},'review')
        sql,params=cur.execute.call_args.args
        self.assertTrue(sql.strip().startswith('UPDATE ai_reviews'))
        self.assertIn("status='running'",sql)
        self.assertEqual(params[-2:],('review','trade'))
        self.assertEqual(rid,'review')

    def test_unrelated_or_completed_running_id_is_rejected(self):
        cur=MagicMock();cur.fetchone.return_value=None
        with self.assertRaisesRegex(ValueError,'running'):
            b.store_review(cur,'trade','done','result',{},'wrong-review')

if __name__=='__main__':unittest.main()
