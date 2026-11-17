"""Excel interchange for the complete contact record."""
import base64
import binascii
import json
import re
from datetime import date, datetime
from io import BytesIO
from zipfile import BadZipFile, ZipFile

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as ExcelImage
from PIL import Image, UnidentifiedImageError

METHODS = {'Phone': '电话', 'Email': '邮箱', 'Social': '社交账号', 'Address': '地址'}
CHUNK = 30000
MAX_ROWS = 5000
MAX_UPLOAD = 10 * 1024 * 1024


def export_contacts(people):
    max_methods = {label: 1 for label in (*METHODS, 'Other')}
    max_avatar = 1
    max_notes = 1
    for person in people:
        counts = {label: 0 for label in max_methods}
        for method in person['methods']:
            label = next((key for key, value in METHODS.items() if value == method['type']), 'Other')
            counts[label] += 1
        for label, count in counts.items():
            max_methods[label] = max(max_methods[label], count)
        max_avatar = max(max_avatar, (len(person['avatar']) + CHUNK - 1) // CHUNK)
        max_notes = max(max_notes, (len(person['notes']) + CHUNK - 1) // CHUNK)
    headers = ['Name', 'Photo', 'Favorite', 'Birthday', 'Notes', 'Created At', 'Tags']
    for label, count in max_methods.items():
        for i in range(1, count + 1):
            if label == 'Other':
                headers.append(f'Other {i} Type')
            headers.append(f'{label} {i}')
    headers += [f'Avatar {i}' for i in range(1, max_avatar + 1)]
    headers += [f'Notes {i}' for i in range(2, max_notes + 1)]
    book = Workbook()
    sheet = book.active
    sheet.title = 'Contacts'
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='3275BE')
    sheet.freeze_panes = 'A2'
    for person in people:
        row = {'Name': person['name'], 'Favorite': 'Yes' if person['favorite'] else 'No',
               'Birthday': person['birthday'], 'Notes': person['notes'][:CHUNK], 'Created At': person['created_at'],
               'Tags': json.dumps(person['tags'], ensure_ascii=False)}
        if person['avatar'].startswith('emoji:'):
            row['Photo'] = person['avatar'][6:]
        elif person['avatar']:
            row['Photo'] = 'Photo'
        counts = {label: 0 for label in max_methods}
        for method in person['methods']:
            label = next((key for key, value in METHODS.items() if value == method['type']), 'Other')
            counts[label] += 1
            key = f'{label} {counts[label]}'
            row[key] = method['value']
            if label == 'Other': row[key + ' Type'] = method['type']
        for i in range(max_avatar): row[f'Avatar {i + 1}'] = person['avatar'][i * CHUNK:(i + 1) * CHUNK]
        for i in range(1, max_notes): row[f'Notes {i + 1}'] = person['notes'][i * CHUNK:(i + 1) * CHUNK]
        if any(len(value) > 32767 for value in row.values() if isinstance(value, str)):
            raise ValueError('A contact field exceeds Excel’s cell size limit.')
        sheet.append([row.get(header, '') for header in headers])
        # Treat user-provided text as literal strings, never spreadsheet formulas.
        for cell in sheet[sheet.max_row]:
            if isinstance(cell.value, str): cell.data_type = 's'
        if person['avatar'].startswith('data:image/'):
            try:
                payload = person['avatar'].split(',', 1)[1]
                with Image.open(BytesIO(base64.b64decode(payload, validate=True))) as picture:
                    picture.thumbnail((48, 48))
                    if picture.mode not in ('RGB', 'RGBA'):
                        picture = picture.convert('RGBA')
                    thumbnail = BytesIO()
                    picture.save(thumbnail, format='PNG')
                    thumbnail.seek(0)
                sheet.add_image(ExcelImage(thumbnail), f'B{sheet.max_row}')
                sheet.cell(sheet.max_row, 2).value = ''
                sheet.row_dimensions[sheet.max_row].height = 40
            except (ValueError, IndexError, binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError):
                pass  # The original remains available in the hidden columns.
    for i, header in enumerate(headers, 1):
        column = sheet.column_dimensions[get_column_letter(i)]
        column.width = 24
        if header.startswith('Avatar '): column.hidden = True
    sheet.column_dimensions['B'].width = 12
    output = BytesIO()
    book.save(output)
    output.seek(0)
    return output


def import_contacts(data):
    if len(data) > MAX_UPLOAD:
        raise ValueError('File exceeds the 10 MB limit.')
    try:
        with ZipFile(BytesIO(data)) as archive:
            if sum(item.file_size for item in archive.infolist()) > 60 * 1024 * 1024:
                raise ValueError('The uncompressed workbook is too large.')
        book = load_workbook(BytesIO(data), read_only=True, data_only=False)
        sheet = book.active
        rows = sheet.iter_rows()
        first = next(rows, ())
        headers = [str(c.value).strip() if c.value is not None else '' for c in first]
        if not headers or 'Name' not in headers or len(headers) != len(set(headers)):
            raise ValueError('Invalid headers. Use a workbook exported by this app.')
        results, skipped = [], 0
        for number, cells in enumerate(rows, 2):
            if number > MAX_ROWS + 1: raise ValueError(f'The workbook exceeds {MAX_ROWS} rows.')
            if any(c.data_type == 'f' for c in cells): raise ValueError(f'Row {number}: formulas are not supported.')
            values = {key: c.value for key, c in zip(headers, cells) if key}
            if not any(value is not None and str(value).strip() for value in values.values()): continue
            if not values.get('Name') or not str(values['Name']).strip():
                skipped += 1
                continue
            def string(key):
                value = values.get(key)
                if isinstance(value, (date, datetime)): return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
                return str(value).strip() if value is not None else ''
            favorite = string('Favorite').lower()
            if favorite not in ('', 'yes', 'no', 'true', 'false', '1', '0', '是', '否'):
                raise ValueError(f'Row {number}: invalid Favorite value.')
            def names(key):
                raw = string(key)
                if not raw: return []
                try: result = json.loads(raw)
                except (ValueError, TypeError): raise ValueError(f'Row {number}: {key} must be a JSON list.')
                if not isinstance(result, list) or not all(isinstance(x, str) and x.strip() for x in result):
                    raise ValueError(f'Row {number}: invalid {key}.')
                return result
            methods = []
            for header in headers:
                match = re.fullmatch(r'(Phone|Email|Social|Address|Other) ([1-9]\d*)', header)
                if not match: continue
                value = string(header)
                kind = METHODS.get(match[1], string(header + ' Type'))
                if value and not kind: raise ValueError(f'Row {number}: missing type for {header}.')
                if value: methods.append({'type': kind, 'value': value})
                elif match[1] == 'Other' and kind: raise ValueError(f'Row {number}: missing value for {header}.')
            avatar_headers = sorted((h for h in headers if re.fullmatch(r'Avatar [1-9]\d*', h)), key=lambda h: int(h.split()[1]))
            avatar = ''.join(string(h) for h in avatar_headers)
            note_headers = sorted((h for h in headers if re.fullmatch(r'Notes (?:[2-9]|[1-9]\d+)', h)), key=lambda h: int(h.split()[1]))
            notes = ''.join(str(values.get(h) or '') for h in ['Notes', *note_headers])
            created = string('Created At')
            if created:
                try: datetime.fromisoformat(created)
                except ValueError: raise ValueError(f'Row {number}: invalid Created At date.')
            results.append({'name': string('Name'), 'favorite': favorite in ('yes', 'true', '1', '是'),
                            'birthday': string('Birthday'), 'notes': notes, 'avatar': avatar,
                            'methods': methods, 'tags': names('Tags'), 'group_names': names('Groups'), 'created_at': created})
        book.close()
        return results, skipped
    except (BadZipFile, KeyError, OSError, EOFError, TypeError) as error:
        raise ValueError('Invalid Excel file. Please select a valid .xlsx workbook.') from error
