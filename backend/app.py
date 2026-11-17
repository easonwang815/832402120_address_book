from pathlib import Path
import sqlite3
from datetime import date
from contextlib import nullcontext
import re
from flask import Flask, jsonify, request, send_file, send_from_directory
from db import close_db, get_db, init_db
from excel import export_contacts, import_contacts, MAX_UPLOAD

ROOT = Path(__file__).resolve().parent.parent


def create_app(config=None):
    app = Flask(__name__, instance_relative_config=True, static_folder=None)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    app.config['DATABASE'] = str(Path(app.instance_path) / 'contacts.sqlite')
    if config:
        app.config.update(config)
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()
        db = get_db()
        columns = {row['name'] for row in db.execute('PRAGMA table_info(contacts)')}
        for name, definition in [('avatar', "TEXT NOT NULL DEFAULT ''"), ('notes', "TEXT NOT NULL DEFAULT ''"), ('created_at', 'TEXT'), ('birthday', "TEXT NOT NULL DEFAULT ''")]:
            if name not in columns:
                db.execute(f'ALTER TABLE contacts ADD COLUMN {name} {definition}')
        db.execute("UPDATE contacts SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
        db.executescript('''CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
        CREATE TABLE IF NOT EXISTS contact_groups (contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, PRIMARY KEY(contact_id, group_id));
        CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
        CREATE TABLE IF NOT EXISTS contact_tags (contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(contact_id, tag_id));''')
        db.commit()

    def contact(row):
        db = get_db()
        cid = row['id']
        return dict(id=cid, name=row['name'], favorite=bool(row['favorite']), avatar=row['avatar'], notes=row['notes'], birthday=row['birthday'], created_at=row['created_at'],
                    methods=[dict(x) for x in db.execute('SELECT type, value FROM contact_methods WHERE contact_id=? ORDER BY id', (cid,))],
                    groups=[dict(x) for x in db.execute('SELECT g.id, g.name FROM groups g JOIN contact_groups cg ON cg.group_id=g.id WHERE cg.contact_id=? ORDER BY g.name', (cid,))],
                    tags=[x['name'] for x in db.execute('SELECT t.name FROM tags t JOIN contact_tags ct ON ct.tag_id=t.id WHERE ct.contact_id=? ORDER BY t.name', (cid,))])

    def validate(data):
        if not isinstance(data, dict) or not isinstance(data.get('name'), str) or not data['name'].strip():
            raise ValueError('请输入联系人姓名')
        methods = data.get('methods', [])
        groups = data.get('groups', [])
        tags = data.get('tags', [])
        if not isinstance(methods, list) or not all(isinstance(m, dict) and isinstance(m.get('type'), str) and isinstance(m.get('value'), str) and m['type'].strip() and m['value'].strip() for m in methods):
            raise ValueError('请填写完整的联系方式')
        if not isinstance(groups, list) or not all(type(x) is int for x in groups) or not isinstance(tags, list) or not all(isinstance(x, str) and x.strip() for x in tags):
            raise ValueError('分组或标签格式有误')
        if not isinstance(data.get('avatar', ''), str) or not isinstance(data.get('notes', ''), str) or type(data.get('favorite', False)) is not bool:
            raise ValueError('联系人信息格式有误')
        if len(data.get('avatar', '')) > 1500000:
            raise ValueError('头像太大，请选择小于 1 MB 的图片')
        birthday = data.get('birthday', '')
        if not isinstance(birthday, str):
            raise ValueError('Invalid birthday')
        if birthday:
            try:
                parsed = date.fromisoformat(birthday)
                if parsed.isoformat() != birthday or parsed > date.today():
                    raise ValueError()
            except ValueError:
                raise ValueError('Invalid birthday')
        if groups:
            found = get_db().execute('SELECT COUNT(*) FROM groups WHERE id IN (' + ','.join('?' * len(groups)) + ')', groups).fetchone()[0]
            if found != len(set(groups)):
                raise ValueError('所选分组不存在')
        return data['name'].strip(), methods, groups, tags

    def save(data, cid=None, *, commit=True):
        if cid is not None and isinstance(data, dict) and 'birthday' not in data:
            existing = get_db().execute('SELECT birthday FROM contacts WHERE id=?', (cid,)).fetchone()
            data = {**data, 'birthday': existing['birthday'] if existing else ''}
        name, methods, groups, tags = validate(data)
        db = get_db()
        with db if commit else nullcontext():
            if cid is None:
                cid = db.execute('INSERT INTO contacts (name, favorite, avatar, notes, birthday, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', (name, data.get('favorite', False), data.get('avatar', ''), data.get('notes', ''), data.get('birthday', ''))).lastrowid
            else:
                db.execute('UPDATE contacts SET name=?, favorite=?, avatar=?, notes=?, birthday=? WHERE id=?', (name, data.get('favorite', False), data.get('avatar', ''), data.get('notes', ''), data.get('birthday', ''), cid))
                for table in ('contact_methods', 'contact_groups', 'contact_tags'):
                    db.execute(f'DELETE FROM {table} WHERE contact_id=?', (cid,))
            db.executemany('INSERT INTO contact_methods (contact_id, type, value) VALUES (?, ?, ?)', [(cid, m['type'].strip(), m['value'].strip()) for m in methods])
            db.executemany('INSERT INTO contact_groups (contact_id, group_id) VALUES (?, ?)', [(cid, gid) for gid in set(groups)])
            for tag in dict.fromkeys(t.strip() for t in tags):
                db.execute('INSERT OR IGNORE INTO tags (name) VALUES (?)', (tag,))
                db.execute('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) SELECT ?, id FROM tags WHERE name=? COLLATE NOCASE', (cid, tag))
        return contact(db.execute('SELECT * FROM contacts WHERE id=?', (cid,)).fetchone())

    @app.get('/')
    def index():
        return send_from_directory(ROOT / 'frontend', 'index.html')

    @app.get('/assets/<path:filename>')
    def assets(filename):
        return send_from_directory(ROOT / 'frontend', filename)

    @app.get('/api/contacts')
    def list_contacts():
        return jsonify([contact(row) for row in get_db().execute('SELECT * FROM contacts ORDER BY id DESC').fetchall()])

    @app.get('/api/contacts/export')
    def export_excel():
        people = [contact(row) for row in get_db().execute('SELECT * FROM contacts ORDER BY id').fetchall()]
        try:
            return send_file(export_contacts(people), mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name='contacts.xlsx')
        except ValueError as error:
            return jsonify(error=str(error)), 400

    @app.post('/api/contacts/import')
    def import_excel():
        upload = request.files.get('file')
        if not upload or not upload.filename.lower().endswith('.xlsx'):
            return jsonify(error='Please select an .xlsx file.'), 400
        try:
            people, skipped = import_contacts(upload.stream.read(MAX_UPLOAD + 1))
            db = get_db()
            # All rows and associated tags/groups are committed together.
            with db:
                for number, person in enumerate(people, 1):
                    group_names = person.pop('group_names')
                    created_at = person.pop('created_at')
                    group_ids = []
                    for name in group_names:
                        db.execute('INSERT OR IGNORE INTO groups (name) VALUES (?)', (name.strip(),))
                        group_ids.append(db.execute('SELECT id FROM groups WHERE name=? COLLATE NOCASE', (name.strip(),)).fetchone()['id'])
                    person['groups'] = group_ids
                    try:
                        saved = save(person, commit=False)
                    except ValueError as error:
                        raise ValueError(f'Contact {number}: {error}') from error
                    if created_at:
                        db.execute('UPDATE contacts SET created_at=? WHERE id=?', (created_at, saved['id']))
            return jsonify(imported=len(people), skipped=skipped)
        except (ValueError, sqlite3.IntegrityError) as error:
            return jsonify(error=str(error)), 400
        except Exception:
            app.logger.exception('Excel import failed')
            return jsonify(error='Could not read the workbook. Please check its format.'), 400

    @app.post('/api/contacts')
    def create_contact():
        try:
            return jsonify(save(request.get_json(silent=True))), 201
        except ValueError as error:
            return jsonify(error=str(error)), 400

    @app.put('/api/contacts/<int:cid>')
    def update_contact(cid):
        if not get_db().execute('SELECT 1 FROM contacts WHERE id=?', (cid,)).fetchone():
            return jsonify(error='联系人不存在'), 404
        try:
            return jsonify(save(request.get_json(silent=True), cid))
        except ValueError as error:
            return jsonify(error=str(error)), 400

    @app.delete('/api/contacts/<int:cid>')
    def delete_contact(cid):
        db = get_db()
        with db:
            cursor = db.execute('DELETE FROM contacts WHERE id=?', (cid,))
        return ('', 204) if cursor.rowcount else (jsonify(error='联系人不存在'), 404)

    def checked_ids(value, minimum=1):
        if not isinstance(value, list) or len(value) < minimum or len(value) > 500 or any(type(item) is not int or item < 1 for item in value) or len(set(value)) != len(value):
            raise ValueError('Select valid contacts')
        db = get_db()
        rows = db.execute('SELECT * FROM contacts WHERE id IN (' + ','.join('?' * len(value)) + ')', value).fetchall()
        if len(rows) != len(value):
            raise LookupError('Some contacts no longer exist. Refresh and try again.')
        return rows

    @app.post('/api/contacts/batch')
    def batch_contacts():
        data = request.get_json(silent=True)
        try:
            if not isinstance(data, dict):
                raise ValueError('Invalid request')
            ids = data.get('ids')
            checked_ids(ids)
            action = data.get('action')
            if action not in ('delete', 'favorite', 'unfavorite', 'add_tag', 'remove_tag'):
                raise ValueError('Invalid action')
            tag = data.get('tag', '')
            if action in ('add_tag', 'remove_tag') and (not isinstance(tag, str) or not tag.strip() or len(tag.strip()) > 100):
                raise ValueError('Enter a tag (up to 100 characters)')
            db = get_db()
            with db:
                if action == 'delete':
                    db.executemany('DELETE FROM contacts WHERE id=?', [(cid,) for cid in ids])
                elif action in ('favorite', 'unfavorite'):
                    db.executemany('UPDATE contacts SET favorite=? WHERE id=?', [(action == 'favorite', cid) for cid in ids])
                elif action == 'add_tag':
                    db.execute('INSERT OR IGNORE INTO tags (name) VALUES (?)', (tag.strip(),))
                    tag_id = db.execute('SELECT id FROM tags WHERE name=? COLLATE NOCASE', (tag.strip(),)).fetchone()['id']
                    db.executemany('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)', [(cid, tag_id) for cid in ids])
                else:
                    db.executemany('DELETE FROM contact_tags WHERE contact_id=? AND tag_id IN (SELECT id FROM tags WHERE name=? COLLATE NOCASE)', [(cid, tag.strip()) for cid in ids])
            return jsonify(updated=len(ids))
        except (ValueError, LookupError) as error:
            return jsonify(error=str(error)), 404 if isinstance(error, LookupError) else 400

    @app.get('/api/contacts/duplicates')
    def duplicates():
        people = [contact(row) for row in get_db().execute('SELECT * FROM contacts ORDER BY id').fetchall()]
        matches = []
        for index, first in enumerate(people):
            for second in people[index + 1:]:
                reasons = []
                if first['name'].strip().casefold() == second['name'].strip().casefold():
                    reasons.append('Same name')
                def keys(person):
                    result = set()
                    for method in person['methods']:
                        if method['type'] in ('电话', 'Phone'):
                            value = re.sub(r'[^0-9+]', '', method['value'])
                            if len(re.sub(r'\D', '', value)) >= 7:
                                result.add(('phone', value))
                        elif method['type'] in ('邮箱', 'Email'):
                            value = method['value'].strip().casefold()
                            if '@' in value:
                                result.add(('email', value))
                    return result
                common = keys(first) & keys(second)
                if any(kind == 'phone' for kind, value in common): reasons.append('Same phone')
                if any(kind == 'email' for kind, value in common): reasons.append('Same email')
                if reasons: matches.append({'contacts': [first, second], 'reasons': reasons})
        return jsonify(matches)

    @app.post('/api/contacts/merge')
    def merge_contacts():
        data = request.get_json(silent=True)
        try:
            if not isinstance(data, dict): raise ValueError('Invalid request')
            ids = data.get('ids')
            rows = checked_ids(ids, minimum=2)
            target = data.get('target_id')
            if type(target) is not int or target not in ids: raise ValueError('Choose a contact to keep')
            people = {row['id']: contact(row) for row in rows}
            primary = people[target]
            others = [people[cid] for cid in ids if cid != target]
            birthdays = {p['birthday'] for p in people.values() if p['birthday']}
            if len(birthdays) > 1 and data.get('birthday') not in birthdays:
                raise ValueError('Choose which birthday to keep')
            birthday = data.get('birthday') if len(birthdays) > 1 else next(iter(birthdays), '')
            db = get_db()
            with db:
                notes = list(dict.fromkeys(p['notes'].strip() for p in [primary] + others if p['notes'].strip()))
                avatar = primary['avatar'] or next((p['avatar'] for p in others if p['avatar']), '')
                db.execute('UPDATE contacts SET favorite=?, avatar=?, notes=?, birthday=? WHERE id=?', (any(p['favorite'] for p in people.values()), avatar, '\n\n'.join(notes), birthday, target))
                existing = {(m['type'].casefold(), m['value'].strip().casefold()) for m in primary['methods']}
                for person in others:
                    for method in person['methods']:
                        key = (method['type'].casefold(), method['value'].strip().casefold())
                        if key not in existing:
                            db.execute('INSERT INTO contact_methods (contact_id, type, value) VALUES (?, ?, ?)', (target, method['type'], method['value']))
                            existing.add(key)
                    db.execute('INSERT OR IGNORE INTO contact_tags SELECT ?, tag_id FROM contact_tags WHERE contact_id=?', (target, person['id']))
                    db.execute('INSERT OR IGNORE INTO contact_groups SELECT ?, group_id FROM contact_groups WHERE contact_id=?', (target, person['id']))
                    db.execute('DELETE FROM contacts WHERE id=?', (person['id'],))
            return jsonify(contact(db.execute('SELECT * FROM contacts WHERE id=?', (target,)).fetchone()))
        except (ValueError, LookupError) as error:
            return jsonify(error=str(error)), 404 if isinstance(error, LookupError) else 400

    @app.get('/api/groups')
    def list_groups():
        return jsonify([dict(row) for row in get_db().execute('SELECT id, name FROM groups ORDER BY name')])

    @app.post('/api/groups')
    def create_group():
        data = request.get_json(silent=True)
        name = data.get('name', '').strip() if isinstance(data, dict) and isinstance(data.get('name'), str) else ''
        if not name:
            return jsonify(error='请输入分组名称'), 400
        db = get_db()
        try:
            with db:
                gid = db.execute('INSERT INTO groups (name) VALUES (?)', (name,)).lastrowid
        except sqlite3.IntegrityError:
            return jsonify(error='分组名称已存在'), 400
        return jsonify(id=gid, name=name), 201

    return app


if __name__ == '__main__':
    create_app().run(port=5051)
