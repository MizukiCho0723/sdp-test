package com.sns.util;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

// config.php の jsonOk / jsonError / requireLogin / validateEmail 相当
public final class ApiHelper {

    private ApiHelper() {}

    /** {"status":"ok", ...extra} */
    public static ResponseEntity<Map<String, Object>> ok(Map<String, Object> extra) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        if (extra != null) body.putAll(extra);
        return ResponseEntity.ok(body);
    }

    public static ResponseEntity<Map<String, Object>> ok() {
        return ok(null);
    }

    /** {"status":"error", "message": msg}  HTTP status code */
    public static ResponseEntity<Map<String, Object>> error(String message, int code) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "error");
        body.put("message", message);
        return ResponseEntity.status(code).body(body);
    }

    public static ResponseEntity<Map<String, Object>> error(String message) {
        return error(message, HttpStatus.BAD_REQUEST.value());
    }

    /**
     * requireLogin() 相当。
     * 未ログインなら null を返す。呼び出し元は null チェック後に 401 を返すこと。
     */
    public static Integer getLoginUserId(HttpSession session) {
        return (Integer) session.getAttribute("user_id");
    }

    /** validateEmail() 相当 */
    public static boolean validateEmail(String email, String domain) {
        if (email == null || email.isBlank()) return false;
        // 簡易フォーマットチェック + ドメインチェック
        return email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
                && email.endsWith("@" + domain);
    }

    /** param が null / 空なら defaultValue を返す */
    public static String param(String value, String defaultValue) {
        return (value != null && !value.isEmpty()) ? value.trim() : defaultValue;
    }

    public static String param(String value) {
        return param(value, "");
    }
}
