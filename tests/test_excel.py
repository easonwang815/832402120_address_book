import io
import base64
import sys
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app import create_app


class ExcelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.client = create_app({'TESTING': True, 'DATABASE': str(Path(self.temp.name) / 'db.sqlite')}).test_client()

    def tearDown(self):
        self.temp.cleanup()

    def upload(self, content, filename='contacts.xlsx'):
        return self.client.post('/api/contacts/import', data={'file': (io.BytesIO(content), filename)})

    def test_export_import_complete_record(self):
        group = self.client.post('/api/groups', json={'name': 'Work'}).get_json()
        picture = io.BytesIO()
        Image.new('RGB', (12, 12), 'blue').save(picture, format='PNG')
        original = {'name': '=Alex', 'favorite': True, 'birthday': '2000-02-29',
                    'notes': ' line one\n' + 'x' * 31000 + '  ', 'avatar': 'data:image/png;base64,' + base64.b64encode(picture.getvalue()).decode(),
                    'methods': [{'type': '电话', 'value': '00123'}, {'type': '电话', 'value': '+456'},
                                {'type': '邮箱', 'value': 'alex@example.com'}, {'type': '其他', 'value': '=literal'}],
                    'tags': ['Friends', 'Work'], 'groups': [group['id']]}
        made = self.client.post('/api/contacts', json=original)
        self.assertEqual(made.status_code, 201)
        exported = self.client.get('/api/contacts/export')
        self.assertEqual(exported.status_code, 200)
        book = load_workbook(io.BytesIO(exported.data))
        self.assertEqual(book.active['A2'].data_type, 's')
        headers = [cell.value for cell in book.active[1]]
        self.assertNotIn('Groups', headers)
        self.assertEqual(len(book.active._images), 1)
        self.assertTrue(book.active.column_dimensions[book.active.cell(1, headers.index('Avatar 1') + 1).column_letter].hidden)
        self.assertEqual(self.upload(exported.data).status_code, 200)
        imported = self.client.get('/api/contacts').get_json()[0]
        for key in ('name', 'favorite', 'birthday', 'notes', 'avatar', 'methods', 'tags'):
            self.assertEqual(imported[key], made.get_json()[key], key)
        self.assertEqual(imported['groups'], [])
        self.assertEqual(imported['created_at'], made.get_json()['created_at'])

    def test_invalid_workbook_and_atomic_rollback(self):
        self.assertEqual(self.upload(b'not xlsx').status_code, 400)
        self.assertEqual(self.upload(b'bad', 'file.xls').status_code, 400)
        self.client.post('/api/contacts', json={'name': 'First'})
        exported = self.client.get('/api/contacts/export')
        book = load_workbook(io.BytesIO(exported.data))
        sheet = book.active
        sheet.append(['Invalid', '', 'Yes', '9999-01-01'])
        data = io.BytesIO()
        book.save(data)
        response = self.upload(data.getvalue())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(self.client.get('/api/contacts').get_json()), 1)

    def test_emoji_avatar_is_visible_and_round_trips(self):
        self.client.post('/api/contacts', json={'name': 'Emoji', 'avatar': 'emoji:🐱'})
        exported = self.client.get('/api/contacts/export')
        book = load_workbook(io.BytesIO(exported.data))
        self.assertEqual(book.active['B2'].value, '🐱')
        self.assertEqual(self.upload(exported.data).status_code, 200)
        self.assertEqual(self.client.get('/api/contacts').get_json()[0]['avatar'], 'emoji:🐱')

    def test_formulas_rejected_and_missing_names_skipped(self):
        exported = self.client.get('/api/contacts/export')
        book = load_workbook(io.BytesIO(exported.data))
        sheet = book.active
        sheet.append(['', 'Yes'])
        sheet.append(['Safe', 'No'])
        data = io.BytesIO(); book.save(data)
        result = self.upload(data.getvalue())
        self.assertEqual(result.get_json(), {'imported': 1, 'skipped': 1})
        sheet['A3'] = '=1+1'
        data = io.BytesIO(); book.save(data)
        self.assertEqual(self.upload(data.getvalue()).status_code, 400)
        self.assertEqual(len(self.client.get('/api/contacts').get_json()), 1)


if __name__ == '__main__':
    unittest.main()
