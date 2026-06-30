package com.sns.c6;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

// c6_m3_NotificationHistoryService.php 相当
@Service
public class NotificationHistoryService {

    private final JdbcTemplate jdbc;

    public NotificationHistoryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 通知を最新50件取得し、未読をすべて既読に更新する。
     * 返却キー: notifId / senderId / senderName / senderIconId / postId / isRead / notifiedAt
     */
    public List<Map<String, Object>> fetchAndReadNotifications(int loginUserId) {
        // 通知一覧を取得（最新50件）
        List<Map<String, Object>> notifs = jdbc.queryForList("""
                SELECT
                    n.notif_id                                       AS notifId,
                    n.sender_id                                      AS senderId,
                    TRIM(pr.last_name || ' ' || pr.first_name)      AS senderName,
                    pr.icon_id                                       AS senderIconId,
                    n.post_id                                        AS postId,
                    n.is_read                                        AS isRead,
                    n.notified_at                                    AS notifiedAt
                FROM notifications n
                JOIN profiles pr ON pr.user_id = n.sender_id
                WHERE n.receiver_id = ?
                ORDER BY n.notified_at DESC
                LIMIT 50
                """, loginUserId);

        // 未読通知をすべて既読にする
        jdbc.update(
                "UPDATE notifications SET is_read = 1 WHERE receiver_id = ? AND is_read = 0",
                loginUserId);

        return notifs;
    }
}
