// C1 UI処理部 M6 プロフィール管理UI制御
// ProfileUIControl: W3/W12/W13/W15/W16/W17の描画とイベント検知・M7への委譲

function ProfileUIControl(screen_id, input_data = {}) {
  switch (screen_id) {
    case 'W16': return loadMyProfile();
    case 'W15': return loadOtherProfile(input_data.userId);
    case 'W12': return _performSearch(input_data);
    case 'W17': return loadEditProfile();
    default:    return Promise.resolve();
  }
}

function openUserProfile(userId) {
  if (userId == currentUserId) {
    navigate('myprofile');
  } else {
    otherProfileFrom = currentPage;
    navigate('otherProfile', { userId });
  }
}

async function loadMyProfile() {
  document.getElementById('myProfileContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.profiles, { action: 'get' });
  if (res.status !== 'ok') {
    // W16-E1: 自身のプロフィールデータが取得できない
    showError('プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。');
    return;
  }
  document.getElementById('myProfileContent').innerHTML = buildProfileCard(res.profile, true);
}

async function loadOtherProfile(userId) {
  document.getElementById('otherProfileContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.profiles, { action: 'get', user_id: userId });
  if (res.status !== 'ok') {
    showError(res.message || 'このユーザーは退会済みです');
    navigate(otherProfileFrom || 'timeline');
    return;
  }
  document.getElementById('otherProfileContent').innerHTML = buildProfileCard(res.profile, false);
}

function buildProfileCard(p, isOwn) {
  const gLabel = gradeLabel(p.grade);
  return `
    <div class="profile-card">
      <div class="profile-header">
        ${avatarEl(p.name).replace('class="avatar"', 'class="profile-avatar"')}
        <div class="profile-info">
          <h2>${esc(p.name)}</h2>
          <p>${gLabel}${p.department ? ' / ' + esc(p.department) : ''}</p>
          ${isOwn ? '' : `<button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="startDM(${p.user_id})">💬 メッセージ</button>`}
          ${isOwn ? `<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="navigate('editProfile')">✏️ プロフィール編集</button>` : ''}
        </div>
      </div>
      <div class="profile-details">
        ${p.bio       ? `<div class="profile-detail-row"><span class="label">自己紹介</span><span>${esc(p.bio)}</span></div>` : ''}
        ${p.department? `<div class="profile-detail-row"><span class="label">所属</span><span>${esc(p.department)}</span></div>` : ''}
        ${p.course    ? `<div class="profile-detail-row"><span class="label">コース</span><span>${esc(p.course)}</span></div>` : ''}
        ${p.lab       ? `<div class="profile-detail-row"><span class="label">研究室</span><span>${esc(p.lab)}</span></div>` : ''}
        ${p.clubs     ? `<div class="profile-detail-row"><span class="label">サークル・部活動</span><span>${esc(p.clubs)}</span></div>` : ''}
        ${p.timetable ? `<div class="profile-detail-row"><span class="label">時間割</span><span>${esc(p.timetable)}</span></div>` : ''}
      </div>
    </div>
  `;
}

async function _performSearch(params) {
  const res = await get(API.profiles, { action: 'search', ...params });
  if (res.status !== 'ok') { showError(res.message); return; }
  const profiles = res.profiles;
  if (profiles.length === 0) {
    // W12-E1: 該当プロフィールなし
    document.getElementById('searchResults').innerHTML = '<div class="empty-state">該当件数0<br>条件を変えて再検索してください</div>';
    return;
  }
  document.getElementById('searchResults').innerHTML = profiles.map(p => `
    <div class="search-result-card" onclick="openUserProfile(${p.user_id})">
      ${avatarEl(p.name, 'sm')}
      <div class="search-result-info">
        <div class="name">${esc(p.name)}</div>
        <div class="sub">${gradeLabel(p.grade)}${p.course ? ' / ' + esc(p.course) : ''}</div>
        ${p.bio ? `<div class="sub">${esc(p.bio.substring(0, 40))}${p.bio.length > 40 ? '...' : ''}</div>` : ''}
      </div>
    </div>
  `).join('');
}

async function loadEditProfile() {
  const res = await get(API.profiles, { action: 'get' });
  if (res.status !== 'ok') { showError('プロフィールの取得に失敗しました'); return; }
  const p = res.profile;
  document.getElementById('editLastName').value  = p.last_name  || '';
  document.getElementById('editFirstName').value = p.first_name || '';
  setShozokuValues('edit', p.department || '', p.course || '', p.grade ?? 1);
  updateLabSelect('edit');
  setLabValue('edit', p.lab || '');
  document.getElementById('editClubs').value     = p.clubs     || '';
  document.getElementById('editBio').value       = p.bio       || '';
  document.getElementById('editTimetable').value = p.timetable || '';
}

document.getElementById('backFromOtherProfile').onclick = () => navigate(otherProfileFrom || 'timeline');
document.getElementById('backFromEditProfile').onclick  = () => navigate('myprofile');
document.getElementById('cancelEditProfile').onclick    = () => navigate('myprofile');

// W12 検索ボタン → M7経由でC5へ
document.getElementById('searchBtn').onclick = () => {
  ProfileUIControl('W12', {
    name:  document.getElementById('searchName').value,
    grade: document.getElementById('searchGrade').value,
    course: document.getElementById('searchCourse').value,
    lab:   document.getElementById('searchLab').value,
    clubs: document.getElementById('searchClubs').value,
  });
};

document.querySelectorAll('#pageSearch input, #pageSearch select').forEach(el => {
  el.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('searchBtn').click(); };
});
