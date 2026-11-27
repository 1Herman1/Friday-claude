import json
import hashlib
import tempfile
from pathlib import Path
import unittest
import bingx_review as b

class ImageMetadataTest(unittest.TestCase):
    def test_source_label_is_bound_to_exact_image(self):
        with tempfile.TemporaryDirectory() as tmp:
            image=Path(tmp)/'chart.png';image.write_bytes(b'fixture')
            meta={'source_label':'BULLAUSDT · свечи: BingX','sha256':hashlib.sha256(image.read_bytes()).hexdigest()}
            Path(str(image)+'.json').write_text(json.dumps(meta))
            self.assertIn('BingX',b.chart_source_label(image))
            image.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'hash'):
                b.chart_source_label(image)

if __name__=='__main__':unittest.main()
