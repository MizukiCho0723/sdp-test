<?php
require_once __DIR__ . '/config.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = requireLogin();

switch ($action) {
    case 'create':
        createPost($userId);
        break;
    case 'list':
        listPosts($userId);
        break;
    case 'detail':
        getDetail($userId);
        break;
    case 'reply':
        createReply($userId);
        break;
    case 'delete':
        deletePost($userId);
        break;
    default:
        jsonError('不正なアクション');
}

function createPost(int $userId): void {
    $content = trim($_POST['content'] ?? '');
    if ($content === '') jsonError('投稿内容を入力してください');
    if (strlen($content) > 1024) jsonError('投稿内容は1024バイト以下（全角約340文字以内）にしてください');

    $db = getDB();
    $stmt = $db->prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
    $stmt->execute([$userId, $content]);
    $postId = (int)$db->lastInsertId();

    jsonOk(['post_id' => $postId]);
}

function listPosts(int $userId): void {
    $offset = (int)($_GET['offset'] ?? 0);
    $limit = 20;
    $db = getDB();
    $stmt = $db->prepare('
        SELECT p.post_id, p.content, p.created_at,
               TRIM(pr.last_name || ' ' || pr.first_name) AS name, pr.icon_id, p.user_id,
               (SELECT COUNT(*) FROM replies WHERE post_id = p.post_id) as reply_count
        FROM posts p
        JOIN profiles pr ON p.user_id = pr.user_id
        WHERE p.deleted = 0
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    ');
    $stmt->execute([$limit, $offset]);
    $posts = $stmt->fetchAll();
    jsonOk(['posts' => $posts]);
}

function getDetail(int $userId): void {
    $postId = (int)($_GET['post_id'] ?? 0);
    if (!$postId) jsonError('投稿IDが不正です');

    $db = getDB();
    $stmt = $db->prepare('
        SELECT p.post_id, p.content, p.created_at, p.user_id,
               TRIM(pr.last_name || ' ' || pr.first_name) AS name, pr.icon_id
        FROM posts p
        JOIN profiles pr ON p.user_id = pr.user_id
        WHERE p.post_id = ? AND p.deleted = 0
    ');
    $stmt->execute([$postId]);
    $post = $stmt->fetch();
    if (!$post) jsonError('投稿が見つかりません', 404);

    $stmt2 = $db->prepare('
        SELECT r.reply_id, r.content, r.created_at, r.user_id,
               TRIM(pr.last_name || ' ' || pr.first_name) AS name, pr.icon_id
        FROM replies r
        JOIN profiles pr ON r.user_id = pr.user_id
        WHERE r.post_id = ?
        ORDER BY r.created_at ASC
    ');
    $stmt2->execute([$postId]);
    $replies = $stmt2->fetchAll();

    jsonOk(['post' => $post, 'replies' => $replies]);
}

function createReply(int $userId): void {
    $postId = (int)($_POST['post_id'] ?? 0);
    $content = trim($_POST['content'] ?? '');
    if (!$postId) jsonError('投稿IDが不正です');
    if ($content === '') jsonError('返信内容を入力してください');
    if (strlen($content) > 1024) jsonError('返信内容は1024バイト以下（全角約340文字以内）にしてください');

    $db = getDB();
    // Check post exists
    $check = $db->prepare('SELECT user_id FROM posts WHERE post_id = ? AND deleted = 0');
    $check->execute([$postId]);
    $post = $check->fetch();
    if (!$post) jsonError('返信対象の投稿が見つかりません', 404);

    $stmt = $db->prepare('INSERT INTO replies (post_id, user_id, content) VALUES (?, ?, ?)');
    $stmt->execute([$postId, $userId, $content]);
    $replyId = (int)$db->lastInsertId();

    // Create notification for post author
    if ($post['user_id'] !== $userId) {
        $senderName = getDB()->query("SELECT TRIM(last_name || ' ' || first_name) FROM profiles WHERE user_id = {$userId}")->fetchColumn();
        $notifStmt = $db->prepare('INSERT INTO notifications (user_id, type, ref_id, message) VALUES (?, ?, ?, ?)');
        $notifStmt->execute([$post['user_id'], 'reply', $replyId, "{$senderName} さんが投稿に返信しました"]);
    }
    jsonOk(['reply_id' => $replyId]);
}

function deletePost(int $userId): void {
    $postId = (int)($_POST['post_id'] ?? 0);
    if (!$postId) jsonError('投稿IDが不正です');
    $db = getDB();
    $stmt = $db->prepare('UPDATE posts SET deleted = 1 WHERE post_id = ? AND user_id = ?');
    $stmt->execute([$postId, $userId]);
    if ($stmt->rowCount() === 0) jsonError('削除できません', 403);
    jsonOk();
}
