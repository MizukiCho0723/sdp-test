// C1 UI処理部 M8 共通制御メッセージ・通知UI制御
// MessageAlertUIcontrol: W18通知確認画面の表示と未読・既読のUI状態制御
// W20メッセージ送受信相手一覧の描画も担当する

async function MessageAlertUIcontrol(current_user_id) {
  return await loadNotifications();
}

async function loadNotifications() {
  document.getElementById('notifList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('notifEmpty').style.display = 'none';

  const res = await get(API.notifications, { action: 'list' });
  if (res.status !== 'ok') {
    // 通知取得失敗 → エラーメッセージ表示(W18エラー処理)
    document.getElementById('notifList').innerHTML = '<div class="empty-state">通知を取得できませんでした</div>';
    return 0;
  }

  const notifs = res.notifications;
  document.getElementById('notifBadge').style.display = 'none';

  if (notifs.length === 0) {
    // W18-E1: 通知が一件も存在しない
    document.getElementById('notifList').innerHTML = '';
    document.getElementById('notifEmpty').style.display = 'block';
    return 1;
  }

  document.getElementById('notifList').innerHTML = notifs.map(n => `
    <div class="notif-card ${n.is_read ? 'read' : ''}">
      <div>${n.type === 'reply' ? '💬' : '✉️'} ${esc(n.message)}</div>
      <div class="notif-time">${timeAgo(n.created_at)}</div>
    </div>
  `).join('');
  return 1;
}

function startNotifPolling() {
  checkBadges();
  notifInterval = setInterval(checkBadges, 15000);
}

async function checkBadges() {
  try {
    const res = await get(API.notifications, { action: 'list' });
    if (res.status === 'ok') {
      const unread = res.notifications.filter(n => !n.is_read).length;
      const badge = document.getElementById('notifBadge');
      if (unread > 0) { badge.textContent = unread; badge.style.display = 'inline-block'; }
      else { badge.style.display = 'none'; }
    }
  } catch (e) {}
}

// W20 メッセージ送受信相手一覧
async function loadPartners() {
  document.getElementById('partnerList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('partnerEmpty').style.display = 'none';
  const res = await get(API.messages, { action: 'partners' });
  if (res.status !== 'ok') { showError('メッセージ一覧の取得に失敗しました'); return; }
  const partners = res.partners;
  if (partners.length === 0) {
    // W20-E1: やり取り相手が存在しない
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
