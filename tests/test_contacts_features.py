import sqlite3
from contextlib import closing
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app import create_app


class ContactFeatureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'contacts.sqlite'
        with closing(sqlite3.connect(self.path)) as db:
            db.executescript('''CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE contact_methods (id INTEGER PRIMARY KEY, contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, type TEXT NOT NULL, value TEXT NOT NULL);
                INSERT INTO contacts (name) VALUES ('Existing');''')
            db.commit()
        self.app = create_app({'TESTING': True, 'DATABASE': str(self.path)})
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp.cleanup()

    def create(self, **fields):
        payload = {'name': 'Alex', 'methods': [], 'tags': [], 'groups': [], **fields}
        response = self.client.post('/api/contacts', json=payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def test_migration_birthday_and_legacy_update(self):
        old = self.client.get('/api/contacts').get_json()[0]
        self.assertEqual(old['birthday'], '')
        person = self.create(birthday='2000-02-29')
        self.assertEqual(self.create(name='No birthday')['birthday'], '')
        self.assertEqual(self.client.post('/api/contacts', json={'name': 'Bad', 'birthday': '2023-02-29'}).status_code, 400)
        self.assertEqual(self.client.post('/api/contacts', json={'name': 'Future', 'birthday': '9999-01-01'}).status_code, 400)
        legacy = {'name': 'Updated', 'methods': [], 'groups': [], 'tags': []}
        updated = self.client.put(f"/api/contacts/{person['id']}", json=legacy).get_json()
        self.assertEqual(updated['birthday'], '2000-02-29')
        cleared = self.client.put(f"/api/contacts/{person['id']}", json={**legacy, 'birthday': ''}).get_json()
        self.assertEqual(cleared['birthday'], '')

    def test_batch_atomic_and_tags(self):
        one, two = self.create(), self.create(name='Second')
        bad = self.client.post('/api/contacts/batch', json={'ids': [one['id'], 999999], 'action': 'delete'})
        self.assertEqual(bad.status_code, 404)
        self.assertEqual(len(self.client.get('/api/contacts').get_json()), 3)
        for action in ('favorite', 'add_tag'):
            response = self.client.post('/api/contacts/batch', json={'ids': [one['id'], two['id']], 'action': action, 'tag': 'Friends'})
            self.assertEqual(response.status_code, 200)
        people = {p['id']: p for p in self.client.get('/api/contacts').get_json()}
        self.assertTrue(people[one['id']]['favorite'])
        self.assertEqual(people[two['id']]['tags'], ['Friends'])
        self.client.post('/api/contacts/batch', json={'ids': [one['id']], 'action': 'remove_tag', 'tag': 'friends'})
        people = {p['id']: p for p in self.client.get('/api/contacts').get_json()}
        self.assertEqual(people[one['id']]['tags'], [])
        self.assertEqual(people[two['id']]['tags'], ['Friends'])
        self.assertEqual(self.client.post('/api/contacts/batch', json={'ids': [one['id'], one['id']], 'action': 'delete'}).status_code, 400)

    def test_duplicate_merge_conflicts_and_preservation(self):
        first = self.create(name='Alex', birthday='2000-01-02', notes='one', methods=[{'type': '电话', 'value': '+1 (555) 123-4567'}], tags=['One'])
        second = self.create(name='Other', birthday='2001-02-03', notes='two', favorite=True, methods=[{'type': '电话', 'value': '+15551234567'}, {'type': '邮箱', 'value': 'a@example.com'}], tags=['Two'])
        pairs = self.client.get('/api/contacts/duplicates').get_json()
        self.assertEqual(len(pairs), 1)
        self.assertIn('Same phone', pairs[0]['reasons'])
        payload = {'ids': [first['id'], second['id']], 'target_id': first['id']}
        self.assertEqual(self.client.post('/api/contacts/merge', json=payload).status_code, 400)
        self.assertEqual(len(self.client.get('/api/contacts').get_json()), 3)
        result = self.client.post('/api/contacts/merge', json={**payload, 'birthday': second['birthday']})
        self.assertEqual(result.status_code, 200, result.get_json())
        merged = result.get_json()
        self.assertEqual(merged['birthday'], '2001-02-03')
        self.assertTrue(merged['favorite'])
        self.assertEqual(set(merged['tags']), {'One', 'Two'})
        self.assertEqual(merged['notes'], 'one\n\ntwo')
        self.assertEqual(len(merged['methods']), 3)
        self.assertEqual(self.client.delete(f"/api/contacts/{second['id']}").status_code, 404)


if __name__ == '__main__':
    unittest.main()
