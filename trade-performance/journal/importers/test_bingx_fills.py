"""Offline regressions for lossless BingX order-fill import."""
import unittest
from decimal import Decimal as D
from unittest.mock import patch
import bingx_api_sync as b


class FillImportTest(unittest.TestCase):
    def test_individual_fills_keep_order_key_and_exact_totals(self):
        order=dict(orderId=1,symbol='BTC-USDT',side='SELL',positionSide='LONG',
                   executedQty='3',avgPrice='15',commission='-0.03',profit='9',
                   updateTime=100000,type='LIMIT')
        detail=[dict(orderId='1',symbol='BTC-USDT',side='SELL',positionSide='LONG',
                     volume='1',price='14',commission='-0.01',filledTm='2026-11-01T00:00:00.000Z',type='LIMIT'),
                dict(orderId='1',symbol='BTC-USDT',side='SELL',positionSide='LONG',
                     volume='2',price='15.5',commission='-0.02',filledTm='2026-11-01T00:00:01.000Z',type='LIMIT')]
        rows=b.detailed_fills([order],detail)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['external_id'],'order:1')
        self.assertNotEqual(rows[0]['external_id'],rows[1]['external_id'])
        self.assertEqual(sum(x['qty'] for x in rows),D('3'))
        self.assertEqual(sum(x['pnl'] for x in rows),D('9'))
        self.assertEqual(sum(x['fee'] for x in rows),D('0.03'))
        self.assertEqual([x['external_id'] for x in b.detailed_fills([order],detail[::-1])],
                         [x['external_id'] for x in rows])

    def test_missing_execution_blocks_import(self):
        order=dict(orderId=1,symbol='BTC-USDT',side='BUY',positionSide='LONG',executedQty='3')
        with self.assertRaisesRegex(ValueError,'coverage'):
            b.detailed_fills([order],[])


if __name__=='__main__': unittest.main()
