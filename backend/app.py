from pathlib import Path
import sqlite3
from flask import Flask, jsonify, request, send_from_directory
from db import close_db, get_db, init_db

ROOT = Path(__file__).resolve().parent.parent


def create_app():
    app = Flask(__name__, instance_relative_config=True, static_folder=None)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    app.config['DATABASE'] = str(Path(app.instance_path) / 'contacts.sqlite')
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()
        db = get_db()
        columns = {row['name'] for row in db.execute('PRAGMA table_info(contacts)')}
        for name, definition in [('avatar', "TEXT NOT NULL DEFAULT ''"), ('notes', "TEXT NOT NULL DEFAULT ''"), ('created_at', 'TEXT')]:
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
        return dict(id=cid, name=row['name'], favorite=bool(row['favorite']), avatar=row['avatar'], notes=row['notes'], created_at=row['created_at'],
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
        if groups:
            found = get_db().execute('SELECT COUNT(*) FROM groups WHERE id IN (' + ','.join('?' * len(groups)) + ')', groups).fetchone()[0]
            if found != len(set(groups)):
                raise ValueError('所选分组不存在')
        return data['name'].strip(), methods, groups, tags

    def save(data, cid=None):
        name, methods, groups, tags = validate(data)
        db = get_db()
        with db:
            if cid is None:
                cid = db.execute('INSERT INTO contacts (name, favorite, avatar, notes, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', (name, data.get('favorite', False), data.get('avatar', ''), data.get('notes', ''))).lastrowid
            else:
                db.execute('UPDATE contacts SET name=?, favorite=?, avatar=?, notes=? WHERE id=?', (name, data.get('favorite', False), data.get('avatar', ''), data.get('notes', ''), cid))
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
