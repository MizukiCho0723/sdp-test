import { getDB } from './config.js';

// =================================================================
// M1 ユーザデータ読込処理 (UserQueryService)
// =================================================================
const UserQueryService = {
  /**
   * 認証・システム内照会のため、レコード検索を行い、認証用情報を抽出して返却する。
   */
  findUserForAuth(userId, email = null) {
    const db = getDB();
    try {
      let row;
      // データ仕様書に合わせてテーブル名とカラム名を修正
      // ※仕様書にパスワードカラムがないため、ここでは「パスワード」というカラム名があると仮定します
      if (userId !== null && userId > 0) {
        row = db.prepare('SELECT User_ID, [メールアドレス・学籍番号], パスワード FROM ユーザ情報 WHERE User_ID = ?').get(userId);
      } else if (email !== null && email.trim() !== '') {
        row = db.prepare('SELECT User_ID, [メールアドレス・学籍番号], パスワード FROM ユーザ情報 WHERE [メールアドレス・学籍番号] = ?').get(email);
      } else {
        return null;
      }

      if (!row) {
        return null;
      }

      // 呼び出し元が使いやすいようにオブジェクトの形を整えて返却
      return {
        userId: row.User_ID,
        email: row['メールアドレス・学籍番号'],
        hashedPassword: row.パスワード 
      };
    } catch (err) {
      console.error('[UserQueryService.findUserForAuth] DBエラー:', err);
      return null;
    }
  }
};

// =================================================================
// M2 ユーザデータ登録処理 (UserRegisterService)
// =================================================================
const UserRegisterService = {
  /**
   * 新規アカウントレコードをデータベースに挿入する。
   */
  registerService(registerData) {
    const email = (registerData.email ?? '').trim();
    const password = registerData.password ?? '';

    if (email === '' || password === '') {
      return false;
    }

    const db = getDB();
    try {
      // カラム名を「[メールアドレス・学籍番号]」に修正
      const exists = db.prepare('SELECT User_ID FROM ユーザ情報 WHERE [メールアドレス・学籍番号] = ?').get(email);
      if (exists) {
        return false;
      }

      // 新規登録クエリ
      const insert = db.prepare('INSERT INTO ユーザ情報 ([メールアドレス・学籍番号], パスワード) VALUES (?, ?)');
      insert.run(email, password); 
      
      return true; 
    } catch (err) {
      console.error('[UserRegisterService.registerService] DB書き込み失敗:', err);
      return false; 
    }
  }
};

// =================================================================
// M3 ユーザデータ更新処理 (UserUpdaateService) ※設計書のタイポ準拠
// =================================================================
const UserUpdaateService = {
  /**
   * パスワード情報を上書き更新する。
   */
  updata(userId, newHashedPassword) {
    if (!userId || userId <= 0 || !newHashedPassword) {
      return false;
    }

    const db = getDB();
    try {
      const user = db.prepare('SELECT User_ID FROM ユーザ情報 WHERE User_ID = ?').get(userId);
      if (!user) {
        return false; 
      }

      // パスワード上書きクエリ
      db.prepare('UPDATE ユーザ情報 SET パスワード = ? WHERE User_ID = ?').run(newHashedPassword, userId);
      
      return true; 
    } catch (err) {
      console.error('[UserUpdaateService.updata] クエリ実行失敗:', err);
      return false; 
    }
  }
};
