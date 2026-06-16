// C1 UI処理部 M3 アカウント入力検証・認証仲介
// AuthenticateMediator: フォーム入力のバリデーションを行い検証成功時にC2 APIを呼び出す

function AuthenticateMediator(screen_id, form_data) {
  switch (screen_id) {

    case 'W1': // 会員登録 - メールアドレス確認
      if (!form_data.email)
        return { result: false, error_message: '学籍番号が存在しません' };
      if (!form_data.email.endsWith('@shibaura-it.ac.jp'))
        return { result: false, error_message: '学籍番号が存在しません' };
      break;

    case 'W2': // パスワード初期設定
      if (!form_data.password)
        return { result: false, error_message: 'パスワードが入力されていません．' };
      if (form_data.password.length < 8 || form_data.password.length > 16)
        return { result: false, error_message: 'パスワードは8〜16文字で入力してください' };
      if (!/[a-zA-Z]/.test(form_data.password) || !/[0-9]/.test(form_data.password))
        return { result: false, error_message: 'パスワードには英数字記号すべてが含まれている必要があります．' };
      if (form_data.password !== form_data.confirm)
        return { result: false, error_message: 'パスワードが一致しません．' };
      break;

    case 'W5': // ログイン
      if (!form_data.email)
        return { result: false, error_message: 'IDが入力されていません．' };
      if (!form_data.password)
        return { result: false, error_message: 'パスワードが入力されていません．' };
      break;

    case 'W6': // パスワード再設定 - 認証コード送信
      if (!form_data.email)
        return { result: false, error_message: '学籍番号が入力されていません．' };
      if (!form_data.email.endsWith('@shibaura-it.ac.jp'))
        return { result: false, error_message: '学籍番号が存在しません' };
      break;

    case 'W7': // パスワード再設定 - 新パスワード入力
      if (!form_data.code)
        return { result: false, error_message: '学籍番号が入力されていません' };
      if (!form_data.password)
        return { result: false, error_message: '新しいパスワードが入力されていません．' };
      if (!form_data.confirm)
        return { result: false, error_message: 'もう一度入力にも入力してください．' };
      if (form_data.password !== form_data.confirm)
        return { result: false, error_message: 'パスワードが異なっています．' };
      break;
  }

  return { result: true, error_message: '' };
}

// ---- 会員登録フロー ----
// W1: 認証コード送信
document.getElementById('sendCodeBtn').onclick = async () => {
  clearFieldError('regStep1Error');
  const email = document.getElementById('regEmail').value.trim();
  const v = AuthenticateMediator('W1', { email });
  if (!v.result) { showFieldError('regStep1Error', v.error_message); return; }
  await AccountControl('send_code', { email, errorElId: 'regStep1Error' });
};

// W2: 認証コード確認 + パスワードバリデーション
document.getElementById('verifyCodeBtn').onclick = async () => {
  clearFieldError('regStep2Error');
  const email    = document.getElementById('regEmail').value.trim();
  const code     = document.getElementById('regCode').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regPasswordConfirm').value;

  const verRes = await post(API.auth, { action: 'verify_code', email, code });
  if (verRes.status !== 'ok') { showFieldError('regStep2Error', verRes.message); return; }

  const v = AuthenticateMediator('W2', { password, confirm });
  if (!v.result) { showFieldError('regStep2Error', v.error_message); return; }

  document.getElementById('regStep2').style.display = 'none';
  document.getElementById('regStep3').style.display = 'block';
};

// W3: プロフィール入力 → 登録
document.getElementById('completeRegBtn').onclick = async () => {
  clearFieldError('regStep3Error');
  const email     = document.getElementById('regEmail').value.trim();
  const password  = document.getElementById('regPassword').value;
  const confirm   = document.getElementById('regPasswordConfirm').value;
  const lastName  = document.getElementById('regLastName').value.trim();
  const firstName = document.getElementById('regFirstName').value.trim();
  const grade     = document.getElementById('regGrade').value;

  if (!lastName) { showFieldError('regStep3Error', '氏名（姓）を入力してください'); return; }
  if (grade === '') { showFieldError('regStep3Error', '学年/職員欄を選択してください'); return; }

  const { department, course } = getShozokuValues('reg');
  await AccountControl('register', {
    email, password, confirm_password: confirm,
    last_name: lastName, first_name: firstName, grade,
    department, course,
    lab:   getLabValue('reg'),
    clubs: document.getElementById('regClubs').value,
    bio:   document.getElementById('regBio').value,
  });
};

// ---- パスワード再設定フロー ----
// W6: 認証コード送信
document.getElementById('resetSendCodeBtn').onclick = async () => {
  clearFieldError('resetStep1Error');
  const email = document.getElementById('resetEmail').value.trim();
  const v = AuthenticateMediator('W6', { email });
  if (!v.result) { showFieldError('resetStep1Error', v.error_message); return; }
  const res = await post(API.auth, { action: 'send_code', email });
  if (res.status === 'ok') {
    document.getElementById('resetStep1').style.display = 'none';
    document.getElementById('resetStep2').style.display = 'block';
  } else {
    showFieldError('resetStep1Error', res.message);
  }
};

// W7: 新パスワード送信
document.getElementById('resetSubmitBtn').onclick = async () => {
  clearFieldError('resetStep2Error');
  const email    = document.getElementById('resetEmail').value.trim();
  const code     = document.getElementById('resetCode').value.trim();
  const password = document.getElementById('resetPassword').value;
  const confirm  = document.getElementById('resetPasswordConfirm').value;

  const v = AuthenticateMediator('W7', { code, password, confirm });
  if (!v.result) { showFieldError('resetStep2Error', v.error_message); return; }
  await AccountControl('reset_password', { email, code, password, confirm_password: confirm });
};
