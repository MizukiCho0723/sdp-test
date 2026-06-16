package com.sns.controller;

import com.sns.util.ApiHelper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

// notifications.php 相当
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final JdbcTemplate jdbc;

    public NotificationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @RequestMapping
    public ResponseEntity<Map<String, Object>> dispatch(HttpServletRequest req, HttpSession session) {
        Integer userId = ApiHelper.getLoginUserId(session);
        if (userId == null) return ApiHelper.error("ログインが必要です", 401);

        String action = req.getParameter("action");
        if (action == null) action = "list";  // デフォルト

        return switch (action) {
            case "list"      -> listNotifications(userId);
            case "mark_read" -> markRead(userId);
            default          -> ApiHelper.error("不正なアクション");
        };
    }

    // ---- listNotifications() ----
    private ResponseEntity<Map<String, Object>> listNotifications(int userId) {
        List<Map<String, Object>> notifs = jdbc.queryForList("""
            SELECT notif_id, type, ref_id, message, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
            """, userId);

        // 取得後に全件既読にする
        jdbc.update("UPDATE notifications SET is_read = 1 WHERE user_id = ?", userId);

        return ApiHelper.ok(Map.of("notifications", notifs));
    }

    // ---- markRead() ----
    private ResponseEntity<Map<String, Object>> markRead(int userId) {
        jdbc.update("UPDATE notifications SET is_read = 1 WHERE user_id = ?", userId);
        return ApiHelper.ok();
    }
}
