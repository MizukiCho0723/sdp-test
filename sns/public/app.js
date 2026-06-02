// SNS App - Main JavaScript
const API = {
  auth: '/sns/api/auth.php',
  posts: '/sns/api/posts.php',
  messages: '/sns/api/messages.php',
  profiles: '/sns/api/profiles.php',
  notifications: '/sns/api/notifications.php',
};

let currentUserId = null;
let currentPage = 'timeline';
let prevPage = null;
let chatPartnerId = null;
let chatInterval = null;
let notifInterval = null;
let otherProfileFrom = null;

// ---- Utility ----
function showError(msg) {
  document.getElementById('errorDialogMsg').textContent = msg;
  document.getElementById('errorDialog').style.display = 'flex';
}
document.getElementById('errorDialogOk').onclick = () => {
  document.getElementById('errorDialog').style.display = 'none';
};

function post(url, data) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fetch(url, { method: 'POST', body: fd }).then(r => r.json());
}

function get(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(url + (qs ? '?' + qs : '')).then(r => r.json());
}

function showFieldError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.style.display = 'block';
}
function clearFieldError(elId) {
  const el = document.getElementById(elId);
  el.style.display = 'none';
}

function gradeLabel(g) {
  const map = { 0: '教員・職員', 1: '学部1年', 2: '学部2年', 3: '学部3年', 4: '学部4年', 5: '修士1年', 6: '修士2年', 7: '博士課程' };
  return map[g] || '不明';
}

function avatarEl(name, cls = '') {
  const letter = (name || '?')[0].toUpperCase();
  const colors = ['#1877f2','#e41e3f','#1a7a1a','#e67e22','#8e44ad'];
  const c = colors[letter.charCodeAt(0) % colors.length];
  return `<div class="avatar ${cls}" style="background:${c}">${letter}</div>`;
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function navigate(page, extra = {}) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pageEl) pageEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (chatInterval && page !== 'chat') {
    clearInterval(chatInterval);
    chatInterval = null;
  }

  prevPage = currentPage;
  currentPage = page;

  if (page === 'timeline') loadTimeline();
  if (page === 'search') document.getElementById('searchResults').innerHTML = '';
  if (page === 'messages') loadPartners();
  if (page === 'notifications') loadNotifications();
  if (page === 'myprofile') loadMyProfile();
  if (page === 'postDetail' && extra.postId) loadPostDetail(extra.postId);
  if (page === 'chat' && extra.partnerId) openChat(extra.partnerId);
  if (page === 'otherProfile' && extra.userId) loadOtherProfile(extra.userId);
  if (page === 'editProfile') loadEditProfile();
}

// ---- Auth Section ----
function showAuthPage(page) {
  ['loginPage','registerPage','resetPage'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById(page).style.display = 'flex';
}

document.getElementById('toRegister').onclick = (e) => { e.preventDefault(); showAuthPage('registerPage'); };
document.getElementById('toForgotPassword').onclick = (e) => { e.preventDefault(); showAuthPage('resetPage'); };
document.getElementById('toLoginFromReg').onclick = (e) => { e.preventDefault(); showAuthPage('loginPage'); };
document.getElementById('toLoginFromReset').onclick = (e) => { e.preventDefault(); showAuthPage('loginPage'); };
document.getElementById('toLoginFromDone').onclick = () => showAuthPage('loginPage');
document.getElementById('toLoginFromResetDone').onclick = () => showAuthPage('loginPage');

// Login
document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  clearFieldError('loginError');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const res = await post(API.auth, { action: 'login', email, password });
  if (res.status === 'ok') {
    currentUserId = res.user_id;
    startApp();
  } else {
    showFieldError('loginError', res.message);
  }
};

// Register Step 1 - send code
document.getElementById('sendCodeBtn').onclick = async () => {
  clearFieldError('regStep1Error');
  const email = document.getElementById('regEmail').value.trim();
  const res = await post(API.auth, { action: 'send_code', email });
  if (res.status === 'ok') {
    document.getElementById('regStep1').style.display = 'none';
    document.getElementById('regStep2').style.display = 'block';
  } else {
    showFieldError('regStep1Error', res.message);
  }
};

