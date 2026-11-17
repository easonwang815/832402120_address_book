| Item | Content |
| --- | --- |
| Course for This Assignment | Software Engineering (FZU–MU) |
| Team Name | [Add team name] |
| Assignment Requirements | [Extreme Programming](https://bbs.csdn.net/topics/620593436) |
| Objectives of This Assignment | Work together to develop a contact management application with favorites, multiple contact methods, and Excel import and export. |
| Other References | [Flask documentation](https://flask.palletsprojects.com/), [SQLite documentation](https://www.sqlite.org/docs.html), [openpyxl documentation](https://openpyxl.readthedocs.io/) |

# Extreme Programming: A Contact Management Web App

> **Author:** [Your name and student ID]  
> **Team:** Wang Yizhen (832402120) and Xu Zidong (832402124)

## Contents

1. [Project Overview](#1-project-overview)
2. [Teamwork and Contributions](#2-teamwork-and-contributions)
3. [Technology and Architecture](#3-technology-and-architecture)
4. [Feature Implementation](#4-feature-implementation)
5. [UI Design and Interaction Details](#5-ui-design-and-interaction-details)
6. [Feature Screenshots](#6-feature-screenshots)
7. [Git Commit History](#7-git-commit-history)
8. [Challenges and Solutions](#8-challenges-and-solutions)
9. [Personal PSP Table](#9-personal-psp-table)
10. [Reflection](#10-reflection)

## 1. Project Overview

This project is a web-based address book for managing contact information. Users can create and edit contacts, mark favorites, store multiple contact methods, and import or export contacts through Excel. We also added features such as tags, birthday reminders, duplicate detection, and batch management to make the address book more convenient to use.

- **GitHub repository:** [832402120_address_book](https://github.com/easonwang815/832402120_address_book)
- **Online application:** [Contacts on PythonAnywhere](https://eason.pythonanywhere.com/)
- **Code standards:** [CODE_STANDARDS.md](https://github.com/easonwang815/832402120_address_book/blob/main/CODE_STANDARDS.md)
- **Release:** [v1.0](https://github.com/easonwang815/832402120_address_book/releases/tag/v1.0)
- **Pull request:** [Update online demo Excel availability](https://github.com/easonwang815/832402120_address_book/pull/1)

> [Before publishing: confirm that the online application and repository contain the final version described below.]

## 2. Teamwork and Contributions

We discussed the project requirements and agreed on the overall architecture before implementation. The primary responsibility for the application architecture and integration was assigned to the main contributor, while the second contributor was planned to focus on Excel import/export and testing. Both team members should participate in coding and record their actual work.

| Member | Responsibilities actually completed | Contribution |
| --- | --- | ---: |
| Wang Yizhen (832402120) | [Describe the work actually completed] | [ ]% |
| Xu Zidong (832402124) | [Describe the work actually completed] | [ ]% |
| **Total** | | **100%** |

> [Replace the placeholders with the actual division of work and agreed contribution percentages.]

## 3. Technology and Architecture

The application uses a single repository with separate frontend and backend directories. Flask serves both the frontend files and the API, while SQLite stores contact data.

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript | Page layout, user interactions, and API requests |
| Backend | Python and Flask | Request handling, validation, and application logic |
| Database | SQLite | Persistent storage for contacts and related information |
| Excel | openpyxl and Pillow | Read and write `.xlsx` files and generate photo previews |
| Deployment | PythonAnywhere | Host the Flask application online |

```text
Browser: HTML / CSS / JavaScript
              ↕ HTTP requests and responses
Flask: static files and API endpoints
       ├── Contact management → SQLite
       └── Excel import/export → openpyxl
```

The browser sends requests to the Flask API. The backend validates the input, reads or writes the SQLite database, and returns results to the frontend. The database allows saved contacts to remain available after refreshing or reopening the application.

## 4. Feature Implementation

### 4.1 Contact Management and Persistence

Users can add, view, edit, and delete contacts. The editor collects the contact's name, avatar, birthday, notes, tags, and contact methods. The frontend sends the data to the backend as JSON. Flask validates the request and stores the information in SQLite. When a contact is selected, the frontend displays the saved details in the right-hand panel.

When a contact is deleted, its associated contact methods and relationships are also removed. The database is stored on the machine running the application, so the local and deployed versions have separate data.

### 4.2 Favorite Contacts

Each contact has a favorite status in the database. Clicking the star changes that status through an API request. After the update, the interface refreshes the contact list and the favorite count. The **Favorites** view filters the list to show marked contacts.

### 4.3 Multiple Contact Methods

Contact methods are stored separately from the main contact record and linked by contact ID. This one-to-many relationship allows a contact to have multiple phone numbers, email addresses, social accounts, and addresses. In the editor, users can add multiple entries; in the detail panel, entries are grouped by type.

For valid phone numbers and email addresses, the detail panel provides call or email links. A copy button is also available for each contact method.

### 4.4 Excel Import and Export

The backend uses openpyxl to generate and read `.xlsx` files. During export, each contact occupies one row. Fields such as name, favorite status, birthday, notes, tags, and different types of contact methods use separate columns. Multiple values of the same type are placed in separate columns.

The exported file displays a photo thumbnail or Emoji avatar. The original avatar data is stored in hidden columns so that it can be restored when the workbook is imported. The workbook does not export groups. Users should keep the hidden avatar columns if they want to retain avatars when importing the file again.

During import, the backend checks the workbook and then adds contacts to the existing database. Blank rows are ignored, rows without a name are skipped, and other invalid data cancels the import. Database changes are performed in a transaction so that a failed import does not leave partially imported contacts. Importing the same workbook more than once may create duplicates.

### 4.5 Search, Tags, and Recently Added

The search box filters contacts using their name, phone number, or email address. Users can sort the list by name or creation time. Tags can be selected or created in the contact editor and used to filter contacts. The **Recently Added** view sorts contacts by creation time and shows when each was added.

### 4.6 Birthdays

A birthday can be stored with each contact. The birthday view calculates the number of days until each person's next birthday and sorts the list by proximity. Birthdays within 30 days receive a visual reminder, and the sidebar displays the number of contacts with birthdays.

### 4.7 Duplicate Detection and Batch Management

When a new contact is saved, the application checks existing contacts for a matching name, phone number, or email address. If it finds a possible match, it asks whether the user wants to review a merge. The merge dialog lets the user choose which contact to keep; the application combines information such as contact methods, tags, and notes, and asks the user to resolve conflicting birthdays.

For batch management, users can select multiple contacts and apply an operation such as adding or removing favorites, adding or removing a tag, or deleting contacts. The backend verifies the selected IDs before applying the operation.

## 5. UI Design and Interaction Details

### 5.1 Three-Column Workspace

We organized the application into three areas: navigation and tags on the left, the contact list in the middle, and contact details on the right. This layout keeps navigation, selection, and detailed information visible together, so users can move between contacts without repeatedly opening separate pages.

### 5.2 Apple-Inspired Visual Style

The interface takes inspiration from Apple-style application design and Liquid Glass materials. We use a light background, blue accents, soft borders, translucent controls, and restrained shadows to create depth while keeping contact information readable. The contact profile is the visual focus, while the rest of the interface remains practical for everyday use.

### 5.3 Small Design Choices

- **Coordinated avatars and backgrounds:** Contacts without a photo use a colored initial avatar, and users can also choose an Emoji. The profile background uses a matching preset color and transitions when another contact is selected.
- **Colorful tags:** Tags use consistent colors in the sidebar and contact details, making the same tag easier to recognize in different parts of the interface.
- **Favorite feedback:** A filled star distinguishes favorites, and a short animation gives feedback when the state changes.
- **Glass-style actions:** Call, email, and message shortcuts are placed in a compact translucent toolbar near the profile header.
- **Clear contact actions:** Call, email, and copy controls are placed next to the corresponding contact information.
- **Reduced motion:** Transitions are reduced when the user's system requests reduced motion.
- **Dark mode:** Users can switch between light and dark themes, and the theme preference is saved in the browser.

## 6. Feature Screenshots

> [Replace each placeholder with an actual screenshot using demonstration contacts. To keep the blog concise, combine related views into one image where suggested.]

### 6.1 Contact Management and Multiple Contact Methods

The main workspace shows the contact list and the selected person's details. The editor supports multiple phone numbers, email addresses, social accounts, and addresses, as well as an avatar, birthday, tags, and notes.

**[Insert screenshot 1: main workspace and contact details]**

**[Insert screenshot 2: contact editor with multiple contact methods]**

### 6.2 Favorites, Search, and Tags

Users can mark a contact as a favorite, search by name or contact method, and filter contacts by tag. Colored tags remain consistent between the sidebar and the detail panel.

**[Insert screenshot 3: Favorites view showing the search box and tags]**

### 6.3 Excel Import and Export

The toolbar provides import and export controls. In the exported workbook, each contact occupies a row, with information organized into separate columns and a photo or Emoji displayed in the photo column.

**[Insert screenshot 4: import/export controls and import result]**

**[Insert screenshot 5: exported Excel workbook]**

### 6.4 Birthdays and Batch Management

The birthday view sorts contacts by their next birthday and highlights upcoming dates. Batch selection allows the same action to be applied to several contacts.

**[Insert screenshot 6: birthday view with an upcoming birthday]**

**[Insert screenshot 7: batch selection and available actions]**

### 6.5 Duplicate Detection and Dark Mode

When a possible duplicate is found while adding a contact, the application offers a merge review. The dark theme provides an alternative appearance and saves the user's preference in the browser.

**[Insert screenshot 8: duplicate merge dialog in dark mode]**

## 7. Git Commit History

**[Insert screenshot: GitHub commit history]**

| Member | GitHub account | Number of commits |
| --- | --- | ---: |
| Wang Yizhen | easonwang815 | [Actual count] |
| Xu Zidong | Xzd6128127-coder | [Actual count] |

> [Check the repository history and fill in the actual number of commits by each contributor.]

## 8. Challenges and Solutions

> [Replace the prompts below with problems the team actually encountered and how they were resolved.]

### Challenge 1: [Describe a real challenge]

- **Problem:** [What happened, and why did it affect the work?]
- **Solution:** [What did the team do, and what was the result?]

### Challenge 2: [Describe a real challenge]

- **Problem:** [Describe the issue.]
- **Solution:** [Describe the solution and any cooperation involved.]

## 9. Personal PSP Table

**Student:** [Your name and student ID]  
**Unit:** minutes

| Stage | Estimated time | Actual time |
| --- | ---: | ---: |
| Requirements analysis and discussion | [ ] | [ ] |
| Design | [ ] | [ ] |
| Coding and implementation | [ ] | [ ] |
| Testing and debugging | [ ] | [ ] |
| Documentation and blog | [ ] | [ ] |
| **Total** | [ ] | [ ] |

> [Each student should include their own PSP table and fill in actual time spent.]

## 10. Reflection

[Write your own reflection on the development process: what you contributed, what you learned from working with your teammate, and what you would improve in a future version.]
