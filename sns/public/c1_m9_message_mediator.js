// C1 UI処理部 M9 メッセージデータ処理仲介
// MediatorMessageAlert: W21チャット画面のデータ取得・送信・ポーリング・描画を担当

async function MediatorMessageAlert(action_type, message_data = {}) {
  switch (action_type) {
    case 'open':   return await openChat(message_data.partnerId);
    case 'send':   return await sendChatMessage();
    case 'poll':   return await pollNewMessages(message_data.partnerId);
    default:       return null;
  }
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
  // 3秒ごとに新着をポーリング
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

async function sendChatMessage() {
  clearFieldError('chatError');
  const content = document.getElementById('chatInput').value.trim();
  if (!content) { showFieldError('chatError', 'メッセージを入力してください'); return; }
  if (new Blob([content]).size > 256) { showFieldError('chatError', 'メッセージは256バイト以下にしてください'); return; }
  const res = await post(API.messages, { action: 'send', receiver_id: chatPartnerId, content });
  if (res.status === 'ok') {
    document.getElementById('chatInput').value = '';
    await pollNewMessages(chatPartnerId);
  } else {
    showFieldError('chatError', res.message);
  }
}

document.getElementById('chatSendBtn').onclick = sendChatMessage;
document.getElementById('chatInput').onkeydown = (e) => { if (e.key === 'Enter') sendChatMessage(); };

document.getElementById('backToMessages').onclick = () => {
  if (chatInterval) { clearInterval(chatInterval); chatInterval = null; }
  navigate('messages');
};