// Register Step 2 - verify code + password
document.getElementById('verifyCodeBtn').onclick = async () => {
  clearFieldError('regStep2Error');
  const email = document.getElementById('regEmail').value.trim();
  const code = document.getElementById('regCode').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;

  // Validate code first
  const verRes = await post(API.auth, { action: 'verify_code', email, code });
  if (verRes.status !== 'ok') {
    showFieldError('regStep2Error', verRes.message);
    return;
  }
  // Validate password client-side
  if (password.length < 8 || password.length > 16) {
    showFieldError('regStep2Error', 'パスワードは8〜16文字で入力してください');
    return;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    showFieldError('regStep2Error', 'パスワードには英数字記号すべてが含まれている必要があります');
    return;
  }
  if (password !== confirm) {
    showFieldError('regStep2Error', 'パスワードが一致しません');
    return;
  }
  document.getElementById('regStep2').style.display = 'none';
  document.getElementById('regStep3').style.display = 'block';
};

// Register Step 3 - profile info
document.getElementById('completeRegBtn').onclick = async () => {
  clearFieldError('regStep3Error');
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;
  const name = document.getElementById('regName').value.trim();
  const grade = document.getElementById('regGrade').value;
  if (!name) { showFieldError('regStep3Error', '氏名を入力してください'); return; }
  if (grade === '') { showFieldError('regStep3Error', '学年/職員欄を選択してください'); return; }

  const res = await post(API.auth, {
    action: 'register', email, password, confirm_password: confirm,
    name, grade,
    department: document.getElementById('regDepartment').value,
    course: document.getElementById('regCourse').value,
    lab: document.getElementById('regLab').value,
    clubs: document.getElementById('regClubs').value,
    bio: document.getElementById('regBio').value,
  });
  if (res.status === 'ok') {
    document.getElementById('regStep3').style.display = 'none';
    document.getElementById('regStep4').style.display = 'block';
  } else {
    showFieldError('regStep3Error', res.message);
  }
};

// Password Reset
document.getElementById('resetSendCodeBtn').onclick = async () => {
  clearFieldError('resetStep1Error');
  const email = document.getElementById('resetEmail').value.trim();
  const res = await post(API.auth, { action: 'send_code', email });
  if (res.status === 'ok') {
    document.getElementById('resetStep1').style.display = 'none';
    document.getElementById('resetStep2').style.display = 'block';
  } else {
    showFieldError('resetStep1Error', res.message);
  }
};

document.getElementById('resetSubmitBtn').onclick = async () => {
  clearFieldError('resetStep2Error');
  const email = document.getElementById('resetEmail').value.trim();
  const code = document.getElementById('resetCode').value.trim();
  const password = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetPasswordConfirm').value;
  if (!code) { showFieldError('resetStep2Error', '学籍番号が入力されていません'); return; }
  if (password !== confirm) { showFieldError('resetStep2Error', 'パスワードが一致しません'); return; }

  const res = await post(API.auth, { action: 'reset_password', email, code, password, confirm_password: confirm });
  if (res.status === 'ok') {
    document.getElementById('resetStep2').style.display = 'none';
    document.getElementById('resetStep3').style.display = 'block';
  } else {
    showFieldError('resetStep2Error', res.message);
  }
};

// ---- Main App ----
function startApp() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
  navigate('timeline');
  startNotifPolling();
}

// Nav buttons
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.onclick = () => navigate(btn.dataset.page);
});

document.getElementById('logoutBtn').onclick = async () => {
  await post(API.auth, { action: 'logout' });
  currentUserId = null;
  if (notifInterval) clearInterval(notifInterval);
  document.getElementById('appSection').style.display = 'none';
  document.getElementById('authSection').style.display = 'block';
  showAuthPage('loginPage');
};

