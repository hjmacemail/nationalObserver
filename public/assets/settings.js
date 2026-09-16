document.addEventListener('DOMContentLoaded', async () => {
  const { t, api, showMsg, esc, onLang } = NVO;
  const $ = id => document.getElementById(id);
  const pwOk = p => p.length >= 10 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
  const errText = err => (err.code && t(err.code) !== err.code ? t(err.code) : err.message);
  const fmtDate = iso => { if (!iso) return t('never'); try { return new Intl.DateTimeFormat(NVO.lang === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch (e) { return iso; } };

  let me, ai, users = [], models = null;
  try { me = await api('/api/me'); } catch (e) { return; }
  const isAdmin = me.user.role === 'admin';

  function renderWho() { $('who').textContent = t('signedInAs', { u: me.user.username }) + ' · ' + t(isAdmin ? 'admin' : 'viewer'); }

  // ---------------- AI ----------------
  function renderAI() {
    if (!ai) return;
    const st = $('aiStatus');
    st.className = 'status ' + (ai.broken ? 'bad' : ai.configured ? 'ok' : '');
    $('aiStatusTxt').textContent = ai.broken ? t('aiBroken') : ai.configured ? (ai.source === 'env' ? t('aiOnEnv') : t('aiOn') + ' ' + (ai.keyHint || '')) : t('aiOff');
    $('aiMeta').textContent = ai.updatedAt && ai.source !== 'env' ? t('updated', { d: fmtDate(ai.updatedAt), u: ai.updatedBy || '—' }) : '';
    $('aiRemove').hidden = !(ai.source === 'settings');
    const sel = $('model'), cur = ai.model || 'auto';
    const ids = new Set((models || []).map(m => m.id));
    let html = `<option value="auto">${esc(t('modelAuto'))}${ai.resolvedModel && cur === 'auto' ? ' — ' + esc(ai.resolvedModel) : ''}</option>`;
    (models || []).forEach(m => { html += `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.id)})</option>`; });
    if (cur !== 'auto' && !ids.has(cur)) html += `<option value="${esc(cur)}">${esc(cur)}</option>`;
    sel.innerHTML = html; sel.value = cur;
  }
  async function loadAI() { ai = await api('/api/settings/ai'); renderAI(); }

  $('toggleKey').addEventListener('click', () => {
    const i = $('apiKey'), show = i.type === 'password';
    i.type = show ? 'text' : 'password'; $('toggleKey').textContent = t(show ? 'hide' : 'show'); $('toggleKey').dataset.t = show ? 'hide' : 'show';
  });
  $('aiForm').addEventListener('submit', async e => {
    e.preventDefault();
    const key = $('apiKey').value.trim(), btn = $('aiSave');
    if (key && !/^sk-ant-/.test(key)) return showMsg($('aiMsg'), 'err', t('format'));
    btn.disabled = true; btn.textContent = t('saving');
    try {
      ai = await api('/api/settings/ai', { method: 'PUT', body: { apiKey: key || undefined, model: $('model').value } });
      $('apiKey').value = ''; renderAI(); showMsg($('aiMsg'), 'ok', t('saved'));
    } catch (err) { showMsg($('aiMsg'), 'err', errText(err)); }
    finally { btn.disabled = false; btn.textContent = t('save'); }
  });
  $('aiTest').addEventListener('click', async () => {
    const btn = $('aiTest'); btn.disabled = true; btn.textContent = t('testing');
    try {
      const r = await api('/api/settings/ai/test', { method: 'POST', body: { apiKey: $('apiKey').value.trim() || undefined } });
      models = r.models; renderAI(); showMsg($('aiMsg'), 'ok', t('testOk', { n: r.models.length }));
    } catch (err) {
      showMsg($('aiMsg'), 'err', err.code === 'invalid' ? t('invalid', { e: err.message }) : errText(err));
    } finally { btn.disabled = false; btn.textContent = t('test'); }
  });
  $('aiRemove').addEventListener('click', async () => {
    if (!confirm(t('removeConfirm'))) return;
    try { ai = await api('/api/settings/ai/key', { method: 'DELETE' }); renderAI(); showMsg($('aiMsg'), 'ok', t('removed')); }
    catch (err) { showMsg($('aiMsg'), 'err', errText(err)); }
  });

  // ---------------- users ----------------
  function renderUsers() {
    $('userRows').innerHTML = users.map(u => {
      const self = u.id === me.user.id;
      return `<tr data-id="${esc(u.id)}">
        <td><b>${esc(u.username)}</b>${self ? ` <span class="pill">${esc(t('you'))}</span>` : ''}</td>
        <td><select data-act="role" aria-label="${esc(t('role'))}"><option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>${esc(t('viewer'))}</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>${esc(t('admin'))}</option></select></td>
        <td class="muted">${esc(fmtDate(u.lastLoginAt))}</td>
        <td><button class="btn small" data-act="reset">${esc(t('resetPw'))}</button> ${self ? '' : `<button class="btn small danger" data-act="del">${esc(t('del'))}</button>`}</td></tr>`;
    }).join('');
  }
  async function loadUsers() { users = await api('/api/users'); renderUsers(); }
  $('userRows').addEventListener('change', async e => {
    if (e.target.dataset.act !== 'role') return;
    const id = e.target.closest('tr').dataset.id;
    try { await api('/api/users/' + id, { method: 'PATCH', body: { role: e.target.value } }); showMsg($('usersMsg'), 'ok', t('roleSaved')); await loadUsers(); }
    catch (err) { showMsg($('usersMsg'), 'err', errText(err)); renderUsers(); }
  });
  $('userRows').addEventListener('click', async e => {
    const act = e.target.closest('button')?.dataset.act; if (!act) return;
    const id = e.target.closest('tr').dataset.id, u = users.find(x => x.id === id);
    try {
      if (act === 'del') {
        if (!confirm(t('delConfirm', { u: u.username }))) return;
        await api('/api/users/' + id, { method: 'DELETE' }); showMsg($('usersMsg'), 'ok', t('userDeleted'));
      } else if (act === 'reset') {
        const pw = prompt(t('resetPrompt', { u: u.username })); if (pw == null) return;
        if (!pwOk(pw)) return showMsg($('usersMsg'), 'err', t('pwRule'));
        await api('/api/users/' + id, { method: 'PATCH', body: { password: pw } }); showMsg($('usersMsg'), 'ok', t('pwReset'));
      }
      await loadUsers();
    } catch (err) { showMsg($('usersMsg'), 'err', errText(err)); }
  });
  $('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('nuPw').value;
    if (!pwOk(pw)) return showMsg($('usersMsg'), 'err', t('pwRule'));
    try {
      await api('/api/users', { method: 'POST', body: { username: $('nuName').value.trim(), password: pw, role: $('nuRole').value } });
      $('nuName').value = ''; $('nuPw').value = ''; showMsg($('usersMsg'), 'ok', t('userAdded')); await loadUsers();
    } catch (err) { showMsg($('usersMsg'), 'err', errText(err)); }
  });

  // ---------------- account ----------------
  $('pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const next = $('newPw').value;
    if (next !== $('newPw2').value) return showMsg($('pwMsg'), 'err', t('mismatch'));
    if (!pwOk(next)) return showMsg($('pwMsg'), 'err', t('pwRule'));
    try {
      await api('/api/me/password', { method: 'POST', body: { current: $('curPw').value, next } });
      ['curPw', 'newPw', 'newPw2'].forEach(id => { $(id).value = ''; });
      showMsg($('pwMsg'), 'ok', t('pwChanged'));
    } catch (err) { showMsg($('pwMsg'), 'err', errText(err)); }
  });

  // ---------------- init ----------------
  renderWho();
  onLang(() => { renderWho(); renderAI(); renderUsers(); });
  if (isAdmin) {
    $('ai').classList.remove('hidden'); $('users').classList.remove('hidden');
    await Promise.all([loadAI(), loadUsers()]).catch(err => showMsg($('aiMsg'), 'err', errText(err)));
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } else {
    $('viewerNote').classList.remove('hidden');
  }
});
