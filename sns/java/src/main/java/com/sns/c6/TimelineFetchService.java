package com.sns.c6;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

// c6_m1_TimelineFetchService.php 相当
@Service
public class TimelineFetchService {

    private final JdbcTemplate jdbc;

    public TimelineFetchService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * タイムラインを取得する（最新20件）。
     * 返却キー: postId / userId / userName / iconId / content / replyCount / postedAt
     */
    public List<Map<String, Object>> fetchTimeline() {
        return jdbc.queryForList("""
                SELECT
                    p.post_id                                        AS postId,
                    p.user_id                                        AS userId,
                    TRIM(pr.last_name || ' ' || pr.first_name)      AS userName,
                    pr.icon_id                                       AS iconId,
                    p.content,
                    (SELECT COUNT(*) FROM posts r WHERE r.parent_post_id = p.post_id)
                                                                     AS replyCount,
                    p.posted_at                                      AS postedAt
                FROM posts p
                JOIN profiles pr ON pr.user_id = p.user_id
                WHERE p.parent_post_id IS NULL
                ORDER BY p.posted_at DESC
                LIMIT 20
                """);
    }
}
