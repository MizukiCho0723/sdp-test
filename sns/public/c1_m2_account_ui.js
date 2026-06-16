// C1 UI処理部 M2 アカウント管理UI
// AccountControl: 認証画面の入力データを読み取りC2認証処理部へリクエストを送信する

async function AccountControl(action, formData = {}) {
  switch (action) {
    case 'login':          return _login(formData);
    case 'send_code':      return _sendCode(formData);
    case 'register':       return _register(formData);
    case 'reset_password': return _resetPassword(formData);
    case 'logout':         return _logout();
    default:
      return { status: 'error', message: '不正なアクション' };
  }
}

async function _login({ email, password }) {
  const res = await post(API.auth, { action: 'login', email, password });
  if (res.status === 'ok') {
    currentUserId = res.user_id;
    startApp();
  } else {
    showFieldError('loginError', res.message);
  }
  return res;
}

async function _sendCode({ email, errorElId = 'regStep1Error' }) {
  const res = await post(API.auth, { action: 'send_code', email });
  if (res.status === 'ok') {
    document.getElementById('regStep1').style.display = 'none';
    document.getElementById('regStep2').style.display = 'block';
  } else {
    showFieldError(errorElId, res.message);
  }
  return res;
}

async function _register(formData) {
  const res = await post(API.auth, { action: 'register', ...formData });
  if (res.status === 'ok') {
    document.getElementById('regStep3').style.display = 'none';
    document.getElementById('regStep4').style.display = 'block';
  } else {
    showFieldError('regStep3Error', res.message);
  }
  return res;
}

async function _resetPassword(formData) {
  const res = await post(API.auth, { action: 'reset_password', ...formData });
  if (res.status === 'ok') {
    document.getElementById('resetStep2').style.display = 'none';
    document.getElementById('resetStep3').style.display = 'block';
  } else {
    showFieldError('resetStep2Error', res.message);
  }
  return res;
}

async function _logout() {
  const res = await post(API.auth, { action: 'logout' });
  currentUserId = null;
  if (notifInterval) clearInterval(notifInterval);
  document.getElementById('appSection').style.display = 'none';
  document.getElementById('authSection').style.display = 'block';
  showAuthPage('loginPage');
  return res;
}

// ---- 画面遷移リンク ----
document.getElementById('toRegister').onclick      = (e) => { e.preventDefault(); showAuthPage('registerPage'); };
document.getElementById('toForgotPassword').onclick = (e) => { e.preventDefault(); showAuthPage('resetPage'); };
document.getElementById('toLoginFromReg').onclick   = (e) => { e.preventDefault(); showAuthPage('loginPage'); };
document.getElementById('toLoginFromReset').onclick  = (e) => { e.preventDefault(); showAuthPage('loginPage'); };
document.getElementById('toLoginFromDone').onclick      = () => showAuthPage('loginPage');
document.getElementById('toLoginFromResetDone').onclick = () => showAuthPage('loginPage');
document.getElementById('logoutBtn').onclick            = () => AccountControl('logout');

// W5 ログイン
document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  clearFieldError('loginError');
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  // M3でバリデーション
  const v = AuthenticateMediator('W5', { email, password });
  if (!v.result) { showFieldError('loginError', v.error_message); return; }
  await AccountControl('login', { email, password });
};
