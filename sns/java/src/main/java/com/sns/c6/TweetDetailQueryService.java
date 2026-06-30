package com.sns.c6;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

// c6_m2_TweetDetailQueryService.php 相当
@Service
public class TweetDetailQueryService {

    private final JdbcTemplate jdbc;

    public TweetDetailQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 指定した投稿とそのリプライ一覧を返す。
     * 存在しない post_id の場合は null を返す。
     */
    public Map<String, Object> getTweetDetail(int postId) {
        // 親投稿を取得
        List<Map<String, Object>> posts = jdbc.queryForList("""
                SELECT
                    p.post_id                                    AS postId,
                    p.user_id                                    AS userId,
                    TRIM(pr.last_name || ' ' || pr.first_name)  AS userName,
                    pr.icon_id                                   AS iconId,
                    p.content,
                    p.posted_at                                  AS postedAt
                FROM posts p
                JOIN profiles pr ON pr.user_id = p.user_id
                WHERE p.post_id = ? AND p.parent_post_id IS NULL
                """, postId);

        if (posts.isEmpty()) return null;

        // リプライ一覧を取得（古い順）
        List<Map<String, Object>> replies = jdbc.queryForList("""
                SELECT
                    p.post_id                                    AS postId,
                    p.user_id                                    AS userId,
                    TRIM(pr.last_name || ' ' || pr.first_name)  AS userName,
                    pr.icon_id                                   AS iconId,
                    p.content,
                    p.posted_at                                  AS postedAt
                FROM posts p
                JOIN profiles pr ON pr.user_id = p.user_id
                WHERE p.parent_post_id = ?
                ORDER BY p.posted_at ASC
                """, postId);

        Map<String, Object> result = new HashMap<>(posts.get(0));
        result.put("replies", replies);
        return result;
    }
}
