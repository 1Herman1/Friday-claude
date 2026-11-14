import tempfile
import unittest
from pathlib import Path
from build_handbook import Book, fonts

class BuildTest(unittest.TestCase):
    def test_pdf_brand_is_not_parsed_as_a_broken_entity(self):
        from pypdf import PdfReader
        text = PdfReader(Path(__file__).parent / 'HB-Web-Development-Handbook.pdf').pages[0].extract_text()
        self.assertNotIn('H&B;', text)
        self.assertIn('H&B', text)

    def test_toc_entries_escape_brand_markup(self):
        from types import SimpleNamespace
        from reportlab.platypus import Paragraph
        from reportlab.lib.styles import ParagraphStyle
        fonts()
        with tempfile.TemporaryDirectory() as directory:
            book = Book(Path(directory) / 'test.pdf')
            book.page = 1
            book.canv = SimpleNamespace(bookmarkPage=lambda *a: None, addOutlineEntry=lambda *a, **k: None)
            seen = []
            book.notify = lambda kind, value: seen.append(value)
            book.afterFlowable(Paragraph('Глава H&amp;B', ParagraphStyle('Chapter', fontName='HB')))
            self.assertIn('&amp;', seen[0][1])

    def test_heading_keys_reset_for_each_toc_pass(self):
        fonts()
        with tempfile.TemporaryDirectory() as directory:
            book = Book(Path(directory) / 'test.pdf')
            book.heading_number = 47
            book.beforeDocument()
            self.assertEqual(book.heading_number, 0)

if __name__ == '__main__':
    unittest.main()
