// C1 UI処理部 M5 投稿・返信データ処理仲介
// PostDataMediator: 投稿・返信本文のバリデーションを行いC3/C6へ引き渡す

function PostDataMediator(user_id, content, target_post_id) {
  const isReply = target_post_id !== null && target_post_id !== undefined;

  if (!content || content.trim() === '') {
    return {
      is_success: false,
      error_message: isReply
        ? '返信内容を入力してください．'
        : '投稿内容を入力してください．',
    };
  }

  if (new Blob([content]).size > 1024) {
    return {
      is_success: false,
      error_message: isReply
        ? '返信内容は 1024 バイト以下（全角約 340 文字以内）にしてください．'
        : '投稿内容は 1024 バイト以下（全角約 340 文字以内）にしてくだい．',
    };
  }

  return { is_success: true, error_message: '' };
}
