<?php
define('DB_PATH', '/var/www/sns_data/db/OrderManage.db');
date_default_timezone_set('Asia/Tokyo');
define('DOMAIN', 'shibaura-it.ac.jp');
define('SESSION_LIFETIME', 3600);

session_set_cookie_params([
    'lifetime' => SESSION_LIFETIME,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA journal_mode=WAL;');
        $pdo->exec('PRAGMA foreign_keys=ON;');
    }
    return $pdo;
}

function jsonOk(array $data = []): void {
    echo json_encode(['status' => 'ok'] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['status' => 'error', 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function requireLogin(): int {
    if (empty($_SESSION['user_id'])) {
        jsonError('ログインが必要です', 401);
    }
    return (int)$_SESSION['user_id'];
}

function validateEmail(string $email): bool {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    return str_ends_with($email, '@' . DOMAIN);
}

function hashPassword(string $password): string {
    return password_hash($password, PASSWORD_BCRYPT);
}

function verifyPassword(string $password, string $hash): bool {
    return password_verify($password, $hash);
}

function generateCode(): string {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function sendAuthEmail(string $email, string $code): bool {
    $subject = '[SNS] 認証コードのご案内';
    $body = "認証コード: {$code}\n\nこのコードは10分間有効です。";
    $headers = "From: noreply@shibaura-it.ac.jp\r\n";
    // In production, use mail() or SMTP library
    // For development, just log the code
    error_log("Auth code for {$email}: {$code}");
    // Try to send real email
    @mail($email, $subject, $body, $headers);
    return true;
}
