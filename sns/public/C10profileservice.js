import { getDB, requireLogin, jsonOk, jsonError } from './config.js';

/**
 * エントリポイント
 * Express 等のルータから (req, res) を受け取って各モジュールへ振り分ける。
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
export function handleProfiles(req, res) {
  const action = req.body.action ?? req.query.action ?? '';
  const userId = requireLogin(req, res);

  switch (action) {
    case 'get':
      getProfile(req, res, userId);
      break;
    case 'update':
      updateProfile(req, res, userId);
      break;
    case 'search':
      searchProfiles(req, res, userId);
      break;
    case 'exists':
      existsUser(req, res, userId);
      break;
    case 'init':
      createInitialProfile(req, res, userId);
      break;
    default:
      jsonError(res, '不正なアクション');
  }
}

//M1
/**
 * 指定ユーザ ID のプロフィールを取得して返す。
 * user_id が未指定の場合は自分自身のプロフィールを返す。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function getProfile(req, res, loginUserID) {
  const targetID = Number(req.query.user_id ?? loginUserID);
  const db       = getDB();

  try {
    const profile = db.prepare(`
      SELECT pr.*, u.email,
             TRIM(pr.last_name || ' ' || pr.first_name) AS name,
             (? = pr.user_id) AS is_own
      FROM profiles pr
      JOIN users u ON pr.user_id = u.user_id
      WHERE pr.user_id = ?
    `).get(loginUserID, targetID);

    if (!profile) {
      // W16-E1: 自身のプロフィールが取得できない場合も同じ扱い
      return jsonError(
        res,
        'このユーザーは退会済みです。または、プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。',
        404
      );
    }

    return jsonOk(res, { profile });
  } catch (err) {
    console.error('[M1_getProfile] DB 取得失敗:', err);
    return jsonError(res, 'プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。', 500);
  }
}

//M2
/**
 * W17 プロフィール編集画面からの変更内容を検証して DB に反映する。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function updateProfile(req, res, loginUserID) {
  const lastName   = (req.body.last_name  ?? '').trim();
  const firstName  = (req.body.first_name ?? '').trim();
  const bio        = (req.body.bio        ?? '').trim();
  const grade      = Number(req.body.grade      ?? 0);
  const department = (req.body.department ?? '').trim();
  const course     = (req.body.course     ?? '').trim();
  const lab        = (req.body.lab        ?? '').trim();
  const clubs      = (req.body.clubs      ?? '').trim();
  const timetable  = (req.body.timetable  ?? '').trim();

  // ── 入力検証 ─────────────────────────
  if (lastName === '') {
    // W17-E1
    return jsonError(res, '名前を入力してください。（名前は必須項目です）');
  }

  const fullNameBytes = Buffer.byteLength(`${lastName} ${firstName}`, 'utf8');
  if (fullNameBytes > 128) {
    // W17-E2: 128 バイト = 全角 32 文字相当
    return jsonError(res, '名前は全角 32 文字以内にしてください。');
  }

  if (Buffer.byteLength(bio, 'utf8') > 1024) {
    // W17-E3
    return jsonError(res, '自己紹介は全角 500 文字以内にしてください。');
  }

  // ── DB 更新 ──────────────────────────
  const db = getDB();

  try {
    db.prepare(`
      UPDATE profiles
      SET last_name=?, first_name=?, grade=?, department=?, course=?, lab=?, clubs=?, bio=?, timetable=?
      WHERE user_id=?
    `).run(lastName, firstName, grade, department, course, lab, clubs, bio, timetable, loginUserID);

    return jsonOk(res);
  } catch (err) {
    console.error('[M2_updateProfile] DB 更新失敗:', err);
    return jsonError(res, 'プロフィールの更新に失敗しました。', 500);
  }
}

//M3
/**
 * W12 プロフィール情報検索画面の条件（氏名・学年・コース・部活・研究室）で
 * プロフィールを絞り込んで返す。最大 50 件。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID
 */
