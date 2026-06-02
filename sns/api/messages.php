<?php
require_once __DIR__ . '/config.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = requireLogin();

switch ($action) {
    case 'send':
        sendMessage($userId);
        break;
    case 'history':
        getHistory($userId);
        break;
    case 'partners':
        getPartners($userId);
        break;
    case 'mark_read':
        markRead($userId);
        break;
    default:
        jsonError('不正なアクション');
}

function sendMessage(int $userId): void {
    $receiverId = (int)($_POST['receiver_id'] ?? 0);
    $content = trim($_POST['content'] ?? '');
    if (!$receiverId) jsonError('送信相手を指定してください');
    if ($content === '') jsonError('メッセージを入力してください');
    if (strlen($content) > 256) jsonError('メッセージは256バイト以下（全角約85文字以内）にしてください');

    $db = getDB();
    // Verify receiver exists
    $check = $db->prepare('SELECT user_id FROM users WHERE user_id = ?');
    $check->execute([$receiverId]);
    if (!$check->fetch()) jsonError('送信相手が存在しません');

    $stmt = $db->prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $receiverId, $content]);
    $dmId = (int)$db->lastInsertId();

    // Notification
    $senderName = $db->query("SELECT name FROM profiles WHERE user_id = {$userId}")->fetchColumn();
    $notifStmt = $db->prepare('INSERT INTO notifications (user_id, type, ref_id, message) VALUES (?, ?, ?, ?)');
    $notifStmt->execute([$receiverId, 'message', $dmId, "{$senderName} さんからメッセージが届きました"]);

    $msg = $db->query("SELECT * FROM messages WHERE dm_id = {$dmId}")->fetch();
    jsonOk(['message' => $msg]);
}

function getHistory(int $userId): void {
    $partnerId = (int)($_GET['partner_id'] ?? 0);
    if (!$partnerId) jsonError('相手IDを指定してください');

    $db = getDB();
    $stmt = $db->prepare('
        SELECT m.dm_id, m.sender_id, m.receiver_id, m.content, m.sent_at, m.is_read,
               ps.name as sender_name, pr.name as receiver_name
        FROM messages m
        JOIN profiles ps ON m.sender_id = ps.user_id
        JOIN profiles pr ON m.receiver_id = pr.user_id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.sent_at ASC
    ');
    $stmt->execute([$userId, $partnerId, $partnerId, $userId]);
    $messages = $stmt->fetchAll();

    // Mark incoming messages as read
    $readStmt = $db->prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0');
    $readStmt->execute([$partnerId, $userId]);

    $partnerStmt = $db->prepare('SELECT pr.*, u.email FROM profiles pr JOIN users u ON pr.user_id = u.user_id WHERE pr.user_id = ?');
    $partnerStmt->execute([$partnerId]);
    $partner = $partnerStmt->fetch();

    jsonOk(['messages' => $messages, 'partner' => $partner]);
}

function getPartners(int $userId): void {
    $db = getDB();
    $stmt = $db->prepare('
        SELECT DISTINCT
            CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS partner_id,
            pr.name, pr.icon_id,
            (SELECT content FROM messages
             WHERE (sender_id = ? AND receiver_id = partner_id)
                OR (sender_id = partner_id AND receiver_id = ?)
             ORDER BY sent_at DESC LIMIT 1) AS last_message,
            (SELECT sent_at FROM messages
             WHERE (sender_id = ? AND receiver_id = partner_id)
                OR (sender_id = partner_id AND receiver_id = ?)
             ORDER BY sent_at DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages
             WHERE sender_id = partner_id AND receiver_id = ? AND is_read = 0) AS unread_count
        FROM messages m
        JOIN profiles pr ON pr.user_id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
        WHERE m.sender_id = ? OR m.receiver_id = ?
        ORDER BY last_at DESC
    ');
    $stmt->execute([$userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId]);
    $partners = $stmt->fetchAll();
    jsonOk(['partners' => $partners]);
}

function markRead(int $userId): void {
    $partnerId = (int)($_POST['partner_id'] ?? 0);
    if (!$partnerId) jsonError('相手IDを指定してください');
    $db = getDB();
    $stmt = $db->prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0');
    $stmt->execute([$partnerId, $userId]);
    jsonOk();
}
