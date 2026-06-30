import { getDB, requireLogin, jsonOk, jsonError } from './config.js';

/**
 * エントリポイント
 * Express 等のルータから (req, res) を受け取って各モジュールへ振り分ける。
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
export function handleMessages(req, res) {
  const action = req.body.action ?? req.query.action ?? '';
  const userId = requireLogin(req, res); // 未ログイン時は内部で 401 を返して処理終了

  switch (action) {
    case 'send':
      sendMessage(req, res, userId);
      break;
    case 'history':
      getMessageHistory(req, res, userId);
      break;
    case 'partners':
      getMessagePartners(req, res, userId);
      break;
    case 'mark_read':
      markAsRead(req, res, userId);
      break;
    case 'unread_notifications':
      getUnreadMessageNotifications(req, res, userId);
      break;
    case 'realtime_update':
      updateNewMessages(req, res, userId);
      break;
    default:
      jsonError(res, '不正なアクション');
  }
}


//M1
/**
 * W14 メッセージ送受信画面からのメッセージ送信。
 * 入力検証 → メッセージデータ生成 → DB 保存。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   senderID  ログイン中ユーザ ID
 */
function sendMessage(req, res, senderID) {
  const receiverID = Number(req.body.receiver_id ?? 0);
  const content    = (req.body.content ?? '').trim();

  // ── 入力検証 ─────────────────────────
  if (!receiverID) {
    return jsonError(res, '送信相手を指定してください');
  }
  if (content === '') {
    // W14-E1
    return jsonError(res, 'メッセージを入力してください．');
  }
  if (Buffer.byteLength(content, 'utf8') > 256) {
    // W14-E2: 設計書データ仕様は 256 バイト
    return jsonError(res, 'メッセージは全角約 500 文字以内にしてください．');
  }

  const db = getDB();

  // 宛先ユーザ存在チェック（存在しない場合は中断）
  const receiver = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(receiverID);
  if (!receiver) {
    return jsonError(res, '送信相手が存在しません');
  }

  // ── DB 保存 ──────────────────────────
  try {
    const insert = db.prepare(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)'
    );
    const result = insert.run(senderID, receiverID, content);
    const dmId   = result.lastInsertRowid;

    // 通知登録
    const senderName = db
      .prepare("SELECT TRIM(last_name || ' ' || first_name) FROM profiles WHERE user_id = ?")
      .pluck()
      .get(senderID);

    db.prepare(
      'INSERT INTO notifications (user_id, type, ref_id, message) VALUES (?, ?, ?, ?)'
    ).run(receiverID, 'message', dmId, `${senderName} さんからメッセージが届きました`);

    const msg = db.prepare('SELECT * FROM messages WHERE dm_id = ?').get(dmId);
    return jsonOk(res, { message: msg });
  } catch (err) {
    console.error('[M1_sendMessage] DB 保存失敗:', err);
    return jsonError(res, 'メッセージの送信に失敗しました', 500);
  }
}

