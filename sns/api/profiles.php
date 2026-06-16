<?php
require_once __DIR__ . '/config.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = requireLogin();

switch ($action) {
    case 'get':
        getProfile($userId);
        break;
    case 'update':
        updateProfile($userId);
        break;
    case 'search':
        searchProfiles($userId);
        break;
    default:
        jsonError('不正なアクション');
}

function getProfile(int $loginUserId): void {
    $targetId = (int)($_GET['user_id'] ?? $loginUserId);
    $db = getDB();
    $stmt = $db->prepare('
        SELECT pr.*, u.email,
               TRIM(pr.last_name || ' ' || pr.first_name) AS name,
               (? = pr.user_id) AS is_own
        FROM profiles pr
        JOIN users u ON pr.user_id = u.user_id
        WHERE pr.user_id = ?
    ');
    $stmt->execute([$loginUserId, $targetId]);
    $profile = $stmt->fetch();
    if (!$profile) jsonError('このユーザーは退会済みです', 404);
    jsonOk(['profile' => $profile]);
}

function updateProfile(int $userId): void {
    $lastName = trim($_POST['last_name'] ?? '');
    $firstName = trim($_POST['first_name'] ?? '');
    $bio = trim($_POST['bio'] ?? '');
    if ($lastName === '') jsonError('名前（姓）を入力してください（名前は必須項目です）');
    if (strlen($lastName . ' ' . $firstName) > 64) jsonError('名前は64バイト以下（全角約21文字以内）にしてください');
    if (strlen($bio) > 1024) jsonError('自己紹介は1024バイト以下（全角約340文字以内）にしてください');

    $grade = (int)($_POST['grade'] ?? 0);
    $department = trim($_POST['department'] ?? '');
    $course = trim($_POST['course'] ?? '');
    $lab = trim($_POST['lab'] ?? '');
    $clubs = trim($_POST['clubs'] ?? '');
    $timetable = trim($_POST['timetable'] ?? '');

    $db = getDB();
    $stmt = $db->prepare('
        UPDATE profiles SET last_name=?, first_name=?, grade=?, department=?, course=?, lab=?, clubs=?, bio=?, timetable=?
        WHERE user_id=?
    ');
    $stmt->execute([$lastName, $firstName, $grade, $department, $course, $lab, $clubs, $bio, $timetable, $userId]);
    jsonOk();
}

function searchProfiles(int $loginUserId): void {
    $db = getDB();
    $conditions = ['pr.user_id != :login'];
    $params = [':login' => $loginUserId];

    $name = trim($_GET['name'] ?? '');
    $grade = $_GET['grade'] ?? '';
    $course = trim($_GET['course'] ?? '');
    $clubs = trim($_GET['clubs'] ?? '');

    if ($name !== '') {
        // 「姓 名」「姓名」どちらの書き方でもヒットさせる
        $conditions[] = "((pr.last_name || ' ' || pr.first_name) LIKE :name OR (pr.last_name || pr.first_name) LIKE :name2)";
        $params[':name'] = '%' . $name . '%';
        $params[':name2'] = '%' . $name . '%';
    }
    if ($grade !== '') {
        $conditions[] = 'pr.grade = :grade';
        $params[':grade'] = (int)$grade;
    }
    if ($course !== '') {
        $conditions[] = 'pr.course LIKE :course';
        $params[':course'] = '%' . $course . '%';
    }
    if ($clubs !== '') {
        $conditions[] = 'pr.clubs LIKE :clubs';
        $params[':clubs'] = '%' . $clubs . '%';
    }

    $lab = trim($_GET['lab'] ?? '');
    if ($lab !== '') {
        $conditions[] = 'pr.lab LIKE :lab';
        $params[':lab'] = '%' . $lab . '%';
    }

    $where = implode(' AND ', $conditions);
    $stmt = $db->prepare("
        SELECT pr.user_id, TRIM(pr.last_name || ' ' || pr.first_name) AS name,
               pr.icon_id, pr.grade, pr.department, pr.course, pr.bio
        FROM profiles pr
        WHERE {$where}
        ORDER BY pr.last_name, pr.first_name
        LIMIT 50
    ");
    $stmt->execute($params);
    $results = $stmt->fetchAll();
    jsonOk(['profiles' => $results]);
}