function searchProfiles(req, res, loginUserID) {
  const db = getDB();

  const conditions = ['pr.user_id != :login'];
  const params     = { ':login': loginUserID };

  const name   = (req.query.name   ?? '').trim();
  const grade  =  req.query.grade  ?? '';
  const course = (req.query.course ?? '').trim();
  const clubs  = (req.query.clubs  ?? '').trim();
  const lab    = (req.query.lab    ?? '').trim();

  // 氏名：「姓 名」「姓名」どちらの入力にも対応
  if (name !== '') {
    conditions.push(
      "((pr.last_name || ' ' || pr.first_name) LIKE :name OR (pr.last_name || pr.first_name) LIKE :name2)"
    );
    params[':name']  = `%${name}%`;
    params[':name2'] = `%${name}%`;
  }

  if (grade !== '') {
    conditions.push('pr.grade = :grade');
    params[':grade'] = Number(grade);
  }

  if (course !== '') {
    conditions.push('pr.course LIKE :course');
    params[':course'] = `%${course}%`;
  }

  if (clubs !== '') {
    conditions.push('pr.clubs LIKE :clubs');
    params[':clubs'] = `%${clubs}%`;
  }

  if (lab !== '') {
    conditions.push('pr.lab LIKE :lab');
    params[':lab'] = `%${lab}%`;
  }

  const where = conditions.join(' AND ');

  try {
    const results = db.prepare(`
      SELECT pr.user_id,
             TRIM(pr.last_name || ' ' || pr.first_name) AS name,
             pr.icon_id, pr.grade, pr.department, pr.course, pr.bio
      FROM profiles pr
      WHERE ${where}
      ORDER BY pr.last_name, pr.first_name
      LIMIT 50
    `).all(params);

    // 検索条件に合致するプロフィールが存在しない場合は空配列で正常応答
    if (results.length === 0 && name !== '') {
      // W12-E1: 氏名検索で存在しない場合に備えてメッセージを付与
      return jsonOk(res, { profiles: [], message: '存在しないプロフィールです。' });
    }

    return jsonOk(res, { profiles: results });
  } catch (err) {
    console.error('[M3_searchProfiles] DB 検索失敗:', err);
    return jsonOk(res, { profiles: [] });
  }
}

//M4
/**
 * 指定ユーザ ID に対応するプロフィールが DB に存在するか確認する。
 * プロフィール取得・更新・検索の前処理として利用される。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID  （ルーティング共通引数。本モジュールでは直接は使用しない）
 */
function existsUser(req, res, loginUserID) {
  const targetID = Number(req.query.user_id ?? req.body.user_id ?? 0);

  if (!targetID || targetID < 1) {
    // ユーザ ID が不正
    return jsonOk(res, { exists: false });
  }

  const db = getDB();

  try {
    const row = db.prepare('SELECT 1 FROM profiles WHERE user_id = ?').get(targetID);
    return jsonOk(res, { exists: !!row });
  } catch (err) {
    console.error('[M4_existsUser] DB 確認失敗:', err);
    return jsonOk(res, { exists: false });
  }
}

//M5
/**
 * W3 プロフィール初期設定画面からのデータを検証し、初期プロフィールを DB に登録する。
 * 会員登録直後の新規ユーザ向け（既存プロフィールがある場合は中断）。
 *
 * @param {Request}  req
 * @param {Response} res
 * @param {number}   loginUserID  登録対象ユーザ ID（= ログイン中ユーザ）
 */
function createInitialProfile(req, res, loginUserID) {
  const lastName  = (req.body.last_name  ?? '').trim();
  const firstName = (req.body.first_name ?? '').trim();
  const grade     =  req.body.grade ?? '';
  const department = (req.body.department ?? '').trim();
  const course     = (req.body.course    ?? '').trim();
  const lab        = (req.body.lab       ?? '').trim();
  const clubs      = (req.body.clubs     ?? '').trim();
  const bio        = (req.body.bio       ?? '').trim();
  const timetable  = (req.body.timetable ?? '').trim();

  // ── 入力検証 ─────────────────────────
  if (lastName === '') {
    // W3-E1
    return jsonError(res, '氏名を入力してください。');
  }

  if (grade === '' || grade === '0' || Number(grade) === 0) {
    // W3-E2
    return jsonError(res, '学年/職員欄を選択してください。');
  }

  // ── 重複チェック ──────────────────────
  const db = getDB();

  const existing = db.prepare('SELECT 1 FROM profiles WHERE user_id = ?').get(loginUserID);
  if (existing) {
    // すでにプロフィールが存在する場合は登録中断
    return jsonError(res, 'プロフィールはすでに登録されています。', 409);
  }

  // ── DB 登録 ──────────────────────────
  try {
    db.prepare(`
      INSERT INTO profiles
        (user_id, last_name, first_name, grade, department, course, lab, clubs, bio, timetable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(loginUserID, lastName, firstName, Number(grade), department, course, lab, clubs, bio, timetable);

    return jsonOk(res);
  } catch (err) {
    console.error('[M5_createInitialProfile] DB 登録失敗:', err);
    return jsonError(res, 'プロフィールの登録に失敗しました。', 500);
  }
}