// ---- Timeline ----
async function loadTimeline() {
  document.getElementById('timelineList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('timelineEmpty').style.display = 'none';
  const res = await get(API.posts, { action: 'list' });
  if (res.status !== 'ok') { showError('タイムラインの取得に失敗しました'); return; }
  const posts = res.posts;
  if (posts.length === 0) {
    document.getElementById('timelineList').innerHTML = '';
    document.getElementById('timelineEmpty').style.display = 'block';
    return;
  }
  document.getElementById('timelineList').innerHTML = posts.map(p => `
    <div class="post-card" data-post-id="${p.post_id}" onclick="navigate('postDetail',{postId:${p.post_id}})">
      <div class="post-header">
        ${avatarEl(p.name)}
        <div class="post-meta">
          <div class="name" onclick="event.stopPropagation();openUserProfile(${p.user_id})">${esc(p.name)}</div>
          <div class="time">${timeAgo(p.created_at)}</div>
        </div>
        ${p.user_id == currentUserId ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deletePost(${p.post_id})">削除</button>` : ''}
      </div>
      <div class="post-content">${esc(p.content)}</div>
      <div class="post-actions">
        <span class="reply-count">💬 ${p.reply_count}件の返信</span>
      </div>
    </div>
  `).join('');
}

// Post form char count
document.getElementById('postContent').oninput = function() {
  const len = Math.ceil(this.value.length * (this.value.match(/[^\x00-\x7F]/) ? 3 : 1) / 3);
  document.getElementById('postCharCount').textContent = `${this.value.length} / 340文字`;
};

document.getElementById('postSubmitBtn').onclick = async () => {
  clearFieldError('postError');
  const content = document.getElementById('postContent').value.trim();
  if (!content) { showFieldError('postError', '投稿内容を入力してください'); return; }
  if (new Blob([content]).size > 1024) { showFieldError('postError', '投稿内容は1024バイト以下にしてください'); return; }
  const res = await post(API.posts, { action: 'create', content });
  if (res.status === 'ok') {
    document.getElementById('postContent').value = '';
    document.getElementById('postCharCount').textContent = '0 / 340文字';
    loadTimeline();
  } else {
    showFieldError('postError', res.message);
  }
};

async function deletePost(postId) {
  if (!confirm('この投稿を削除しますか？')) return;
  const res = await post(API.posts, { action: 'delete', post_id: postId });
  if (res.status === 'ok') loadTimeline();
  else showError(res.message);
}

// ---- Post Detail ----
async function loadPostDetail(postId) {
  document.getElementById('detailContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.posts, { action: 'detail', post_id: postId });
  if (res.status !== 'ok') { showError('投稿が見つかりません'); navigate('timeline'); return; }
  const p = res.post;
  const replies = res.replies;

  document.getElementById('detailContent').innerHTML = `
    <div class="post-card" style="cursor:default;">
      <div class="post-header">
        ${avatarEl(p.name)}
        <div class="post-meta">
          <div class="name" style="cursor:pointer;" onclick="openUserProfile(${p.user_id})">${esc(p.name)}</div>
          <div class="time">${timeAgo(p.created_at)}</div>
        </div>
        ${p.user_id == currentUserId ? `<button class="btn btn-danger btn-sm" onclick="deletePost(${p.post_id});navigate('timeline')">削除</button>` : ''}
      </div>
      <div class="post-content">${esc(p.content)}</div>
    </div>

    <div class="reply-form">
      <div class="form-group">
        <textarea id="replyContent" placeholder="返信を入力..." style="width:100%;border:1px solid #ccd0d5;border-radius:6px;padding:10px;font-size:14px;resize:vertical;min-height:70px;outline:none;"></textarea>
      </div>
      <div id="replyError" class="error-msg"></div>
      <button class="btn btn-primary btn-sm" onclick="submitReply(${postId})">返信する</button>
    </div>

    <div class="reply-list">
      ${replies.length === 0 ? '<div class="empty-state">まだ返信がありません</div>' : replies.map(r => `
        <div class="reply-card">
          <div class="post-header">
            ${avatarEl(r.name, 'sm')}
            <div class="post-meta">
              <div class="name" style="cursor:pointer;font-size:14px;" onclick="openUserProfile(${r.user_id})">${esc(r.name)}</div>
              <div class="time">${timeAgo(r.created_at)}</div>
            </div>
          </div>
          <div class="post-content" style="font-size:14px;">${esc(r.content)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function submitReply(postId) {
  clearFieldError('replyError');
  const content = document.getElementById('replyContent').value.trim();
  if (!content) { showFieldError('replyError', '返信内容を入力してください'); return; }
  if (new Blob([content]).size > 1024) { showFieldError('replyError', '返信内容は1024バイト以下にしてください'); return; }
  const res = await post(API.posts, { action: 'reply', post_id: postId, content });
  if (res.status === 'ok') {
    document.getElementById('replyContent').value = '';
    loadPostDetail(postId);
  } else {
    showFieldError('replyError', res.message);
  }
}

document.getElementById('backToTimeline').onclick = () => navigate('timeline');

// ---- Profile ----
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
  if (res.status !== 'ok') { showError('プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。'); return; }
  const p = res.profile;
  document.getElementById('myProfileContent').innerHTML = buildProfileCard(p, true);
}

async function loadOtherProfile(userId) {
  document.getElementById('otherProfileContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.profiles, { action: 'get', user_id: userId });
  if (res.status !== 'ok') { showError(res.message || 'このユーザーは退会済みです'); navigate(otherProfileFrom || 'timeline'); return; }
  const p = res.profile;
  document.getElementById('otherProfileContent').innerHTML = buildProfileCard(p, false);
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
        ${p.bio ? `<div class="profile-detail-row"><span class="label">自己紹介</span><span>${esc(p.bio)}</span></div>` : ''}
        ${p.course ? `<div class="profile-detail-row"><span class="label">コース</span><span>${esc(p.course)}</span></div>` : ''}
        ${p.lab ? `<div class="profile-detail-row"><span class="label">研究室</span><span>${esc(p.lab)}</span></div>` : ''}
        ${p.clubs ? `<div class="profile-detail-row"><span class="label">サークル</span><span>${esc(p.clubs)}</span></div>` : ''}
        ${p.timetable ? `<div class="profile-detail-row"><span class="label">時間割</span><span>${esc(p.timetable)}</span></div>` : ''}
      </div>
    </div>
  `;
}

document.getElementById('backFromOtherProfile').onclick = () => navigate(otherProfileFrom || 'timeline');

async function loadEditProfile() {
  const res = await get(API.profiles, { action: 'get' });
  if (res.status !== 'ok') { showError('プロフィールの取得に失敗しました'); return; }
  const p = res.profile;
  document.getElementById('editName').value = p.name || '';
  document.getElementById('editGrade').value = p.grade || 0;
  document.getElementById('editDepartment').value = p.department || '';
  document.getElementById('editCourse').value = p.course || '';
  document.getElementById('editLab').value = p.lab || '';
  document.getElementById('editClubs').value = p.clubs || '';
  document.getElementById('editBio').value = p.bio || '';
  document.getElementById('editTimetable').value = p.timetable || '';
}

document.getElementById('editProfileForm').onsubmit = async (e) => {
  e.preventDefault();
  clearFieldError('editProfileError');
  const name = document.getElementById('editName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  if (!name) { showFieldError('editProfileError', '名前を入力してください（名前は必須項目です）'); return; }
  if (new Blob([name]).size > 64) { showFieldError('editProfileError', '名前は64バイト以下にしてください'); return; }
  if (new Blob([bio]).size > 1024) { showFieldError('editProfileError', '自己紹介は1024バイト以下にしてください'); return; }

  const res = await post(API.profiles, {
    action: 'update', name,
    grade: document.getElementById('editGrade').value,
    department: document.getElementById('editDepartment').value,
    course: document.getElementById('editCourse').value,
    lab: document.getElementById('editLab').value,
    clubs: document.getElementById('editClubs').value,
    bio,
    timetable: document.getElementById('editTimetable').value,
  });
  if (res.status === 'ok') {
    navigate('myprofile');
  } else {
    showFieldError('editProfileError', res.message);
  }
};

document.getElementById('cancelEditProfile').onclick = () => navigate('myprofile');
document.getElementById('backFromEditProfile').onclick = () => navigate('myprofile');

// ---- Search ----
document.getElementById('searchBtn').onclick = async () => {
  const params = {
    action: 'search',
    name: document.getElementById('searchName').value,
    grade: document.getElementById('searchGrade').value,
    course: document.getElementById('searchCourse').value,
    clubs: document.getElementById('searchClubs').value,
  };
  const res = await get(API.profiles, params);
  if (res.status !== 'ok') { showError(res.message); return; }
  const profiles = res.profiles;
  if (profiles.length === 0) {
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
};

// Enter key on search inputs
document.querySelectorAll('#pageSearch input, #pageSearch select').forEach(el => {
  el.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('searchBtn').click(); };
});

// ---- Messages ----
async function loadPartners() {
  document.getElementById('partnerList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('partnerEmpty').style.display = 'none';
  const res = await get(API.messages, { action: 'partners' });
  if (res.status !== 'ok') { showError('メッセージ一覧の取得に失敗しました'); return; }
  const partners = res.partners;
  if (partners.length === 0) {
    document.getElementById('partnerList').innerHTML = '';
    document.getElementById('partnerEmpty').style.display = 'block';
    return;
  }
  document.getElementById('partnerList').innerHTML = partners.map(p => `
    <div class="partner-card" onclick="navigate('chat',{partnerId:${p.partner_id}})">
      ${avatarEl(p.name, 'sm')}
      <div class="partner-info">
        <div class="name">${esc(p.name)} ${p.unread_count > 0 ? `<span class="badge" style="position:static;display:inline-block;">${p.unread_count}</span>` : ''}</div>
        <div class="last-msg">${p.last_message ? esc(p.last_message) : ''}</div>
      </div>
      <div style="font-size:12px;color:#65676b;">${p.last_at ? timeAgo(p.last_at) : ''}</div>
    </div>
  `).join('');
}

function startDM(userId) {
  navigate('chat', { partnerId: userId });
}

async function openChat(partnerId) {
  chatPartnerId = partnerId;
  const res = await get(API.messages, { action: 'history', partner_id: partnerId });
  if (res.status !== 'ok') { showError('メッセージの取得に失敗しました'); return; }
  const partner = res.partner;
  document.getElementById('chatPartnerName').textContent = partner ? partner.name : '相手';
  document.getElementById('chatPartnerAvatar').textContent = (partner?.name || '?')[0].toUpperCase();
  renderMessages(res.messages);
  // Poll for new messages every 3 seconds
  chatInterval = setInterval(() => pollNewMessages(partnerId), 3000);
}

async function pollNewMessages(partnerId) {
  const res = await get(API.messages, { action: 'history', partner_id: partnerId });
  if (res.status === 'ok') renderMessages(res.messages);
}

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
  container.innerHTML = messages.map(m => {
    const isMine = m.sender_id == currentUserId;
    const time = new Date(m.sent_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `<div style="display:flex;flex-direction:column;align-items:${isMine ? 'flex-end' : 'flex-start'};">
      <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">${esc(m.content)}</div>
      <div class="chat-time" style="align-self:${isMine ? 'flex-end' : 'flex-start'}">${time}${isMine && m.is_read ? ' ✓既読' : ''}</div>
    </div>`;
  }).join('');
  if (wasAtBottom || messages.length === 0) {
    container.scrollTop = container.scrollHeight;
  }
}

document.getElementById('chatSendBtn').onclick = sendChatMessage;
document.getElementById('chatInput').onkeydown = (e) => { if (e.key === 'Enter') sendChatMessage(); };

async function sendChatMessage() {
  clearFieldError('chatError');
  const content = document.getElementById('chatInput').value.trim();
  if (!content) { showFieldError('chatError', 'メッセージを入力してください'); return; }
  if (new Blob([content]).size > 256) { showFieldError('chatError', 'メッセージは256バイト以下にしてください'); return; }
  const res = await post(API.messages, { action: 'send', receiver_id: chatPartnerId, content });
  if (res.status === 'ok') {
    document.getElementById('chatInput').value = '';
    pollNewMessages(chatPartnerId);
  } else {
    showFieldError('chatError', res.message);
  }
}

document.getElementById('backToMessages').onclick = () => {
  if (chatInterval) { clearInterval(chatInterval); chatInterval = null; }
  navigate('messages');
};

// ---- Notifications ----
async function loadNotifications() {
  document.getElementById('notifList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('notifEmpty').style.display = 'none';
  const res = await get(API.notifications, { action: 'list' });
  if (res.status !== 'ok') { showError('通知を取得できませんでした'); return; }
  const notifs = res.notifications;
  document.getElementById('notifBadge').style.display = 'none';
  if (notifs.length === 0) {
    document.getElementById('notifList').innerHTML = '';
    document.getElementById('notifEmpty').style.display = 'block';
    return;
  }
  document.getElementById('notifList').innerHTML = notifs.map(n => `
    <div class="notif-card ${n.is_read ? 'read' : ''}">
      <div>${n.type === 'reply' ? '💬' : '✉️'} ${esc(n.message)}</div>
      <div class="notif-time">${timeAgo(n.created_at)}</div>
    </div>
  `).join('');
}

function startNotifPolling() {
  checkBadges();
  notifInterval = setInterval(checkBadges, 15000);
}

async function checkBadges() {
  // Check unread notifications
  try {
    const res = await get(API.notifications, { action: 'list' });
    if (res.status === 'ok') {
      const unread = res.notifications.filter(n => !n.is_read).length;
      const badge = document.getElementById('notifBadge');
      if (unread > 0) { badge.textContent = unread; badge.style.display = 'inline-block'; }
      else { badge.style.display = 'none'; }
      // Re-mark as unread if we're not on notif page (hack: fetch without marking read)
    }
  } catch(e) {}
}

// ---- Helpers ----
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- Init ----
async function init() {
  // Check if already logged in
  try {
    const res = await get(API.auth, { action: 'check_session' });
    if (res.status === 'ok') {
      currentUserId = res.user_id;
      startApp();
    }
  } catch(e) {
    // Not logged in, show auth
  }
}

init();
