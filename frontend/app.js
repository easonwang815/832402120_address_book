const $ = (selector) => document.querySelector(selector);
const state = { contacts: [], groups: [], selected: null, view: 'all', group: null, avatar: '' };
const dialog = $('#editor');
const form = $('#contact-form');

const iconPaths = {
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
    throw new Error(errorLabels[data.error] || 'Something went wrong. Please try again.');
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
  return person.avatar && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(person.avatar)
    ? `<img class="${cls}" src="${esc(person.avatar)}" alt="">`
    : `<span class="${cls}">${esc(person.name.trim().charAt(0).toUpperCase())}</span>`;
}
function recent(person) {
  const time = new Date(person.created_at.replace(' ', 'T') + 'Z').getTime();
  return Date.now() - time < 7 * 86400000;
}
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
  document.querySelectorAll('#navigation .nav').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  const filter = $('#tag-filter');
  const previous = filter.value;
  const tags = [...new Set(all.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, 'zh'));
  filter.innerHTML = '<option value="">All tags</option>' + tags.map((tag) => `<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
  filter.value = tags.includes(previous) ? previous : '';
  $('#stat-tags').textContent = tags.length;
  $('#tags').innerHTML = tags.map((tag, index) => `<button class="nav tag-nav ${filter.value === tag ? 'active' : ''}" data-tag-index="${index}"><span class="group-dot group-tone-${index % 5}" aria-hidden="true"></span><span class="group-name">${esc(tag)}</span><b>${all.filter((person) => person.tags.includes(tag)).length}</b></button>`).join('');
  if (!tags.length) $('#tags').innerHTML = '<p class="tag-empty">Add tags when editing a contact</p>';
  let list = all.filter((p) => {
    if (state.view === 'favorites' && !p.favorite) return false;
    if (state.view === 'recent' && !recent(p)) return false;
    if (state.view === 'group' && !p.groups.some((g) => g.id === state.group)) return false;
    if (filter.value && !p.tags.includes(filter.value)) return false;
    const query = $('#search').value.trim().toLowerCase();
    return !query || [p.name, ...p.methods.filter((m) => ['电话', '邮箱'].includes(m.type)).map((m) => m.value)].some((v) => v.toLowerCase().includes(query));
  });
  const sort = $('#sort').value;
  list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh') : sort === 'recent' ? b.id - a.id : a.id - b.id);
  $('#list-heading').textContent = state.view === 'group' ? state.groups.find((g) => g.id === state.group)?.name || 'Groups' : ({all:'All Contacts',favorites:'Favorites',recent:'Recently Added'}[state.view]);
  if (filter.value) $('#list-heading').textContent = filter.value;
  $('#list-heading').textContent += ` · ${list.length} ${list.length === 1 ? 'contact' : 'contacts'}`;
  if (!list.some((p) => p.id === state.selected)) state.selected = list[0]?.id ?? null;
  $('#contact-list').innerHTML = list.length ? list.map((p) => `<div class="contact-row ${p.id === state.selected ? 'selected' : ''}" data-id="${p.id}" tabindex="0" role="button">${avatar(p)}<span class="contact-label"><span class="contact-name">${esc(p.name)}</span>${p.methods[0] ? `<span class="contact-preview">${esc(p.methods[0].value)}</span>` : ''}</span><button class="star" aria-pressed="${p.favorite}" data-favorite="${p.id}" aria-label="${p.favorite ? 'Remove from favorites' : 'Add to favorites'}">${icon('star')}</button></div>`).join('') : '<p class="muted">No contacts found</p>';
  renderDetail();
}
function renderDetail() {
  const person = state.contacts.find((p) => p.id === state.selected);
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
    const action = phone ? `<a class="method-action" href="tel:${esc(phone)}">Call</a>` : email ? `<a class="method-action" href="mailto:${esc(email)}">Email</a>` : '';
    return `<div class="method"><span class="method-type">${esc(methodLabels[method.type] || method.type)}</span><span class="method-value">${esc(method.value)}</span>${action}<button class="copy" data-copy="${method.index}" aria-label="Copy ${esc(methodLabels[method.type] || method.type)}" title="Copy">${icon('copy')}</button></div>`;
  }).join('') : '<span class="muted">No contact information</span>';
  const validPhone = person.methods.find((method) => method.type === '电话' && /^[+\d\s().-]+$/.test(method.value));
  const validEmail = person.methods.find((method) => method.type === '邮箱' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(method.value));
  const number = validPhone ? validPhone.value.replace(/[\s().-]/g, '') : '';
  const quickAction = (label, glyph, url) => url
    ? `<a class="quick-action" href="${esc(url)}">${icon(glyph)}<span>${label}</span></a>`
    : `<span class="quick-action unavailable" aria-disabled="true">${icon(glyph)}<span>${label}</span></span>`;
  const tagChips = person.tags.map((tag) => `<span class="chip">${esc(tag)}</span>`);
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
function openEditor(person = null) {
  form.reset();
  form.dataset.id = person?.id ?? '';
  state.avatar = person?.avatar ?? '';
  form.elements.name.value = person?.name ?? '';
  form.elements.notes.value = person?.notes ?? '';
  form.elements.tags.value = person?.tags.join(', ') ?? '';
  form.elements.favorite.checked = person?.favorite ?? false;
  $('#form-title').textContent = person ? 'Edit contact' : 'Add Contact';
  $('#form-error').textContent = '';
  $('#method-list').replaceChildren();
  (person?.methods ?? []).forEach(editMethod);
  dialog.showModal();
  form.elements.name.focus();
}
$('#new-contact').onclick = () => openEditor();
$('#add-method').onclick = () => editMethod();
$('#cancel').onclick = $('#close-editor').onclick = () => dialog.close();
$('#avatar-file').onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) {
    $('#form-error').textContent = 'Choose a PNG, JPEG, WebP, or GIF under 1 MB.';
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { state.avatar = reader.result; $('#form-error').textContent = ''; };
  reader.readAsDataURL(file);
};
form.onsubmit = async (event) => {
  event.preventDefault();
  const methods = [...document.querySelectorAll('.method-edit')].map((row) => ({type:row.querySelector('select').value, value:row.querySelector('input').value.trim()})).filter((m) => m.value);
  const data = { name:form.elements.name.value, notes:form.elements.notes.value, favorite:form.elements.favorite.checked, avatar:state.avatar, methods, groups:state.contacts.find((person) => person.id === Number(form.dataset.id))?.groups.map((group) => group.id) ?? [], tags:form.elements.tags.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) };
  try {
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
  } catch (error) { $('#form-error').textContent = error.message; }
};
$('.dashboard').onclick = (event) => {
  const button = event.target.closest('[data-overview]');
  if (!button) return;
  if (button.dataset.overview === 'tags') {
    $('#tag-filter').focus();
    return;
  }
  state.view = button.dataset.overview;
  $('#search').value = '';
  $('#tag-filter').value = '';
  render();
};
$('#navigation').onclick = (event) => { const button = event.target.closest('[data-view]'); if (button) { state.view = button.dataset.view; $('#tag-filter').value = ''; render(); } };
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
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    const person = state.contacts.find((p) => p.id === Number(favorite.dataset.favorite));
    try { await api(`/api/contacts/${person.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...person, favorite:!person.favorite, groups:person.groups.map((g) => g.id)})}); await refresh(); } catch (error) { notify(error.message); }
    return;
  }
  const row = event.target.closest('[data-id]');
  if (row) { state.selected = Number(row.dataset.id); render(); }
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
