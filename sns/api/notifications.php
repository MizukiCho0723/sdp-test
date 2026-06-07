<?php
require_once __DIR__ . '/config.php';

$userId = requireLogin();
$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        listNotifications($userId);
        break;
    case 'mark_read':
        markRead($userId);
        break;
    default:
        jsonError('不正なアクション');
}

function listNotifications(int $userId): void {
    $db = getDB();
    $stmt = $db->prepare('
        SELECT notif_id, type, ref_id, message, is_read, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ');
    $stmt->execute([$userId]);
    $notifs = $stmt->fetchAll();

    // Mark all as read
    $db->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$userId]);

    jsonOk(['notifications' => $notifs]);
}

function markRead(int $userId): void {
    $db = getDB();
    $db->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$userId]);
    jsonOk();
}
