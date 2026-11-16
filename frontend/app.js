const $ = (selector) => document.querySelector(selector);
const state = { contacts: [], groups: [], selected: null, view: 'all', group: null, avatar: '', batch: false, checked: new Set(), visible: [], duplicatePairs: [] };
const dialog = $('#editor');
const form = $('#contact-form');

const iconPaths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  moon: '<path d="M20.7 14.2A9 9 0 0 1 9.8 3.3a9 9 0 1 0 10.9 10.9Z"/>',
  edit: '<path d="m4 16 11-11a2.8 2.8 0 0 1 4 4L8 20l-5 1Zm9-9 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6"/>',
  overview: '<path d="M4 19V5m0 14h16M9 15v-4m5 4V7m5 8V9"/>',
  phone: '<path d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  tag: '<path d="M3 4h8l10 10-7 7L3 10Z"/><circle cx="7" cy="8" r="1"/>',
  note: '<path d="M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H6l-3 2v-5a8.5 8.5 0 1 1 18-5.5Z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>'
};

function icon(name) {
  return `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

document.querySelectorAll('[data-icon]').forEach((element) => {
  element.innerHTML = icon(element.dataset.icon);
});

const methodLabels = { '电话': 'Phone', '邮箱': 'Email', '社交账号': 'Social', '地址': 'Address', '其他': 'Other' };
const errorLabels = { '请输入联系人姓名': 'Please enter a contact name.', '请填写完整的联系方式': 'Please complete the contact details.', '分组或标签格式有误': 'Invalid groups or tags.', '联系人信息格式有误': 'Invalid contact information.', '所选分组不存在': 'The selected group no longer exists.', '联系人不存在': 'Contact not found.', '请输入分组名称': 'Please enter a group name.', '分组名称已存在': 'This group already exists.', '头像太大，请选择小于 1 MB 的图片': 'Please select an image smaller than 1 MB.' };

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(errorLabels[data.error] || data.error || 'Something went wrong. Please try again.');
  }
  return response.status === 204 ? null : response.json();
}
function notify(text) {
  const toast = $('#toast');
  toast.textContent = text;
  toast.style.display = 'block';
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.style.display = 'none'; }, 2500);
}
function avatar(person, large = false) {
  const cls = `${large ? 'avatar hero-avatar' : 'avatar'} avatar-tone-${person.id % 5}`;
  if (person.avatar?.startsWith('emoji:')) return `<span class="${cls} emoji-avatar">${esc(person.avatar.slice(6))}</span>`;
  return person.avatar && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(person.avatar)
    ? `<img class="${cls}" src="${esc(person.avatar)}" alt="">`
    : `<span class="${cls}">${esc(person.name.trim().charAt(0).toUpperCase())}</span>`;
}
function tagTone(tag) {
  let hash = 0;
  for (const char of tag.toLocaleLowerCase()) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return hash % 5;
}
function recent(person) {
  const age = Date.now() - createdTime(person);
  return age >= 0 && age < 7 * 86400000;
}
function createdTime(person) {
  const value = person.created_at.replace(' ', 'T');
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + 'Z').getTime();
}
function addedDate(person) {
  const time = createdTime(person);
  return Number.isNaN(time) ? person.created_at : new Intl.DateTimeFormat('en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(time));
}
function nextBirthday(birthday) {
  if (!birthday) return null;
  const parts = birthday.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  function occurrence(year) {
    const month = parts[1] - 1;
    const day = parts[1] === 2 && parts[2] === 29 && new Date(year, 1, 29).getMonth() !== 1 ? 28 : parts[2];
    return new Date(year, month, day);
  }
  let next = occurrence(today.getFullYear());
  if (next < today) next = occurrence(today.getFullYear() + 1);
  return Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

function syncMenu(select, menu) {
  const value = menu.querySelector('.menu-value');
  value.textContent = select.selectedOptions[0]?.textContent || '';
  const options = menu.querySelector('.menu-options');
  options.replaceChildren();
  for (const option of select.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.textContent;
    button.setAttribute('aria-label', option.textContent);
    button.className = option.selected ? 'menu-option selected-option' : 'menu-option';
    button.setAttribute('aria-pressed', String(option.selected));
    button.onclick = () => {
      select.value = option.value;
      menu.open = false;
      select.dispatchEvent(new Event('change'));
      menu.querySelector('summary').focus();
    };
    options.append(button);
  }
}

document.addEventListener('click', (event) => {
  document.querySelectorAll('.filter-menu[open]').forEach((menu) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const menu = document.querySelector('.filter-menu[open]');
  if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
});

async function refresh() {
  [state.contacts, state.groups] = await Promise.all([api('/api/contacts'), api('/api/groups')]);
  render();
}
function render() {
  const all = state.contacts;
  const favorites = all.filter((p) => p.favorite).length;
  const recentCount = all.filter(recent).length;
  $('#total').textContent = $('#stat-total').textContent = all.length;
  $('#favorites-count').textContent = $('#stat-favorites').textContent = favorites;
  $('#recent-count').textContent = $('#stat-recent').textContent = recentCount;
  $('#birthdays-count').textContent = all.filter((p) => p.birthday).length;
  document.querySelectorAll('#navigation .nav').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  const filter = $('#tag-filter');
  const previous = filter.value;
  const tags = [...new Set(all.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, 'zh'));
  filter.innerHTML = '<option value="">All tags</option>' + tags.map((tag) => `<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
  filter.value = tags.includes(previous) ? previous : '';
  syncMenu($('#sort'), $('#sort-menu'));
  syncMenu(filter, $('#tag-menu'));
  $('#stat-tags').textContent = tags.length;
  $('#tags').innerHTML = tags.map((tag, index) => `<button class="nav tag-nav ${filter.value === tag ? 'active' : ''}" data-tag-index="${index}"><span class="group-dot tag-tone-${tagTone(tag)}" aria-hidden="true"></span><span class="group-name">${esc(tag)}</span><b>${all.filter((person) => person.tags.includes(tag)).length}</b></button>`).join('');
  if (!tags.length) $('#tags').innerHTML = '<p class="tag-empty">Add tags when editing a contact</p>';
  let list = all.filter((p) => {
    if (state.view === 'favorites' && !p.favorite) return false;
    if (state.view === 'recent' && !recent(p)) return false;
    if (state.view === 'birthdays' && !p.birthday) return false;
    if (state.view === 'group' && !p.groups.some((g) => g.id === state.group)) return false;
    if (filter.value && !p.tags.includes(filter.value)) return false;
    const query = $('#search').value.trim().toLowerCase();
    return !query || [p.name, ...p.methods.filter((m) => ['电话', '邮箱'].includes(m.type)).map((m) => m.value)].some((v) => v.toLowerCase().includes(query));
  });
  const sort = $('#sort').value;
  list.sort((a, b) => {
    if (state.view === 'birthdays') return nextBirthday(a.birthday) - nextBirthday(b.birthday);
    if (state.view === 'recent' || sort === 'recent') return createdTime(b) - createdTime(a) || b.id - a.id;
    if (sort === 'oldest') return createdTime(a) - createdTime(b) || a.id - b.id;
    return a.name.localeCompare(b.name, 'zh');
  });
  $('#sort-menu').hidden = state.view === 'birthdays' || state.view === 'recent';
  state.visible = list.map((p) => p.id);
  $('#batch-actions').hidden = !state.batch;
  $('#batch-toggle').textContent = state.batch ? 'Done' : 'Select';
  $('#selected-count').textContent = `${state.checked.size} selected`;
  $('#select-all').checked = list.length > 0 && list.every((p) => state.checked.has(p.id));
  $('#select-all').indeterminate = list.some((p) => state.checked.has(p.id)) && !$('#select-all').checked;
  $('#list-title').textContent = filter.value || ({all:'All Contacts',favorites:'Favorites',recent:'Recently Added',overview:'All Contacts',birthdays:'Birthdays',duplicates:'All Contacts'}[state.view]);
  $('#list-heading').textContent = `${list.length} ${list.length === 1 ? 'contact' : 'contacts'}`;
  const isOverview = state.view === 'overview';
  $('#overview-page').hidden = !isOverview;
  $('#detail').hidden = isOverview;
  $('#overview-recent').innerHTML = all.filter(recent).sort((a, b) => createdTime(b) - createdTime(a) || b.id - a.id).slice(0, 5).map((person) => `<button type="button" class="overview-contact" data-contact="${person.id}">${avatar(person)}<span>${esc(person.name)}</span><span class="overview-date">${esc(addedDate(person))}</span></button>`).join('') || '<p class="muted">No recently added contacts.</p>';
  if (!list.some((p) => p.id === state.selected)) state.selected = list[0]?.id ?? null;
  $('#contact-list').innerHTML = list.length ? list.map((p) => `<div class="contact-row ${p.id === state.selected ? 'selected' : ''}" data-id="${p.id}" tabindex="0" role="button">${state.batch ? `<input type="checkbox" class="batch-check" data-check="${p.id}" aria-label="Select ${esc(p.name)}" ${state.checked.has(p.id) ? 'checked' : ''}>` : ''}${avatar(p)}<span class="contact-label"><span class="contact-name">${esc(p.name)}</span>${state.view === 'birthdays' ? `<span class="contact-preview">🎂 ${esc(p.birthday)} · ${nextBirthday(p.birthday) === 0 ? 'Today' : `in ${nextBirthday(p.birthday)} days`}${nextBirthday(p.birthday) <= 30 ? ' · Coming soon' : ''}</span>` : state.view === 'recent' ? `<span class="contact-preview">Added ${esc(addedDate(p))}</span>` : p.methods[0] ? `<span class="contact-preview">${esc(p.methods[0].value)}</span>` : ''}</span>${state.view === 'birthdays' && nextBirthday(p.birthday) <= 30 ? '<span class="birthday-badge">🎂 Soon</span>' : ''}<button class="star" aria-pressed="${p.favorite}" data-favorite="${p.id}" aria-label="${p.favorite ? 'Remove from favorites' : 'Add to favorites'}">${icon('star')}</button></div>`).join('') : '<p class="muted">No contacts found</p>';
  renderDetail();
}
function renderDetail() {
  const person = state.contacts.find((p) => p.id === state.selected);
  $('#detail').dataset.tone = person ? String(person.id % 5) : '';
  if (!person) {
    $('#detail').innerHTML = '<div class="empty-state"><div><strong>No contact selected</strong>Adjust your filters or add a contact.</div></div>';
    return;
  }
  const order = ['电话', '邮箱', '社交账号', '地址', '其他'];
  const sortedMethods = person.methods.map((method, index) => ({ ...method, index }))
    .sort((a, b) => (order.indexOf(a.type) < 0 ? order.length : order.indexOf(a.type)) - (order.indexOf(b.type) < 0 ? order.length : order.indexOf(b.type)));
  const methods = sortedMethods.length ? sortedMethods.map((method) => {
    const phone = method.type === '电话' && /^[+\d\s().-]+$/.test(method.value) ? method.value.replace(/[\s().-]/g, '') : '';
    const email = method.type === '邮箱' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(method.value) ? method.value : '';
    const action = phone ? `<a class="method-action" href="tel:${esc(phone)}">${icon('phone')}<span>Call</span></a>` : email ? `<a class="method-action" href="mailto:${esc(email)}">${icon('mail')}<span>Email</span></a>` : '';
    return `<div class="method"><span class="method-type">${esc(methodLabels[method.type] || method.type)}</span><span class="method-value">${esc(method.value)}</span>${action}<button class="copy" data-copy="${method.index}" aria-label="Copy ${esc(methodLabels[method.type] || method.type)}" title="Copy">${icon('copy')}</button></div>`;
  }).join('') : '<span class="muted">No contact information</span>';
  const validPhone = person.methods.find((method) => method.type === '电话' && /^[+\d\s().-]+$/.test(method.value));
  const validEmail = person.methods.find((method) => method.type === '邮箱' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(method.value));
  const number = validPhone ? validPhone.value.replace(/[\s().-]/g, '') : '';
  const quickAction = (label, glyph, url) => url
    ? `<a class="quick-action" href="${esc(url)}">${icon(glyph)}<span>${label}</span></a>`
    : `<span class="quick-action unavailable" aria-disabled="true">${icon(glyph)}<span>${label}</span></span>`;
  const tagChips = person.tags.map((tag) => `<span class="chip tag-tone-${tagTone(tag)}">${esc(tag)}</span>`);
  $('#detail').innerHTML = `
    <div class="detail-hero">
      <div class="identity">
        <div class="hero-portrait">${avatar(person, true)}
          ${person.favorite ? `<span class="favorite-badge" aria-label="Favorite">${icon('star')}</span>` : ''}
        </div>
        <div>
          <h1>${esc(person.name)}</h1>
          <p class="joined">${esc(person.created_at.slice(0, 10))} added</p>
        </div>
      </div>
      <div class="detail-actions">
        <button class="hero-action" id="edit" type="button" title="Edit contact">${icon('edit')}<span>Edit</span></button>
        <button class="hero-action" id="delete" type="button" aria-label="Delete contact" title="Delete contact">${icon('trash')}</button>
      </div>
    </div>
    <div class="quick-actions" aria-label="Contact actions">
      ${quickAction('Call', 'phone', number ? `tel:${number}` : '')}
      ${quickAction('Email', 'mail', validEmail ? `mailto:${validEmail.value}` : '')}
      ${quickAction('Message', 'message', number ? `sms:${number}` : '')}
    </div>
    <div class="detail-sheet">
      <section class="detail-card">
        <div class="detail-card-heading">
          <h3>${icon('phone')}Contact Information</h3>
          <button id="add-detail-method" class="text-button" type="button">${icon('plus')}Add</button>
        </div>
        ${methods}
      </section>
      <section class="detail-card">
        <h3>${icon('tag')}Tags</h3>
        <div class="chips">${tagChips.join('') || '<span class="muted">No tags yet</span>'}</div>
      </section>
      <section class="detail-card"><h3><span aria-hidden="true">🎂</span> Birthday</h3><div>${person.birthday ? `${esc(person.birthday)} · ${nextBirthday(person.birthday) === 0 ? 'Today' : `in ${nextBirthday(person.birthday)} days`}` : '<span class="muted">No birthday added</span>'}</div></section>
      <section class="detail-card">
        <h3>${icon('note')}Notes</h3>
        <div class="contact-notes">${person.notes ? esc(person.notes) : '<span class="muted">No notes yet</span>'}</div>
      </section>
    </div>`;
}
function editMethod(method = {type:'电话', value:''}) {
  const row = document.createElement('div');
  row.className = 'method-edit';
  row.innerHTML = `<select aria-label="Contact type">${['电话','邮箱','社交账号','地址','其他'].map((type) => `<option value="${type}" ${method.type === type ? 'selected' : ''}>${methodLabels[type]}</option>`).join('')}</select><input aria-label="Contact detail" placeholder="Enter contact detail" value="${esc(method.value)}"><button type="button" class="remove-method" aria-label="Remove contact detail">✕</button>`;
  row.querySelector('button').onclick = () => row.remove();
  $('#method-list').append(row);
}
let editorTags = new Set();
let extraTags = [];
function renderEditorTags() {
  const tags = [...new Set([...state.contacts.flatMap((person) => person.tags), ...editorTags, ...extraTags])]
    .sort((a, b) => a.localeCompare(b, 'en'));
  $('#editor-tags').innerHTML = tags.length ? tags.map((tag, index) =>
    `<label class="editor-tag"><input type="checkbox" data-editor-tag="${index}" ${editorTags.has(tag) ? 'checked' : ''}><span class="tag-tone-${tagTone(tag)}">${esc(tag)}</span></label>`
  ).join('') : '<span class="muted">No tags yet</span>';
  $('#editor-tags').tagNames = tags;
}
$('#editor-tags').onchange = (event) => {
  const checkbox = event.target.closest('[data-editor-tag]');
  if (!checkbox) return;
  const tag = $('#editor-tags').tagNames[Number(checkbox.dataset.editorTag)];
  if (checkbox.checked) editorTags.add(tag); else editorTags.delete(tag);
};
$('#create-tag').onclick = () => {
  const input = $('#new-tag');
  const value = input.value.trim();
  if (!value) { input.focus(); return; }
  const existing = [...state.contacts.flatMap((person) => person.tags), ...editorTags, ...extraTags]
    .find((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase());
  const tag = existing || value;
  if (!existing) extraTags.push(tag);
  editorTags.add(tag);
  input.value = '';
  renderEditorTags();
  input.focus();
};
$('#new-tag').onkeydown = (event) => {
  if (event.key === 'Enter') { event.preventDefault(); $('#create-tag').click(); }
};

function openEditor(person = null) {
  form.reset();
  form.dataset.id = person?.id ?? '';
  state.avatar = person?.avatar ?? '';
  form.elements.name.value = person?.name ?? '';
  form.elements.notes.value = person?.notes ?? '';
  form.elements.birthday.value = person?.birthday ?? '';
  form.elements.birthday.max = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  editorTags = new Set(person?.tags ?? []);
  extraTags = [];
  $('#new-tag').value = '';
  renderEditorTags();
  form.elements.favorite.checked = person?.favorite ?? false;
  $('#form-title').textContent = person ? 'Edit contact' : 'Add Contact';
  renderEmojiOptions();
  $('#form-error').textContent = '';
  $('#method-list').replaceChildren();
  (person?.methods ?? []).forEach(editMethod);
  dialog.showModal();
  form.elements.name.focus();
}
$('#new-contact').onclick = () => openEditor();
$('#add-method').onclick = () => editMethod();
$('#cancel').onclick = $('#close-editor').onclick = () => dialog.close();
const emojiChoices = ['😀', '😊', '😎', '🥳', '🐱', '🐶', '🦊', '🐼', '🌻', '🌙', '⭐', '🎨'];
function renderEmojiOptions() {
  $('#emoji-options').innerHTML = emojiChoices.map((emoji) => `<button type="button" class="emoji-choice ${state.avatar === 'emoji:' + emoji ? 'selected' : ''}" data-emoji="${emoji}" aria-label="Use ${emoji} as avatar" aria-pressed="${state.avatar === 'emoji:' + emoji}">${emoji}</button>`).join('');
}
$('#emoji-options').onclick = (event) => {
  const button = event.target.closest('[data-emoji]');
  if (!button) return;
  state.avatar = 'emoji:' + button.dataset.emoji;
  $('#avatar-file').value = '';
  renderEmojiOptions();
};
$('#clear-avatar').onclick = () => { state.avatar = ''; $('#avatar-file').value = ''; renderEmojiOptions(); };
$('#avatar-file').onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) {
    $('#form-error').textContent = 'Choose a PNG, JPEG, WebP, or GIF under 1 MB.';
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { state.avatar = reader.result; renderEmojiOptions(); $('#form-error').textContent = ''; };
  reader.readAsDataURL(file);
};
form.onsubmit = async (event) => {
  event.preventDefault();
  const methods = [...document.querySelectorAll('.method-edit')].map((row) => ({type:row.querySelector('select').value, value:row.querySelector('input').value.trim()})).filter((m) => m.value);
  const data = { birthday:form.elements.birthday.value, name:form.elements.name.value, notes:form.elements.notes.value, favorite:form.elements.favorite.checked, avatar:state.avatar, methods, groups:state.contacts.find((person) => person.id === Number(form.dataset.id))?.groups.map((group) => group.id) ?? [], tags:[...editorTags] };
  const saveButton = form.querySelector('[type=submit]');
  saveButton.disabled = true;
  try {
    let match = null;
    if (!form.dataset.id) {
      const contacts = await api('/api/contacts');
      const normalize = (method) => method.type === '电话' ? method.value.replace(/[^0-9+]/g, '') : method.value.trim().toLowerCase();
      match = contacts.find((contact) => contact.name.trim().toLowerCase() === data.name.trim().toLowerCase() || data.methods.some((method) => {
        if (!['电话', '邮箱'].includes(method.type)) return false;
        const value = normalize(method);
        if (!value || (method.type === '电话' && value.replace(/\D/g, '').length < 7)) return false;
        return contact.methods.some((existing) => existing.type === method.type && normalize(existing) === value);
      }));
    }
    const shouldMerge = match && confirm(`A contact named ${match.name} matches this name, phone number or email. Save this contact and review a merge?`);
    const saved = await api(form.dataset.id ? `/api/contacts/${form.dataset.id}` : '/api/contacts', {method:form.dataset.id ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    state.selected = saved.id;
    if (!form.dataset.id) {
      state.view = 'all';
      $('#search').value = '';
      $('#tag-filter').value = '';
    }
    dialog.close();
    await refresh();
    notify('Contact saved');
    if (shouldMerge) openMerge({contacts: [match, saved]});
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { saveButton.disabled = false; }
};
$('#overview-recent').onclick = (event) => {
  const button = event.target.closest('[data-contact]');
  if (!button) return;
  state.view = 'all';
  state.selected = Number(button.dataset.contact);
  $('#search').value = '';
  $('#tag-filter').value = '';
  render();
};
$('#navigation').onclick = async (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  state.view = button.dataset.view;
  $('#tag-filter').value = '';
  render();
};
$('#tags').onclick = (event) => {
  const button = event.target.closest('[data-tag-index]');
  if (!button) return;
  const filter = $('#tag-filter');
  const option = filter.options[Number(button.dataset.tagIndex) + 1];
  if (!option) return;
  state.view = 'all';
  filter.value = filter.value === option.value ? '' : option.value;
  render();
};
$('#contact-list').onclick = async (event) => {
  if (event.target.matches('[data-check]')) return;
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    const person = state.contacts.find((p) => p.id === Number(favorite.dataset.favorite));
    try {
      await api(`/api/contacts/${person.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...person, favorite:!person.favorite, groups:person.groups.map((g) => g.id)})});
      await refresh();
      const updated = document.querySelector(`[data-favorite="${person.id}"] .glyph`);
      if (updated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        updated.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }],
          { duration: 240, easing: 'cubic-bezier(.32,.72,0,1)' });
      }
    } catch (error) { notify(error.message); }
    return;
  }
  const row = event.target.closest('[data-id]');
  if (row && state.batch) {
    const id = Number(row.dataset.id);
    if (state.checked.has(id)) state.checked.delete(id); else state.checked.add(id);
    render();
    return;
  }
  if (row) {
    const previous = state.selected;
    const wasOverview = state.view === 'overview';
    if (wasOverview) state.view = 'all';
    state.selected = Number(row.dataset.id);
    if (wasOverview) {
      render();
    } else {
      document.querySelectorAll('.contact-row').forEach((item) => {
        item.classList.toggle('selected', Number(item.dataset.id) === state.selected);
      });
      renderDetail();
    }
    if (previous !== state.selected && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('#detail').animate(
        [{ opacity: 0.75, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(.25, 1, .5, 1)' }
      );
    }
  }
};
$('#contact-list').onkeydown = (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-id]')) { event.preventDefault(); event.target.click(); } };
$('#detail').onclick = async (event) => {
  const person = state.contacts.find((p) => p.id === state.selected);
  if (!person) return;
  if (event.target.closest('#edit')) openEditor(person);
  if (event.target.closest('#add-detail-method')) {
    openEditor(person);
    editMethod();
    $('#method-list .method-edit:last-child input').focus();
  }
  if (event.target.closest('#delete') && confirm(`Delete ${person.name}?`)) {
    try { await api(`/api/contacts/${person.id}`, {method:'DELETE'}); state.selected = null; await refresh(); notify('Contact deleted'); } catch (error) { notify(error.message); }
  }
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(person.methods[Number(copy.dataset.copy)].value); notify('Copied'); } catch { notify('Copy failed. Please copy the text manually.'); }
  }
};
$('#search').oninput = render;
$('#sort').onchange = render;
$('#tag-filter').onchange = render;
function setTheme(dark) { document.body.classList.toggle('dark', dark); $('#theme').innerHTML = icon(dark ? 'moon' : 'sun'); $('#theme').setAttribute('aria-pressed', dark); localStorage.setItem('theme', dark ? 'dark' : 'light'); }
setTheme(localStorage.getItem('theme') === 'dark');
$('#theme').onclick = () => setTheme(!document.body.classList.contains('dark'));
refresh().catch((error) => notify(error.message));

$('#contact-list').addEventListener('change', (event) => {
  if (!event.target.matches('[data-check]')) return;
  const id = Number(event.target.dataset.check);
  if (event.target.checked) state.checked.add(id); else state.checked.delete(id);
  render();
});
$('#batch-toggle').onclick = () => { state.batch = !state.batch; state.checked.clear(); render(); };
$('#select-all').onchange = (event) => {
  for (const id of state.visible) {
    if (event.target.checked) state.checked.add(id); else state.checked.delete(id);
  }
  render();
};
$('#batch-apply').onclick = async () => {
  const ids = [...state.checked];
  if (!ids.length) { notify('Select at least one contact'); return; }
  const action = $('#batch-action').value;
  let tag = '';
  if (action === 'delete' && !confirm(`Delete ${ids.length} selected contacts? This cannot be undone.`)) return;
  if (action === 'add_tag' || action === 'remove_tag') {
    const entered = prompt(action === 'add_tag' ? 'Tag to add' : 'Tag to remove');
    if (entered === null) return;
    tag = entered.trim();
    if (!tag) { notify('Enter a tag'); return; }
  }
  const button = $('#batch-apply');
  button.disabled = true;
  try {
    await api('/api/contacts/batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids, action, tag})});
    state.checked.clear();
    await refresh();
    notify(`Updated ${ids.length} contacts`);
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; }
};
let mergePair = null;
function openMerge(pair) {
  mergePair = pair;
  $('#merge-options').innerHTML = pair.contacts.map((person, index) => `<label class="merge-choice"><input type="radio" name="target" value="${person.id}" ${index === 0 ? 'checked' : ''}> ${avatar(person)} <span><strong>${esc(person.name)}</strong><br><small>${person.methods.map((m) => esc(m.value)).join(' · ') || 'No contact information'}${person.birthday ? ' · ' + esc(person.birthday) : ''}</small></span></label>`).join('');
  const birthdays = [...new Set(pair.contacts.map((p) => p.birthday).filter(Boolean))];
  $('#merge-birthday').innerHTML = birthdays.length > 1 ? `<label>Birthday to keep <select name="birthday" required><option value="">Choose a birthday</option>${birthdays.map((day) => `<option value="${esc(day)}">${esc(day)}</option>`).join('')}</select></label>` : '';
  $('#merge-error').textContent = '';
  $('#merge-dialog').showModal();
}
$('#merge-close').onclick = $('#merge-cancel').onclick = () => $('#merge-dialog').close();
$('#merge-form').onsubmit = async (event) => {
  event.preventDefault();
  const target = Number(new FormData(event.currentTarget).get('target'));
  const birthday = new FormData(event.currentTarget).get('birthday');
  const button = event.currentTarget.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const result = await api('/api/contacts/merge', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids:mergePair.contacts.map((p) => p.id), target_id:target, birthday})});
    $('#merge-dialog').close();
    state.checked.clear();
    state.selected = result.id;
    await refresh();
    notify('Contacts merged');
  } catch (error) { $('#merge-error').textContent = error.message; }
  finally { button.disabled = false; }
};
