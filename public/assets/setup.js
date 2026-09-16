document.addEventListener('DOMContentLoaded', () => {
  const { t, api, showMsg } = NVO;
  const $ = id => document.getElementById(id);
  const f = $('f'), msg = $('msg'), go = $('go');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if ($('password').value !== $('password2').value) { showMsg(msg, 'err', t('mismatch')); return; }
    const pw = $('password').value;
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { showMsg(msg, 'err', t('pwRule')); return; }
    go.disabled = true; msg.hidden = true;
    try {
      await api('/api/setup', { method: 'POST', body: { code: $('code').value, username: $('username').value.trim(), password: $('password').value } });
      location.replace('/settings#ai');
    } catch (err) {
      showMsg(msg, 'err', err.code === 'badcode' ? t('badcode') : err.message);
    } finally { go.disabled = false; }
  });
});