//M2
/**
 * ログイン中ユーザと指定相手との会話履歴を時系列で取得。
 * 取得と同時に未読を既読化（M4 を内部呼び出し）。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function getMessageHistory(req, res, loginUserID) {
  const partnerID = Number(req.query.partner_id ?? 0);
  if (!partnerID) {
    return jsonError(res, '相手IDを指定してください');
  }

  const db = getDB();

  try {
    // 送受信履歴を時系列取得
    const messages = db.prepare(`
      SELECT m.dm_id, m.sender_id, m.receiver_id, m.content, m.sent_at, m.is_read,
             TRIM(ps.last_name || ' ' || ps.first_name) AS sender_name,
             TRIM(pr.last_name || ' ' || pr.first_name) AS receiver_name
      FROM messages m
      JOIN profiles ps ON m.sender_id  = ps.user_id
      JOIN profiles pr ON m.receiver_id = pr.user_id
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.sent_at ASC
    `).all(loginUserID, partnerID, partnerID, loginUserID);

    // 相手からの未読を既読化
    db.prepare(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0'
    ).run(partnerID, loginUserID);

    // 相手プロフィール取得
    const partner = db.prepare(`
      SELECT pr.*, u.email,
             TRIM(pr.last_name || ' ' || pr.first_name) AS name
      FROM profiles pr
      JOIN users u ON pr.user_id = u.user_id
      WHERE pr.user_id = ?
    `).get(partnerID);

    // 指定相手との履歴が 0 件の場合は空配列（エラーとしない）
    return jsonOk(res, { messages, partner });
  } catch (err) {
    console.error('[M2_getMessageHistory] DB 取得失敗:', err);
    return jsonOk(res, { messages: [], partner: null });
  }
}


//M3
/**
 * 前回取得時刻以降の新着メッセージのみを返す（ポーリング用）。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function updateNewMessages(req, res, loginUserID) {
  const partnerID      = Number(req.query.partner_id ?? 0);
  const lastUpdateTime = req.query.last_update_time ?? '';

  if (!partnerID) {
    return jsonError(res, '相手IDを指定してください');
  }
  if (!lastUpdateTime) {
    return jsonError(res, '前回取得時刻を指定してください');
  }

  const db = getDB();

  try {
    const newMessages = db.prepare(`
      SELECT m.dm_id, m.sender_id, m.receiver_id, m.content, m.sent_at, m.is_read,
             TRIM(ps.last_name || ' ' || ps.first_name) AS sender_name
      FROM messages m
      JOIN profiles ps ON m.sender_id = ps.user_id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.sent_at > ?
      ORDER BY m.sent_at ASC
    `).all(loginUserID, partnerID, partnerID, loginUserID, lastUpdateTime);

    // 新着なしの場合も空配列で正常応答（エラーとしない）
    return jsonOk(res, { new_messages: newMessages });
  } catch (err) {
    console.error('[M3_updateNewMessages] DB 取得失敗:', err);
    return jsonOk(res, { new_messages: [] });
  }
}

//M4
/**
 * 指定相手からの未読メッセージを既読に更新する。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function markAsRead(req, res, loginUserID) {
  const partnerID = Number(req.body.partner_id ?? 0);
  if (!partnerID) {
    return jsonError(res, '相手IDを指定してください');
  }

  const db = getDB();

  try {
    db.prepare(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0'
    ).run(partnerID, loginUserID);

    // 既読対象の未読が存在しない場合も true（エラーとしない）
    return jsonOk(res);
  } catch (err) {
    console.error('[M4_markAsRead] DB 更新失敗:', err);
    return jsonError(res, '既読更新に失敗しました', 500);
  }
}

//M5
/**
 * ログイン中ユーザ宛の未読メッセージ通知一覧を返す。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function getUnreadMessageNotifications(req, res, loginUserID) {
  const db = getDB();

  try {
    const notifications = db.prepare(`
      SELECT m.dm_id, m.sender_id, m.content AS last_content, m.sent_at,
             TRIM(ps.last_name || ' ' || ps.first_name) AS sender_name,
             ps.icon_id
      FROM messages m
      JOIN profiles ps ON m.sender_id = ps.user_id
      WHERE m.receiver_id = ? AND m.is_read = 0
      ORDER BY m.sent_at DESC
    `).all(loginUserID);

    // 未読なしの場合も空配列で正常応答
    return jsonOk(res, { notifications });
  } catch (err) {
    console.error('[M5_getUnreadMessageNotifications] DB 取得失敗:', err);
    return jsonOk(res, { notifications: [] });
  }
}

//M6
/**
 * ログイン中ユーザが過去にやり取りした相手の一覧を
 * 最終メッセージ・未読数付きで返す。
 * セッション切れは requireLogin() が担当。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function getMessagePartners(req, res, loginUserID) {
  const db = getDB();

  try {
    // 会話相手 ID 一覧
    const partnerRows = db.prepare(`
      SELECT DISTINCT
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
    `).all(loginUserID, loginUserID, loginUserID);

    const partners = [];

    for (const { partner_id: pid } of partnerRows) {
      const profile = db.prepare(`
        SELECT TRIM(last_name || ' ' || first_name) AS name, icon_id
        FROM profiles WHERE user_id = ?
      `).get(pid);
      if (!profile) continue;

      const lastMsg = db.prepare(`
        SELECT content, sent_at FROM messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY sent_at DESC LIMIT 1
      `).get(loginUserID, pid, pid, loginUserID);

      const unreadCount = db.prepare(`
        SELECT COUNT(*) AS cnt FROM messages
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `).get(pid, loginUserID).cnt;

      partners.push({
        partner_id:   pid,
        name:         profile.name,
        icon_id:      profile.icon_id,
        last_message: lastMsg?.content ?? '',
        last_at:      lastMsg?.sent_at ?? '',
        unread_count: unreadCount,
      });
    }

    // 最終メッセージ日時の降順でソート
    partners.sort((a, b) => (b.last_at > a.last_at ? 1 : -1));

    // 過去に誰ともやり取りがない場合も空配列で正常応答
    return jsonOk(res, { partners });
  } catch (err) {
    console.error('[M6_getMessagePartners] DB 取得失敗:', err);
    return jsonOk(res, { partners: [] });
  }
}
