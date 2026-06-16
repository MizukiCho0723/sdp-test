// C1 UI処理部 M1 UI共通制御・ルーティング
// RouterMain: システム全体の画面遷移を制御する

function RouterMain(request_url, extra = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById('page' + request_url.charAt(0).toUpperCase() + request_url.slice(1));
  if (!pageEl) {
    // 不正なURL → W19エラー画面へ遷移
    showError('ページが見つかりません');
    return 0;
  }
  pageEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${request_url}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (chatInterval && request_url !== 'chat') {
    clearInterval(chatInterval);
    chatInterval = null;
  }

  prevPage = currentPage;
  currentPage = request_url;

  if (request_url === 'timeline')    loadTimeline();
  if (request_url === 'search')      document.getElementById('searchResults').innerHTML = '';
  if (request_url === 'messages')    loadPartners();
  if (request_url === 'notifications') loadNotifications();
  if (request_url === 'myprofile')   loadMyProfile();
  if (request_url === 'postDetail'   && extra.postId)    loadPostDetail(extra.postId);
  if (request_url === 'chat'         && extra.partnerId) openChat(extra.partnerId);
  if (request_url === 'otherProfile' && extra.userId)    loadOtherProfile(extra.userId);
  if (request_url === 'editProfile') loadEditProfile();

  return 1;
}

// navigate は RouterMain の別名(後方互換)
function navigate(page, extra = {}) {
  return RouterMain(page, extra);
}

function showAuthPage(page) {
  ['loginPage', 'registerPage', 'resetPage'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById(page).style.display = 'flex';
}

function startApp() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
  navigate('timeline');
  startNotifPolling();
}

document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.onclick = () => navigate(btn.dataset.page);
});
