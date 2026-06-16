package com.sns.controller;

import com.sns.util.ApiHelper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

// auth.php 相当
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;

    @Value("${sns.domain}")
    private String domain;

    public AuthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ---- 共通ディスパッチャ (GET / POST 両対応) ----
    @RequestMapping
    public ResponseEntity<Map<String, Object>> dispatch(HttpServletRequest req, HttpSession session) {
        String action = p(req, "action");
        return switch (action) {
            case "send_code"     -> sendCode(req);
            case "verify_code"   -> verifyCode(req, session);
            case "register"      -> register(req, session);
            case "login"         -> login(req, session);
            case "logout"        -> logout(session);
            case "reset_password"-> resetPassword(req);
            case "check_session" -> checkSession(session);
            default              -> ApiHelper.error("不正なアクション");
        };
    }

    // ---- W1: 認証コード送信 (sendCode()) ----
    private ResponseEntity<Map<String, Object>> sendCode(HttpServletRequest req) {
        String email = p(req, "email");
        if (!ApiHelper.validateEmail(email, domain))
            return ApiHelper.error("芝浦工業大学のメールアドレスを入力してください");

        String code = generateCode();
        String expires = LocalDateTime.now().plusMinutes(10).format(FMT);

        jdbc.update(
            "INSERT OR REPLACE INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)",
            email, code, expires);
        sendAuthEmail(email, code);

        return ApiHelper.ok(Map.of("message", "認証コードを送信しました"));
    }

    // ---- W2: 認証コード確認 (verifyCode()) ----
    private ResponseEntity<Map<String, Object>> verifyCode(HttpServletRequest req, HttpSession session) {
        String email = p(req, "email");
        String code  = p(req, "code");
        if (email.isEmpty() || code.isEmpty())
            return ApiHelper.error("メールアドレスと認証コードを入力してください");

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT code, expires_at FROM auth_codes WHERE email = ?", email);
        if (rows.isEmpty()) return ApiHelper.error("認証コードが正しくありません");

        Map<String, Object> row = rows.get(0);
        String storedCode = (String) row.get("code");
        LocalDateTime expires = LocalDateTime.parse((String) row.get("expires_at"), FMT);

        if (!storedCode.equals(code) || LocalDateTime.now().isAfter(expires))
            return ApiHelper.error("認証コードが正しくありません");

        session.setAttribute("verified_email", email);
        return ApiHelper.ok();
    }

    // ---- W3: 会員登録 (register()) ----
    @Transactional
    private ResponseEntity<Map<String, Object>> register(HttpServletRequest req, HttpSession session) {
        String email     = p(req, "email");
        String password  = p(req, "password");
        String confirm   = p(req, "confirm_password");
        String lastName  = p(req, "last_name");
        String firstName = p(req, "first_name");
        String gradeStr  = p(req, "grade");

        if (!ApiHelper.validateEmail(email, domain))
            return ApiHelper.error("芝浦工業大学のメールアドレスを入力してください");
        if (!email.equals(session.getAttribute("verified_email")))
            return ApiHelper.error("メールアドレスの認証が完了していません");
        if (password.length() < 8 || password.length() > 16)
            return ApiHelper.error("パスワードは8〜16文字で入力してください");
        if (!password.matches(".*[a-zA-Z].*") || !password.matches(".*[0-9].*"))
            return ApiHelper.error("パスワードには英数字記号すべてが含まれている必要があります");
        if (!password.equals(confirm))
            return ApiHelper.error("パスワードが一致しません");
        if (lastName.isEmpty())
            return ApiHelper.error("氏名（姓）を入力してください");
        if ((lastName + " " + firstName).getBytes().length > 64)
            return ApiHelper.error("名前は64バイト以下にしてください");
        if (gradeStr.isEmpty())
            return ApiHelper.error("学年/職員欄を選択してください");

        int grade = Integer.parseInt(gradeStr);
        String dept   = p(req, "department");
        String course = p(req, "course");
        String lab    = p(req, "lab");
        String clubs  = p(req, "clubs");
        String bio    = p(req, "bio");

        try {
            jdbc.update("INSERT INTO users (email, password_hash) VALUES (?, ?)",
                email, PASSWORD_ENCODER.encode(password));
            int userId = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);

            jdbc.update("""
                INSERT INTO profiles (user_id, last_name, first_name, grade, department, course, lab, clubs, bio)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, userId, lastName, firstName, grade, dept, course, lab, clubs, bio);

            jdbc.update("DELETE FROM auth_codes WHERE email = ?", email);
            session.removeAttribute("verified_email");
            return ApiHelper.ok(Map.of("message", "会員登録が完了しました"));
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("UNIQUE"))
                return ApiHelper.error("このメールアドレスはすでに登録されています");
            return ApiHelper.error("登録に失敗しました: " + e.getMessage());
        }
    }

    // ---- W5: ログイン (login()) ----
    private ResponseEntity<Map<String, Object>> login(HttpServletRequest req, HttpSession session) {
        String email    = p(req, "email");
        String password = p(req, "password");
        if (email.isEmpty())    return ApiHelper.error("メールアドレスを入力してください");
        if (password.isEmpty()) return ApiHelper.error("パスワードを入力してください");

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, password_hash FROM users WHERE email = ?", email);
        if (rows.isEmpty()) return ApiHelper.error("メールアドレスまたはパスワードが不正です");

        Map<String, Object> user = rows.get(0);
        String hash = (String) user.get("password_hash");
        if (!PASSWORD_ENCODER.matches(password, hash))
            return ApiHelper.error("メールアドレスまたはパスワードが不正です");

        int userId = ((Number) user.get("user_id")).intValue();
        session.setAttribute("user_id", userId);
        return ApiHelper.ok(Map.of("user_id", userId));
    }

    // ---- ログアウト (logout()) ----
    private ResponseEntity<Map<String, Object>> logout(HttpSession session) {
        session.invalidate();
        return ApiHelper.ok();
    }

    // ---- W6/W7: パスワード再設定 (resetPassword()) ----
    private ResponseEntity<Map<String, Object>> resetPassword(HttpServletRequest req) {
        String email    = p(req, "email");
        String code     = p(req, "code");
        String password = p(req, "password");
        String confirm  = p(req, "confirm_password");

        if (email.isEmpty())                          return ApiHelper.error("メールアドレスを入力してください");
        if (!ApiHelper.validateEmail(email, domain))  return ApiHelper.error("芝浦工業大学のメールアドレスを入力してください");

        if (!code.isEmpty() && !password.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT code, expires_at FROM auth_codes WHERE email = ?", email);
            if (rows.isEmpty()) return ApiHelper.error("認証コードが異なっています");

            Map<String, Object> row = rows.get(0);
            LocalDateTime expires = LocalDateTime.parse((String) row.get("expires_at"), FMT);
            if (!row.get("code").equals(code) || LocalDateTime.now().isAfter(expires))
                return ApiHelper.error("認証コードが異なっています");

            if (password.isEmpty())        return ApiHelper.error("新しいパスワードを入力してください");
            if (!password.equals(confirm)) return ApiHelper.error("パスワードが一致しません");
            if (password.length() < 8 || password.length() > 16)
                return ApiHelper.error("パスワードは8〜16文字で入力してください");

            jdbc.update("UPDATE users SET password_hash = ? WHERE email = ?",
                PASSWORD_ENCODER.encode(password), email);
            jdbc.update("DELETE FROM auth_codes WHERE email = ?", email);
            return ApiHelper.ok(Map.of("message", "再設定が完了しました"));
        }
        return ApiHelper.error("コードとパスワードを入力してください");
    }

    // ---- セッション確認 (checkSession()) ----
    private ResponseEntity<Map<String, Object>> checkSession(HttpSession session) {
        Integer userId = ApiHelper.getLoginUserId(session);
        if (userId == null) return ApiHelper.error("未ログイン", 401);
        return ApiHelper.ok(Map.of("user_id", userId));
    }

    // ---- ユーティリティ ----
    private String generateCode() {
        return String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
    }

    private void sendAuthEmail(String email, String code) {
        // 開発環境ではログ出力のみ (本番では JavaMail 等で実装)
        log.info("Auth code for {}: {}", email, code);
    }

    /** リクエストパラメータを trim して返す (POST FormData / GET クエリ 両対応) */
    private String p(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return v != null ? v.trim() : "";
    }
}
