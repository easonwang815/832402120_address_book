| Item | Content |
| --- | --- |
| Course | Software Engineering (FZU–MU) |
| Team | Wang Yizhen (832402120) and Xu Zidong (832402124) |
| Assignment | [Extreme Programming](https://bbs.csdn.net/topics/620593436) |
| Project goal | Build a shared address book with favorites, multiple contact methods, and Excel import and export. |

# Contacts

Contacts is a web address book with a three-column layout: navigation and tags, a searchable contact list, and a profile panel.

## Online demo

**Deployment address: [https://eason.pythonanywhere.com/](https://eason.pythonanywhere.com/)**

The hosted version has not yet been updated with the latest Excel import and export features. To try them, run the project locally.

## Features

- Add, edit, and delete contacts. Save multiple phone numbers, email addresses, social accounts, and addresses for each person.
- Mark favorites, search by name, phone, or email, filter by tag, and sort by name or creation date.
- Add a photo or emoji avatar, a birthday, and notes. The Birthdays view shows the next dates in order and highlights birthdays within 30 days.
- Review a possible duplicate when saving a new contact, or select multiple contacts to update favorites, change tags, or delete them together.
- Copy contact details, use call and email shortcuts, and switch between light and dark themes. The browser remembers the selected theme.
- Import and export `.xlsx` workbooks from the toolbar.

## Run locally

Use Python 3.10 or later. From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python backend/app.py
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1` and use `python -m venv .venv` if `python3` is unavailable. Open [http://127.0.0.1:5051](http://127.0.0.1:5051). Stop the server with Ctrl+C. This launch command stores contacts in `instance/contacts.sqlite`. The hosted demo uses a separate database; the app has no login or separate address books, so use sample data on the public demo.

## Excel import and export

1. Choose **Export Excel** to download all contacts, one per row. Each contact method uses its own column, so multiple phone numbers or emails stay separate. Photos appear as thumbnails and emoji appear in the Photo column. The workbook excludes groups.
2. To prepare a workbook for import, use an export as a template and keep the headers. Format phone numbers with leading zeros as text. Use `Yes` or `No` for `Favorite`, a JSON array such as `["Friends", "Work"]` for `Tags`, and both the type and value for each `Other` contact method. Keep the hidden `Avatar` columns if you want to restore the original avatars.
3. Choose **Import Excel** and select an `.xlsx` file. Import adds new contacts without overwriting existing ones; importing the same file twice can create duplicates. Blank rows are ignored, rows without a name are counted and skipped, and invalid data cancels the import without saving partial results. The file must be at most 10 MB and contain at most 5,000 data rows. Formula cells are not supported.

## Project structure

| Path | Purpose |
| --- | --- |
| `frontend/` | HTML, CSS, and vanilla JavaScript for the contacts workspace |
| `backend/` | Flask routes and validation, SQLite storage, and Excel processing with openpyxl and Pillow |
| `tests/` | Automated tests for contact management and Excel import and export |
| `wsgi.py` | WSGI entry point for PythonAnywhere |

```bash
python -m unittest discover -s tests -v
```

When deploying an update to PythonAnywhere, pull the latest code, install `requirements.txt` in the web app's configured virtual environment, and reload the web app.

See the [coding standards](CODE_STANDARDS.md), [project plan](项目计划.md), and [English assignment blog draft](BLOG_EN.md).
