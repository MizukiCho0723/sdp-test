// C1 UI処理部 M4 タイムライン・投稿UI制御
// TimekineUIControl: W9タイムライン・W10投稿・W11返信画面の描画とUIイベント制御

function TimekineUIControl(action_type, ui_data = {}) {
  switch (action_type) {
    case 'load_timeline': return loadTimeline();
    case 'open_detail':   return loadPostDetail(ui_data.postId);
    case 'submit_post':   return _submitPost(ui_data.content);
    case 'delete_post':   return deletePost(ui_data.postId);
    case 'submit_reply':  return submitReply(ui_data.postId);
    default: return Promise.resolve(false);
  }
}

async function loadTimeline() {
  document.getElementById('timelineList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('timelineEmpty').style.display = 'none';
  const res = await get(API.posts, { action: 'list' });
  if (res.status !== 'ok') {
    // タイムラインデータ取得失敗 → W19エラー画面へ
    showError('タイムラインの取得に失敗しました');
    return;
  }
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

async function loadPostDetail(postId) {
  document.getElementById('detailContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.posts, { action: 'detail', post_id: postId });
  if (res.status !== 'ok') {
    // 投稿詳細取得失敗 → W19エラー画面へ
    showError('投稿が見つかりません');
    navigate('timeline');
    return;
  }
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

async function deletePost(postId) {
  if (!confirm('この投稿を削除しますか？')) return;
  const res = await post(API.posts, { action: 'delete', post_id: postId });
  if (res.status === 'ok') loadTimeline();
  else showError(res.message);
}

async function submitReply(postId) {
  clearFieldError('replyError');
  const content = document.getElementById('replyContent').value.trim();
  // M5でバリデーション
  const v = PostDataMediator(currentUserId, content, postId);
  if (!v.is_success) { showFieldError('replyError', v.error_message); return; }
  const res = await post(API.posts, { action: 'reply', post_id: postId, content });
  if (res.status === 'ok') {
    document.getElementById('replyContent').value = '';
    loadPostDetail(postId);
  } else {
    showFieldError('replyError', res.message);
  }
}

async function _submitPost(content) {
  const res = await post(API.posts, { action: 'create', content });
  if (res.status === 'ok') {
    document.getElementById('postContent').value = '';
    document.getElementById('postCharCount').textContent = '0 / 340文字';
    loadTimeline();
  } else {
    showFieldError('postError', res.message);
  }
}

// 投稿フォーム
document.getElementById('postContent').oninput = function () {
  document.getElementById('postCharCount').textContent = `${this.value.length} / 340文字`;
};

document.getElementById('postSubmitBtn').onclick = async () => {
  clearFieldError('postError');
  const content = document.getElementById('postContent').value.trim();
  // M5でバリデーション(target_post_id=null → 投稿)
  const v = PostDataMediator(currentUserId, content, null);
  if (!v.is_success) { showFieldError('postError', v.error_message); return; }
  await _submitPost(content);
};

document.getElementById('backToTimeline').onclick = () => navigate('timeline');
