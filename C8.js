import { getDB, requireLogin, jsonOk, jsonError } from './config.js';

/**
 * エントリポイント
 * Express 等のルータから (req, res) を受け取って各モジュールへ振り分ける。
 */
export function handlePosts(req, res) {
  const action = req.body.action ?? req.query.action ?? '';
  const userId = requireLogin(req, res); // ログイン必須チェック

  switch (action) {
    case 'create': {
      const content = String(req.body.content ?? '');
      const result = PostService.createPost(userId, content);
      
      if (result === true) {
        return jsonOk(res, { success: true, message: '投稿が完了しました' });
      } else if (result === false) {
        // 仕様E3: 失敗時はログを出力し（Service側で実行）、エラー画面W19へ遷移する指示を返却
        return jsonOk(res, { redirect: '/w19_error', message: 'DB登録に失敗しました' });
      } else {
        // バリデーションエラーメッセージ（E1, E2）を返却
        return jsonError(res, result, 400);
      }
    }

    case 'timeline': {
      const posts = PostService.getTimeline(userId);
      return jsonOk(res, { posts });
    }

    case 'detail': {
      const postId = Number(req.query.post_id ?? 0);
      const post = PostService.getPostDetail(postId);
      if (post === null) {
        return jsonError(res, '指定された投稿が見つかりません', 404);
      }
      return jsonOk(res, { post });
    }

    case 'delete': {
      const postId = Number(req.body.post_id ?? 0);
      const result = PostService.deletePost(postId, userId);
      if (result === true) {
        return jsonOk(res, { success: true, message: '投稿を削除しました' });
      } else if (result === false) {
        return jsonError(res, '削除処理に失敗しました（投稿が存在しません）', 400);
      } else {
        return jsonError(res, result, 403); // 権限エラー
      }
    }

    case 'exists': {
      const postId = Number(req.query.post_id ?? 0);
      const result = PostService.existsPost(postId, userId);
      return jsonOk(res, { exists: result });
    }

    default:
      return jsonError(res, '不正なアクション');
  }
}

// =================================================================
// C8 投稿情報処理部 (PostService)
// 担当者：長 美希
// =================================================================
export const PostService = {
  
  // ── M1 投稿登録処理 ─────────────────────────
  createPost(userID, content) {
    // 仕様E1: 投稿内容が空欄
    if (!content || content.trim() === "") {
      return "投稿内容を入力してください";
    }
    
    // 仕様E2 & データ仕様F2: 1024バイト未満（制限を厳格化して適用）
    if (Buffer.byteLength(content, 'utf8') >= 1024) {
      return "投稿内容は500文字以内にしてください";
    }

    // データ仕様「投稿時間 < 16バイト」を満たすため、秒数を省いた15バイトの文字列を生成
    // 例: "2026/06/30 12:00"
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const formattedTime = `${YYYY}/${MM}/${DD} ${hh}:${mm}`;

    const db = getDB();
    try {
      // データ仕様書のテーブル名「投稿」・カラム名「投稿者, 投稿内容, 投稿時間」に完全準拠
      db.prepare(`
        INSERT INTO 投稿 (投稿者, 投稿内容, 投稿時間) 
        VALUES (?, ?, ?)
      `).run(userID, content, formattedTime);
      return true;
    } catch (err) {
      // 仕様E3: DB登録に失敗。エラー内容をログに出力し、falseを返却
      console.error('[PostService.createPost] DB登録失敗:', err.message);
      return false;
    }
  },

  // ── M2 投稿取得処理（タイムライン） ─────────────────
  getTimeline(userID) {
    const db = getDB();
    try {
      // データ仕様F1, F2を結合（氏名を取得するため）
      const posts = db.prepare(`
        SELECT p.投稿ID AS postID, p.投稿者 AS userID, p.投稿内容 AS content, p.投稿時間 AS createdAt,
               u.氏名 AS userName
        FROM 投稿 p
        JOIN ユーザ情報 u ON p.投稿者 = u.User_ID
        ORDER BY p.投稿時間 DESC
      `).all();

      return posts ?? [];
    } catch (err) {
      console.error('[PostService.getTimeline] DBエラー:', err.message);
      return [];
    }
  },

  // ── M2 投稿取得処理（詳細） ─────────────────────────
  getPostDetail(postID) {
    const db = getDB();
    try {
      const post = db.prepare(`
        SELECT p.投稿ID AS postID, p.投稿者 AS userID, p.投稿内容 AS content, p.投稿時間 AS createdAt,
               u.氏名 AS userName
        FROM 投稿 p
        JOIN ユーザ情報 u ON p.投稿者 = u.User_ID
        WHERE p.投稿ID = ?
      `).get(postID);

      return post ?? null;
    } catch (err) {
      console.error('[PostService.getPostDetail] DBエラー:', err.message);
      return null;
    }
  },

  // ── M3 投稿削除処理 ─────────────────────────
  deletePost(postID, userID) {
    const db = getDB();
    try {
      const post = db.prepare('SELECT 投稿者 FROM 投稿 WHERE 投稿ID = ?').get(postID);
      
      if (!post) return false; // 投稿が存在しない

      if (post.投稿者 !== userID) {
        return "この投稿を削除する権限がありません"; // 本人ではない
      }

      // データ仕様書にフラグがないため、仕様書通り物理削除を実行
      db.prepare('DELETE FROM 投稿 WHERE 投稿ID = ?').run(postID);
      return true;
    } catch (err) {
      console.error('[PostService.deletePost] DB削除失敗:', err.message);
      return false;
    }
  },

  // ── M4 投稿存在確認処理 ───────────────────────
  existsPost(postID, userID) {
    // 投稿IDが不正な値（0以下など）である場合、処理を中断しfalse
    if (!postID || postID <= 0) return false;

    const db = getDB();
    try {
      const post = db.prepare('SELECT 投稿ID FROM 投稿 WHERE 投稿ID = ?').get(postID);
      return !!post;
    } catch (err) {
      console.error('[PostService.existsPost] DBエラー:', err.message);
      return false;
    }
  }
};
