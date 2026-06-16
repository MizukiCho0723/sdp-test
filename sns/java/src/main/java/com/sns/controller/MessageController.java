package com.sns.controller;

import com.sns.util.ApiHelper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// messages.php 相当
@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final JdbcTemplate jdbc;

    public MessageController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @RequestMapping
    public ResponseEntity<Map<String, Object>> dispatch(HttpServletRequest req, HttpSession session) {
        Integer userId = ApiHelper.getLoginUserId(session);
        if (userId == null) return ApiHelper.error("ログインが必要です", 401);

        String action = p(req, "action");
        return switch (action) {
            case "send"      -> sendMessage(req, userId);
            case "history"   -> getHistory(req, userId);
            case "partners"  -> getPartners(userId);
            case "mark_read" -> markRead(req, userId);
            default          -> ApiHelper.error("不正なアクション");
        };
    }

    // ---- sendMessage() ----
    private ResponseEntity<Map<String, Object>> sendMessage(HttpServletRequest req, int userId) {
        int    receiverId = parseIntParam(req, "receiver_id", 0);
        String content    = p(req, "content");
        if (receiverId == 0)               return ApiHelper.error("送信相手を指定してください");
        if (content.isEmpty())             return ApiHelper.error("メッセージを入力してください");
        if (content.getBytes().length > 256)
            return ApiHelper.error("メッセージは256バイト以下（全角約85文字以内）にしてください");

        List<Map<String, Object>> receiver = jdbc.queryForList(
            "SELECT user_id FROM users WHERE user_id = ?", receiverId);
        if (receiver.isEmpty()) return ApiHelper.error("送信相手が存在しません");

        jdbc.update("INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)",
            userId, receiverId, content);
        int dmId = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);

        // 受信者に通知
        String senderName = jdbc.queryForObject(
            "SELECT TRIM(last_name || ' ' || first_name) FROM profiles WHERE user_id = ?",
            String.class, userId);
        jdbc.update(
            "INSERT INTO notifications (user_id, type, ref_id, message) VALUES (?, 'message', ?, ?)",
            receiverId, dmId, senderName + " さんからメッセージが届きました");

        List<Map<String, Object>> msg = jdbc.queryForList(
            "SELECT * FROM messages WHERE dm_id = ?", dmId);
        return ApiHelper.ok(Map.of("message", msg.get(0)));
    }

    // ---- getHistory() ----
    private ResponseEntity<Map<String, Object>> getHistory(HttpServletRequest req, int userId) {
        int partnerId = parseIntParam(req, "partner_id", 0);
        if (partnerId == 0) return ApiHelper.error("相手IDを指定してください");

        List<Map<String, Object>> messages = jdbc.queryForList("""
            SELECT m.dm_id, m.sender_id, m.receiver_id, m.content, m.sent_at, m.is_read,
                   TRIM(ps.last_name || ' ' || ps.first_name) AS sender_name,
                   TRIM(pr.last_name || ' ' || pr.first_name) AS receiver_name
            FROM messages m
            JOIN profiles ps ON m.sender_id  = ps.user_id
            JOIN profiles pr ON m.receiver_id = pr.user_id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.sent_at ASC
            """, userId, partnerId, partnerId, userId);

        // 受信済みメッセージを既読に更新
        jdbc.update(
            "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
            partnerId, userId);

        List<Map<String, Object>> partnerRows = jdbc.queryForList("""
            SELECT pr.*, u.email, TRIM(pr.last_name || ' ' || pr.first_name) AS name
            FROM profiles pr
            JOIN users u ON pr.user_id = u.user_id
            WHERE pr.user_id = ?
            """, partnerId);
        Map<String, Object> partner = partnerRows.isEmpty() ? null : partnerRows.get(0);

        return ApiHelper.ok(Map.of("messages", messages, "partner", partner != null ? partner : Map.of()));
    }

    // ---- getPartners() ----
    private ResponseEntity<Map<String, Object>> getPartners(int userId) {
        // 会話相手 ID 一覧
        List<Map<String, Object>> partnerIdRows = jdbc.queryForList("""
            SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
            FROM messages WHERE sender_id = ? OR receiver_id = ?
            """, userId, userId, userId);

        List<Map<String, Object>> partners = new ArrayList<>();
        for (Map<String, Object> row : partnerIdRows) {
            int pid = ((Number) row.get("partner_id")).intValue();

            List<Map<String, Object>> profileRows = jdbc.queryForList(
                "SELECT TRIM(last_name || ' ' || first_name) AS name, icon_id FROM profiles WHERE user_id = ?", pid);
            if (profileRows.isEmpty()) continue;
            Map<String, Object> profile = profileRows.get(0);

            List<Map<String, Object>> lastMsgRows = jdbc.queryForList("""
                SELECT content, sent_at FROM messages
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                ORDER BY sent_at DESC LIMIT 1
                """, userId, pid, pid, userId);

            int unread = jdbc.queryForObject(
                "SELECT COUNT(*) FROM messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
                Integer.class, pid, userId);

            Map<String, Object> partner = new java.util.LinkedHashMap<>();
            partner.put("partner_id",   pid);
            partner.put("name",         profile.get("name"));
            partner.put("icon_id",      profile.get("icon_id"));
            partner.put("last_message", lastMsgRows.isEmpty() ? "" : lastMsgRows.get(0).get("content"));
            partner.put("last_at",      lastMsgRows.isEmpty() ? "" : lastMsgRows.get(0).get("sent_at"));
            partner.put("unread_count", unread);
            partners.add(partner);
        }

        // 最終メッセージ日時で降順ソート
        partners.sort((a, b) -> String.valueOf(b.get("last_at")).compareTo(String.valueOf(a.get("last_at"))));
        return ApiHelper.ok(Map.of("partners", partners));
    }

    // ---- markRead() ----
    private ResponseEntity<Map<String, Object>> markRead(HttpServletRequest req, int userId) {
        int partnerId = parseIntParam(req, "partner_id", 0);
        if (partnerId == 0) return ApiHelper.error("相手IDを指定してください");
        jdbc.update(
            "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
            partnerId, userId);
        return ApiHelper.ok();
    }

    private String p(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return v != null ? v.trim() : "";
    }

    private int parseIntParam(HttpServletRequest req, String name, int def) {
        try { return Integer.parseInt(p(req, name)); } catch (NumberFormatException e) { return def; }
    }
}
