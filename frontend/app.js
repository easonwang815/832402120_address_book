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
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>'
};

function icon(name) {
  return `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

document.querySelectorAll('[data-icon]').forEach((element) => {
  element.innerHTML = icon(element.dataset.icon);
});

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '操作失败，请稍后重试');
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
  const cls = large ? 'avatar hero-avatar' : 'avatar';
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
  $('#stat-groups').textContent = state.groups.length;
  document.querySelectorAll('#navigation .nav').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  $('#groups').innerHTML = state.groups.map((g) => `<button class="nav ${state.view === 'group' && state.group === g.id ? 'active' : ''}" data-group="${g.id}">${icon('folder')}${esc(g.name)}<b>${all.filter((p) => p.groups.some((item) => item.id === g.id)).length}</b></button>`).join('');
  const filter = $('#tag-filter');
  const previous = filter.value;
  const tags = [...new Set(all.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, 'zh'));
  filter.innerHTML = '<option value="">所有标签</option>' + tags.map((tag) => `<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
  filter.value = tags.includes(previous) ? previous : '';
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
  $('#list-heading').textContent = state.view === 'group' ? state.groups.find((g) => g.id === state.group)?.name || '分组' : ({all:'所有联系人',favorites:'收藏',recent:'最近添加'}[state.view]);
  if (!list.some((p) => p.id === state.selected)) state.selected = list[0]?.id ?? null;
  $('#contact-list').innerHTML = list.length ? list.map((p) => `<div class="contact-row ${p.id === state.selected ? 'selected' : ''}" data-id="${p.id}" tabindex="0" role="button">${avatar(p)}<span class="contact-label"><span class="contact-name">${esc(p.name)}</span>${p.methods[0] ? `<span class="contact-preview">${esc(p.methods[0].value)}</span>` : ''}</span><button class="star" aria-pressed="${p.favorite}" data-favorite="${p.id}" aria-label="${p.favorite ? '取消收藏' : '收藏'}">${icon('star')}</button></div>`).join('') : '<p class="muted">没有找到联系人</p>';
  renderDetail();
}
function renderDetail() {
  const person = state.contacts.find((p) => p.id === state.selected);
  if (!person) {
    $('#detail').innerHTML = '<div class="empty-state"><div><strong>没有可显示的联系人</strong>调整筛选条件或点击“新建联系人”</div></div>';
    return;
  }
  const methods = person.methods.length ? person.methods.map((m, i) => `<div class="method"><span class="method-type">${esc(m.type)}</span><span class="method-value">${esc(m.value)}</span><button class="copy" data-copy="${i}" aria-label="复制${esc(m.type)}">${icon('copy')}</button></div>`).join('') : '<span class="muted">暂无联系方式</span>';
  const groupChips = person.groups.map((group) =>
    `<span class="chip group-chip">${icon('folder')}${esc(group.name)}</span>`
  );
  const tagChips = person.tags.map((tag) => `<span class="chip">${esc(tag)}</span>`);
  $('#detail').innerHTML = `
    <div class="detail-hero">
      <div class="identity">
        <div class="hero-portrait">${avatar(person, true)}
          ${person.favorite ? `<span class="favorite-badge" aria-label="已收藏">${icon('star')}</span>` : ''}
        </div>
        <div>
          <h1>${esc(person.name)}</h1>
          <p class="joined">${esc(person.created_at.slice(0, 10))} 加入通讯录</p>
        </div>
      </div>
      <div class="detail-actions">
        <button class="hero-action" id="edit" type="button" title="编辑联系人">${icon('edit')}<span>编辑</span></button>
        <button class="hero-action" id="delete" type="button" aria-label="删除联系人" title="删除联系人">${icon('trash')}</button>
      </div>
    </div>
    <div class="detail-sheet">
      <section class="detail-card">
        <div class="detail-card-heading">
          <h3>${icon('phone')}联系方式</h3>
          <button id="add-detail-method" class="text-button" type="button">${icon('plus')}添加</button>
        </div>
        ${methods}
      </section>
      <section class="detail-card">
        <h3>${icon('tag')}分组与标签</h3>
        <div class="chips">${[...groupChips, ...tagChips].join('') || '<span class="muted">暂无分组和标签</span>'}</div>
      </section>
      <section class="detail-card">
        <h3>${icon('note')}备注</h3>
        <div class="contact-notes">${person.notes ? esc(person.notes) : '<span class="muted">暂无备注</span>'}</div>
      </section>
    </div>`;
}
function editMethod(method = {type:'电话', value:''}) {
  const row = document.createElement('div');
  row.className = 'method-edit';
  row.innerHTML = `<select aria-label="联系方式类型">${['电话','邮箱','社交账号','地址','其他'].map((type) => `<option ${method.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select><input aria-label="联系方式内容" placeholder="输入联系方式" value="${esc(method.value)}"><button type="button" class="remove-method" aria-label="移除联系方式">✕</button>`;
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
  $('#form-title').textContent = person ? '编辑联系人' : '新增联系人';
  $('#form-error').textContent = '';
  $('#method-list').replaceChildren();
  (person?.methods ?? []).forEach(editMethod);
  $('#group-options').innerHTML = state.groups.length ? state.groups.map((g) => `<label><input type="checkbox" value="${g.id}" ${person?.groups.some((x) => x.id === g.id) ? 'checked' : ''}> ${esc(g.name)}</label>`).join('') : '<span class="muted">请先在侧栏创建分组</span>';
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
    $('#form-error').textContent = '请选择小于 1 MB 的 PNG、JPEG、WebP 或 GIF 图片';
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
  const data = { name:form.elements.name.value, notes:form.elements.notes.value, favorite:form.elements.favorite.checked, avatar:state.avatar, methods, groups:[...document.querySelectorAll('#group-options input:checked')].map((x) => Number(x.value)), tags:form.elements.tags.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) };
  try {
    const saved = await api(form.dataset.id ? `/api/contacts/${form.dataset.id}` : '/api/contacts', {method:form.dataset.id ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    state.selected = saved.id;
    state.view = 'all';
    $('#search').value = '';
    $('#tag-filter').value = '';
    dialog.close();
    await refresh();
    notify('已保存联系人');
  } catch (error) { $('#form-error').textContent = error.message; }
};
$('#navigation').onclick = (event) => { const button = event.target.closest('[data-view]'); if (button) { state.view = button.dataset.view; render(); } };
$('#groups').onclick = (event) => { const button = event.target.closest('[data-group]'); if (button) { state.view = 'group'; state.group = Number(button.dataset.group); render(); } };
$('#add-group').onclick = async () => {
  const name = prompt('请输入分组名称');
  if (!name?.trim()) return;
  try { await api('/api/groups', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name.trim()})}); await refresh(); notify('分组已创建'); } catch (error) { notify(error.message); }
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
  if (event.target.closest('#delete') && confirm(`确定删除 ${person.name} 吗？`)) {
    try { await api(`/api/contacts/${person.id}`, {method:'DELETE'}); state.selected = null; await refresh(); notify('联系人已删除'); } catch (error) { notify(error.message); }
  }
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(person.methods[Number(copy.dataset.copy)].value); notify('已复制'); } catch { notify('复制失败，请手动选择内容'); }
  }
};
$('#search').oninput = render;
$('#sort').onchange = render;
$('#tag-filter').onchange = render;
function setTheme(dark) { document.body.classList.toggle('dark', dark); $('#theme').innerHTML = icon(dark ? 'moon' : 'sun'); $('#theme').setAttribute('aria-pressed', dark); localStorage.setItem('theme', dark ? 'dark' : 'light'); }
setTheme(localStorage.getItem('theme') === 'dark');
$('#theme').onclick = () => setTheme(!document.body.classList.contains('dark'));
refresh().catch((error) => notify(error.message));
