/* Shared helpers for login / setup / settings pages (EN/AR) */
(function () {
  const D = {
    en: {
      brand: 'National Vitality Observatory',
      artTitle: 'Read a country like a living organism',
      artText: 'Vital signs, early warnings, stress tests and improvement plans for the nation and its government — from World Bank data or your own files.',
      signIn: 'Sign in', signInLead: 'Use the account your administrator gave you.',
      username: 'Username', password: 'Password', remember: 'Keep me signed in for 30 days',
      signingIn: 'Signing in…', bad: 'Incorrect username or password.', locked: 'Too many attempts. Try again in {n} min.',
      network: 'Could not reach the server. Check your connection and try again.',
      setupTitle: 'Create the administrator', setupLead: 'This platform has no accounts yet. Enter the one-time setup code from the server logs (Railway → Deployments → Logs), then choose the admin username and password.',
      setupCode: 'Setup code', createAdmin: 'Create administrator', badcode: 'Setup code is not correct. Find it in the server logs.',
      pwRule: 'At least 10 characters, with letters and numbers.', confirm: 'Confirm password', mismatch: 'The passwords do not match.',
      settings: 'Settings', back: 'Back to observatory', signOut: 'Sign out', signedInAs: 'Signed in as {u}',
      account: 'Your account', accountSub: 'Change the password you use to sign in. Other devices will be signed out.',
      current: 'Current password', newPw: 'New password', changePw: 'Change password', pwChanged: 'Password changed.', badcurrent: 'Current password is not correct.',
      ai: 'AI — Anthropic API', aiSub: 'The Improvement Advisor uses Claude to draft tailored plans. The key is stored encrypted on the server and is never sent to browsers; requests go through this platform.',
      aiOn: 'Key saved', aiOnEnv: 'Key provided by the ANTHROPIC_API_KEY environment variable', aiOff: 'No key saved — AI plans are disabled', aiBroken: 'The saved key cannot be decrypted (the server secret changed). Enter it again.',
      updated: 'Updated {d} by {u}', apiKey: 'Anthropic API key', keyPh: 'sk-ant-…', keyHelp: 'Create a key at console.anthropic.com → API keys. Leave empty to keep the current key.',
      show: 'Show', hide: 'Hide', model: 'Model', modelAuto: 'Automatic (latest Sonnet)', modelHelp: 'Test the key to load the models it can use.',
      save: 'Save', test: 'Test key', testing: 'Testing…', saving: 'Saving…', removeKey: 'Remove key', removeConfirm: 'Remove the saved API key? AI plans will stop working until a new key is added.',
      saved: 'Settings saved.', removed: 'API key removed.', testOk: 'Key works — {n} models available.', invalid: 'Anthropic rejected this key: {e}', format: 'That does not look like an Anthropic API key (it should start with sk-ant-).', nokey: 'Enter a key to test.',
      users: 'Users', usersSub: 'Administrators can change settings and manage users. Viewers can use the observatory and the AI advisor.',
      role: 'Role', admin: 'Administrator', viewer: 'Viewer', lastLogin: 'Last sign-in', never: 'Never', you: 'you',
      addUser: 'Add a user', add: 'Add user', resetPw: 'Reset password', del: 'Delete', delConfirm: 'Delete user "{u}"?', resetPrompt: 'New password for "{u}" (at least 10 characters, letters and numbers):',
      userAdded: 'User added.', userDeleted: 'User deleted.', roleSaved: 'Role updated.', pwReset: 'Password reset — share it with the user securely.',
      taken: 'That username is already taken.', lastadmin: 'At least one administrator is required.', self: 'You cannot delete your own account.',
      viewerNote: 'Only administrators can change AI settings and users.',
    },
    ar: {
      brand: 'مرصد الحيوية الوطنية',
      artTitle: 'اقرأ الدولة ككائن حي',
      artText: 'علامات حيوية وإنذارات مبكرة واختبارات ضغط وخطط تحسين للدولة وحكومتها — من بيانات البنك الدولي أو من ملفاتك.',
      signIn: 'تسجيل الدخول', signInLead: 'استخدم الحساب الذي زوّدك به المسؤول.',
      username: 'اسم المستخدم', password: 'كلمة المرور', remember: 'إبقائي مسجلاً لمدة 30 يوماً',
      signingIn: 'جارٍ تسجيل الدخول…', bad: 'اسم المستخدم أو كلمة المرور غير صحيحة.', locked: 'محاولات كثيرة. حاول مجدداً بعد {n} دقيقة.',
      network: 'تعذّر الوصول إلى الخادم. تحقّق من الاتصال وحاول مجدداً.',
      setupTitle: 'إنشاء حساب المسؤول', setupLead: 'لا توجد حسابات بعد. أدخل رمز الإعداد لمرة واحدة من سجلات الخادم (Railway ← Deployments ← Logs)، ثم اختر اسم مستخدم وكلمة مرور المسؤول.',
      setupCode: 'رمز الإعداد', createAdmin: 'إنشاء المسؤول', badcode: 'رمز الإعداد غير صحيح. تجده في سجلات الخادم.',
      pwRule: '10 أحرف على الأقل، تتضمن حروفاً وأرقاماً.', confirm: 'تأكيد كلمة المرور', mismatch: 'كلمتا المرور غير متطابقتين.',
      settings: 'الإعدادات', back: 'العودة إلى المرصد', signOut: 'تسجيل الخروج', signedInAs: 'مسجّل الدخول باسم {u}',
      account: 'حسابك', accountSub: 'غيّر كلمة المرور التي تستخدمها لتسجيل الدخول. سيتم تسجيل خروج الأجهزة الأخرى.',
      current: 'كلمة المرور الحالية', newPw: 'كلمة المرور الجديدة', changePw: 'تغيير كلمة المرور', pwChanged: 'تم تغيير كلمة المرور.', badcurrent: 'كلمة المرور الحالية غير صحيحة.',
      ai: 'الذكاء الاصطناعي — Anthropic API', aiSub: 'يستخدم مستشار التحسين نموذج Claude لصياغة خطط مخصصة. يُخزَّن المفتاح مشفّراً على الخادم ولا يُرسل إلى المتصفح أبداً؛ تمر الطلبات عبر هذه المنصة.',
      aiOn: 'المفتاح محفوظ', aiOnEnv: 'المفتاح مُعرّف عبر متغير البيئة ANTHROPIC_API_KEY', aiOff: 'لا يوجد مفتاح — خطط الذكاء الاصطناعي معطّلة', aiBroken: 'تعذّر فك تشفير المفتاح المحفوظ (تغيّر سر الخادم). أدخله مجدداً.',
      updated: 'حُدّث {d} بواسطة {u}', apiKey: 'مفتاح Anthropic API', keyPh: 'sk-ant-…', keyHelp: 'أنشئ مفتاحاً من console.anthropic.com ← API keys. اتركه فارغاً للإبقاء على المفتاح الحالي.',
      show: 'إظهار', hide: 'إخفاء', model: 'النموذج', modelAuto: 'تلقائي (أحدث Sonnet)', modelHelp: 'اختبر المفتاح لتحميل النماذج المتاحة له.',
      save: 'حفظ', test: 'اختبار المفتاح', testing: 'جارٍ الاختبار…', saving: 'جارٍ الحفظ…', removeKey: 'حذف المفتاح', removeConfirm: 'حذف مفتاح API المحفوظ؟ ستتوقف خطط الذكاء الاصطناعي حتى يُضاف مفتاح جديد.',
      saved: 'تم حفظ الإعدادات.', removed: 'تم حذف مفتاح API.', testOk: 'المفتاح يعمل — {n} نموذجاً متاحاً.', invalid: 'رفضت Anthropic هذا المفتاح: {e}', format: 'لا يبدو هذا مفتاح Anthropic (يجب أن يبدأ بـ sk-ant-).', nokey: 'أدخل مفتاحاً لاختباره.',
      users: 'المستخدمون', usersSub: 'يستطيع المسؤولون تغيير الإعدادات وإدارة المستخدمين. يستطيع المشاهدون استخدام المرصد ومستشار الذكاء الاصطناعي.',
      role: 'الدور', admin: 'مسؤول', viewer: 'مشاهد', lastLogin: 'آخر دخول', never: 'لم يسجّل', you: 'أنت',
      addUser: 'إضافة مستخدم', add: 'إضافة', resetPw: 'إعادة تعيين كلمة المرور', del: 'حذف', delConfirm: 'حذف المستخدم «{u}»؟', resetPrompt: 'كلمة مرور جديدة لـ «{u}» (10 أحرف على الأقل، حروف وأرقام):',
      userAdded: 'تمت إضافة المستخدم.', userDeleted: 'تم حذف المستخدم.', roleSaved: 'تم تحديث الدور.', pwReset: 'تمت إعادة التعيين — شاركها مع المستخدم بطريقة آمنة.',
      taken: 'اسم المستخدم مستخدم بالفعل.', lastadmin: 'يجب وجود مسؤول واحد على الأقل.', self: 'لا يمكنك حذف حسابك.',
      viewerNote: 'يستطيع المسؤولون فقط تغيير إعدادات الذكاء الاصطناعي والمستخدمين.',
    },
  };
  let lang = 'en';
  try { const v = localStorage.getItem('nvo.lang'); if (v === 'ar' || v === 'en') lang = v; } catch (e) {}
  const t = (k, vars) => { let s = (D[lang] && D[lang][k]) ?? D.en[k] ?? k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; };
  const listeners = [];
  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    const tt = document.querySelector('[data-title]'); if (tt) document.title = t(tt.dataset.title) + ' · ' + t('brand');
    listeners.forEach(f => f());
  }
  function setLang(l) { lang = l; try { localStorage.setItem('nvo.lang', l); } catch (e) {} apply(); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
  async function api(url, opts = {}) {
    let r;
    try {
      r = await fetch(url, { credentials: 'same-origin', ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) { const err = new Error(t('network')); err.code = 'network'; throw err; }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.includes('/login') && !url.includes('/setup') && !url.includes('/password')) { location.href = '/login'; }
    if (!r.ok) { const err = new Error(j.error || 'HTTP ' + r.status); err.code = j.code; err.status = r.status; err.data = j; throw err; }
    return j;
  }
  function showMsg(el, kind, text) { el.className = 'msg ' + kind; el.textContent = text; el.hidden = false; }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.NVO = { t, apply, setLang, api, showMsg, esc, onLang: f => listeners.push(f), get lang() { return lang; } };
  document.addEventListener('DOMContentLoaded', apply);
})();
