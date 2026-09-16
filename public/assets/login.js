document.addEventListener('DOMContentLoaded', () => {
  const { t, api, showMsg } = NVO;
  const f = document.getElementById('f'), msg = document.getElementById('msg'), go = document.getElementById('go');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const username = f.username.value.trim(), password = f.password.value;
    if (!username || !password) { showMsg(msg, 'err', t('bad')); return; }
    go.disabled = true; go.textContent = t('signingIn'); msg.hidden = true;
    try {
      await api('/api/login', { method: 'POST', body: { username, password, remember: document.getElementById('remember').checked } });
      location.replace('/');
    } catch (err) {
      showMsg(msg, 'err', err.code === 'locked' ? t('locked', { n: Math.ceil((err.data.wait || 60) / 60) }) : err.code === 'bad' ? t('bad') : err.message);
      f.password.value = ''; f.password.focus();
    } finally { go.disabled = false; go.textContent = t('signIn'); }
  });
});
