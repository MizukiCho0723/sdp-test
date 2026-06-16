// C1 UI処理部 エントリポイント
// init(): セッション確認後にアプリを起動する

async function init() {
  try {
    const res = await get(API.auth, { action: 'check_session' });
    if (res.status === 'ok') {
      currentUserId = res.user_id;
      startApp();
    }
  } catch (e) {
    // 未ログイン状態 → 認証画面はデフォルト表示済み
  }
}

init();
