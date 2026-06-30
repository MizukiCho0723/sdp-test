package com.sns.c6;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

// c6_m4_ReplyPostService.php 相当
@Service
public class ReplyPostService {

    private final JdbcTemplate jdbc;

    public ReplyPostService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * リプライを投稿し、必要なら通知を生成する。
     * @return true: 成功 / false: バリデーションエラーまたは親投稿が存在しない
     */
    public boolean postReply(int loginUserId, int parentPostId, String content) {
        // 本文のバリデーション（空・1024バイト超）
        if (content == null || content.isBlank()
                || content.getBytes().length > 1024) {
            return false;
        }

        // 親投稿の存在確認・投稿者 ID の取得
        List<Integer> parentOwnerIds = jdbc.queryForList(
                "SELECT user_id FROM posts WHERE post_id = ? AND parent_post_id IS NULL",
                Integer.class, parentPostId);
        if (parentOwnerIds.isEmpty()) return false;

        int parentOwnerId = parentOwnerIds.get(0);

        // リプライを挿入
        jdbc.update(
                "INSERT INTO posts (user_id, parent_post_id, content) VALUES (?, ?, ?)",
                loginUserId, parentPostId, content);

        // 自分以外の投稿へのリプライの場合のみ通知を送る
        if (loginUserId != parentOwnerId) {
            // 新規投稿の post_id を取得
            int newPostId = jdbc.queryForObject(
                    "SELECT post_id FROM posts WHERE user_id = ? AND parent_post_id = ? ORDER BY posted_at DESC LIMIT 1",
                    Integer.class, loginUserId, parentPostId);

            jdbc.update(
                    "INSERT INTO notifications (receiver_id, sender_id, post_id) VALUES (?, ?, ?)",
                    parentOwnerId, loginUserId, newPostId);
        }

        return true;
    }
}
