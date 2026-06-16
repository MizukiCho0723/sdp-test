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
    $senderName = $db->query("SELECT TRIM(last_name || ' ' || first_name) FROM profiles WHERE user_id = {$userId}")->fetchColumn();
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
               TRIM(ps.last_name || \' \' || ps.first_name) as sender_name,
               TRIM(pr.last_name || \' \' || pr.first_name) as receiver_name
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

    $partnerStmt = $db->prepare("SELECT pr.*, u.email, TRIM(pr.last_name || ' ' || pr.first_name) AS name FROM profiles pr JOIN users u ON pr.user_id = u.user_id WHERE pr.user_id = ?");
    $partnerStmt->execute([$partnerId]);
    $partner = $partnerStmt->fetch();

    jsonOk(['messages' => $messages, 'partner' => $partner]);
}

function getPartners(int $userId): void {
    $db = getDB();

    // 会話相手のIDを取得
    $stmt = $db->prepare('
        SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
        FROM messages WHERE sender_id = ? OR receiver_id = ?
    ');
    $stmt->execute([$userId, $userId, $userId]);
    $partnerIds = array_column($stmt->fetchAll(), 'partner_id');

    $partners = [];
    foreach ($partnerIds as $pid) {
        $pr = $db->prepare("SELECT TRIM(last_name || ' ' || first_name) AS name, icon_id FROM profiles WHERE user_id = ?");
        $pr->execute([$pid]);
        $profile = $pr->fetch();
        if (!$profile) continue;

        $lm = $db->prepare('
            SELECT content, sent_at FROM messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY sent_at DESC LIMIT 1
        ');
        $lm->execute([$userId, $pid, $pid, $userId]);
        $lastMsg = $lm->fetch();

        $ur = $db->prepare('SELECT COUNT(*) FROM messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0');
        $ur->execute([$pid, $userId]);
        $unread = (int)$ur->fetchColumn();

        $partners[] = [
            'partner_id' => $pid,
            'name' => $profile['name'],
            'icon_id' => $profile['icon_id'],
            'last_message' => $lastMsg['content'] ?? '',
            'last_at' => $lastMsg['sent_at'] ?? '',
            'unread_count' => $unread,
        ];
    }

    usort($partners, fn($a, $b) => strcmp($b['last_at'], $a['last_at']));
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
