<?php
require_once __DIR__ . '/config.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'send_code':
        sendCode();
        break;
    case 'verify_code':
        verifyCode();
        break;
    case 'register':
        register();
        break;
    case 'login':
        login();
        break;
    case 'logout':
        logout();
        break;
    case 'reset_password':
        resetPassword();
        break;
    case 'check_session':
        checkSession();
        break;
    default:
        jsonError('不正なアクション');
}

function sendCode(): void {
    $email = trim($_POST['email'] ?? '');
    if (!validateEmail($email)) {
        jsonError('芝浦工業大学のメールアドレスを入力してください');
    }
    $code = generateCode();
    $expires = date('Y-m-d H:i:s', time() + 600);
    $db = getDB();
    $stmt = $db->prepare('INSERT OR REPLACE INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$email, $code, $expires]);
    sendAuthEmail($email, $code);
    jsonOk(['message' => '認証コードを送信しました']);
}

function verifyCode(): void {
    $email = trim($_POST['email'] ?? '');
    $code = trim($_POST['code'] ?? '');
    if (!$email || !$code) {
        jsonError('メールアドレスと認証コードを入力してください');
    }
    $db = getDB();
    $stmt = $db->prepare('SELECT code, expires_at FROM auth_codes WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || $row['code'] !== $code || strtotime($row['expires_at']) < time()) {
        jsonError('認証コードが正しくありません');
    }
    $_SESSION['verified_email'] = $email;
    jsonOk();
}

function register(): void {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';
    $name = trim($_POST['name'] ?? '');
    $grade = (int)($_POST['grade'] ?? -1);

    if (!validateEmail($email)) {
        jsonError('芝浦工業大学のメールアドレスを入力してください');
    }
    if (($_SESSION['verified_email'] ?? '') !== $email) {
        jsonError('メールアドレスの認証が完了していません');
    }
    if (strlen($password) < 8 || strlen($password) > 16) {
        jsonError('パスワードは8〜16文字で入力してください');
    }
    if (!preg_match('/[a-zA-Z]/', $password) || !preg_match('/[0-9]/', $password)) {
        jsonError('パスワードには英数字記号すべてが含まれている必要があります');
    }
    if ($password !== $confirm) {
        jsonError('パスワードが一致しません');
    }
    if ($name === '') {
        jsonError('氏名を入力してください');
    }
    if (strlen($name) > 64) {
        jsonError('名前は64バイト以下にしてください');
    }
    if ($grade < 0) {
        jsonError('学年/職員欄を選択してください');
    }

    $db = getDB();
    try {
        $db->beginTransaction();
        $stmt = $db->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        $stmt->execute([$email, hashPassword($password)]);
        $userId = (int)$db->lastInsertId();

        $dept = trim($_POST['department'] ?? '');
        $course = trim($_POST['course'] ?? '');
        $lab = trim($_POST['lab'] ?? '');
        $clubs = trim($_POST['clubs'] ?? '');
        $bio = trim($_POST['bio'] ?? '');

        $stmt2 = $db->prepare('INSERT INTO profiles (user_id, name, grade, department, course, lab, clubs, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt2->execute([$userId, $name, $grade, $dept, $course, $lab, $clubs, $bio]);

        $db->exec("DELETE FROM auth_codes WHERE email = '{$email}'");
        $db->commit();
        unset($_SESSION['verified_email']);
        jsonOk(['message' => '会員登録が完了しました']);
    } catch (Exception $e) {
        $db->rollBack();
        if (str_contains($e->getMessage(), 'UNIQUE')) {
            jsonError('このメールアドレスはすでに登録されています');
        }
        jsonError('登録に失敗しました: ' . $e->getMessage());
    }
}

function login(): void {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    if (!$email) jsonError('メールアドレスを入力してください');
    if (!$password) jsonError('パスワードを入力してください');

    $db = getDB();
    $stmt = $db->prepare('SELECT user_id, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !verifyPassword($password, $user['password_hash'])) {
        jsonError('メールアドレスまたはパスワードが不正です');
    }
    $_SESSION['user_id'] = $user['user_id'];
    jsonOk(['user_id' => $user['user_id']]);
}

function logout(): void {
    session_destroy();
    jsonOk();
}

function resetPassword(): void {
    $email = trim($_POST['email'] ?? '');
    $code = trim($_POST['code'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';

    if (!$email) jsonError('メールアドレスを入力してください');
    if (!validateEmail($email)) jsonError('芝浦工業大学のメールアドレスを入力してください');

    // Step 1: just send code (handled by send_code action)
    // Step 2: verify code and set new password
    if ($code && $password) {
        $db = getDB();
        $stmt = $db->prepare('SELECT code, expires_at FROM auth_codes WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if (!$row || $row['code'] !== $code || strtotime($row['expires_at']) < time()) {
            jsonError('認証コードが異なっています');
        }
        if (!$password) jsonError('新しいパスワードを入力してください');
        if ($password !== $confirm) jsonError('パスワードが一致しません');
        if (strlen($password) < 8 || strlen($password) > 16) jsonError('パスワードは8〜16文字で入力してください');

        $stmt2 = $db->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
        $stmt2->execute([hashPassword($password), $email]);
        if ($stmt2->rowCount() === 0) {
            // Email not registered - silent fail per spec
        }
        $db->exec("DELETE FROM auth_codes WHERE email = '{$email}'");
        jsonOk(['message' => '再設定が完了しました']);
    }
}

function checkSession(): void {
    if (!empty($_SESSION['user_id'])) {
        jsonOk(['user_id' => $_SESSION['user_id']]);
    } else {
        jsonError('未ログイン', 401);
    }
}
