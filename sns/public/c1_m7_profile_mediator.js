// C1 UI処理部 M7 プロフィールデータ処理仲介
// ProfileDataMediator: プロフィールデータのバリデーションを行いC5への送信を仲介する

function ProfileDataMediator(action_type, profile_data) {
  switch (action_type) {
    case 'initial': return _validateInitialProfile(profile_data);
    case 'update':  return _validateUpdateProfile(profile_data);
    default:        return { status: 'error', message: '不正なアクション' };
  }
}

function _validateInitialProfile({ last_name, grade }) {
  if (!last_name || last_name.trim() === '')
    return { status: 'error', message: '氏名を入力してください．' };
  if (grade === '' || grade === null || grade === undefined)
    return { status: 'error', message: '学年/職員欄を選択してください．' };
  return { status: 'ok' };
}

function _validateUpdateProfile({ last_name, first_name, bio }) {
  if (!last_name || last_name.trim() === '')
    return { status: 'error', message: '名前（姓）を入力してください（名前は必須項目です）' };
  if (new Blob([last_name + ' ' + (first_name || '')]).size > 64)
    return { status: 'error', message: '名前は 64 バイト以下（全角約 21 文字以内）にしてください．' };
  if (bio && new Blob([bio]).size > 1024)
    return { status: 'error', message: '自己紹介は 1024 バイト以下（全角約 340 文字以内）にしてください．' };
  return { status: 'ok' };
}

// W17 プロフィール編集フォーム送信
document.getElementById('editProfileForm').onsubmit = async (e) => {
  e.preventDefault();
  clearFieldError('editProfileError');

  const editLastName  = document.getElementById('editLastName').value.trim();
  const editFirstName = document.getElementById('editFirstName').value.trim();
  const bio           = document.getElementById('editBio').value.trim();

  // M7でバリデーション
  const v = ProfileDataMediator('update', { last_name: editLastName, first_name: editFirstName, bio });
  if (v.status !== 'ok') { showFieldError('editProfileError', v.message); return; }

  const { department, course } = getShozokuValues('edit');
  const res = await post(API.profiles, {
    action: 'update',
    last_name: editLastName,
    first_name: editFirstName,
    grade:      document.getElementById('editGrade').value,
    department, course,
    lab:        getLabValue('edit'),
    clubs:      document.getElementById('editClubs').value,
    bio,
    timetable:  document.getElementById('editTimetable').value,
  });
  if (res.status === 'ok') {
    navigate('myprofile');
  } else {
    showFieldError('editProfileError', res.message);
  }
};
