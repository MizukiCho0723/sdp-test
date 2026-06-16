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

// posts.php 相当
@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final JdbcTemplate jdbc;

    public PostController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @RequestMapping
    public ResponseEntity<Map<String, Object>> dispatch(HttpServletRequest req, HttpSession session) {
        Integer userId = ApiHelper.getLoginUserId(session);
        if (userId == null) return ApiHelper.error("ログインが必要です", 401);

        String action = p(req, "action");
        return switch (action) {
            case "create" -> createPost(req, userId);
            case "list"   -> listPosts(req, userId);
            case "detail" -> getDetail(req);
            case "reply"  -> createReply(req, userId);
            case "delete" -> deletePost(req, userId);
            default       -> ApiHelper.error("不正なアクション");
        };
    }

    // ---- createPost() ----
    private ResponseEntity<Map<String, Object>> createPost(HttpServletRequest req, int userId) {
        String content = p(req, "content");
        if (content.isEmpty())                       return ApiHelper.error("投稿内容を入力してください");
        if (content.getBytes().length > 1024)        return ApiHelper.error("投稿内容は1024バイト以下（全角約340文字以内）にしてください");

        jdbc.update("INSERT INTO posts (user_id, content) VALUES (?, ?)", userId, content);
        int postId = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);
        return ApiHelper.ok(Map.of("post_id", postId));
    }

    // ---- listPosts() ----
    private ResponseEntity<Map<String, Object>> listPosts(HttpServletRequest req, int userId) {
        int offset = parseIntParam(req, "offset", 0);
        List<Map<String, Object>> posts = jdbc.queryForList("""
            SELECT p.post_id, p.content, p.created_at,
                   TRIM(pr.last_name || ' ' || pr.first_name) AS name, pr.icon_id, p.user_id,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.post_id) AS reply_count
            FROM posts p
            JOIN profiles pr ON p.user_id = pr.user_id
            WHERE p.deleted = 0
            ORDER BY p.created_at DESC
            LIMIT 20 OFFSET ?
            """, offset);
        return ApiHelper.ok(Map.of("posts", posts));
    }

    // ---- getDetail() ----
    private ResponseEntity<Map<String, Object>> getDetail(HttpServletRequest req) {
        int postId = parseIntParam(req, "post_id", 0);
        if (postId == 0) return ApiHelper.error("投稿IDが不正です");

        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT p.post_id, p.content, p.created_at, p.user_id,
                   TRIM(pr.last_name || ' ' || pr.first_name) AS name, pr.icon_id
            FROM posts p
            JOIN profiles pr ON p.user_id = pr.user_id
            WHERE p.post_id = ? AND p.deleted = 0
            """, postId);
        if (rows.isEmpty()) return ApiHelper.error("投稿が見つかりません", 404);

        List<Map<String, Object>> replies = jdbc.queryForList("""
            SELECT r.reply_id, r.content, r.created_at, r.user_id,
                   TRIM(pr.last_name || ' ' || pr.first_name) AS name, pr.icon_id
            FROM replies r
            JOIN profiles pr ON r.user_id = pr.user_id
            WHERE r.post_id = ?
            ORDER BY r.created_at ASC
            """, postId);

        return ApiHelper.ok(Map.of("post", rows.get(0), "replies", replies));
    }

    // ---- createReply() ----
    private ResponseEntity<Map<String, Object>> createReply(HttpServletRequest req, int userId) {
        int    postId  = parseIntParam(req, "post_id", 0);
        String content = p(req, "content");
        if (postId == 0)               return ApiHelper.error("投稿IDが不正です");
        if (content.isEmpty())         return ApiHelper.error("返信内容を入力してください");
        if (content.getBytes().length > 1024)
            return ApiHelper.error("返信内容は1024バイト以下（全角約340文字以内）にしてください");

        List<Map<String, Object>> posts = jdbc.queryForList(
            "SELECT user_id FROM posts WHERE post_id = ? AND deleted = 0", postId);
        if (posts.isEmpty()) return ApiHelper.error("返信対象の投稿が見つかりません", 404);

        jdbc.update("INSERT INTO replies (post_id, user_id, content) VALUES (?, ?, ?)",
            postId, userId, content);
        int replyId = jdbc.queryForObject("SELECT last_insert_rowid()", Integer.class);

        // 投稿者に通知 (自分への返信は除外)
        int postOwnerId = ((Number) posts.get(0).get("user_id")).intValue();
        if (postOwnerId != userId) {
            String senderName = jdbc.queryForObject(
                "SELECT TRIM(last_name || ' ' || first_name) FROM profiles WHERE user_id = ?",
                String.class, userId);
            jdbc.update(
                "INSERT INTO notifications (user_id, type, ref_id, message) VALUES (?, 'reply', ?, ?)",
                postOwnerId, replyId, senderName + " さんが投稿に返信しました");
        }
        return ApiHelper.ok(Map.of("reply_id", replyId));
    }

    // ---- deletePost() ----
    private ResponseEntity<Map<String, Object>> deletePost(HttpServletRequest req, int userId) {
        int postId = parseIntParam(req, "post_id", 0);
        if (postId == 0) return ApiHelper.error("投稿IDが不正です");

        int affected = jdbc.update(
            "UPDATE posts SET deleted = 1 WHERE post_id = ? AND user_id = ?", postId, userId);
        if (affected == 0) return ApiHelper.error("削除できません", 403);
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
