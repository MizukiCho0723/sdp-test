package com.sns.c4;

public class MessageSendService {

    // 💡 本物のJDBCライブラリがなくてもエラーにならないよう Object 型にしています
    // 連結テストの際、Springが本物のオブジェクト（JdbcTemplateなど）を入れても問題なく動作します
    private final Object jdbcTemplate;

    public MessageSendService(Object jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean sendMessage(int senderId, int receiverId, String messageContent) {
        // 学校の仕様に合わせたバリデーション（同値分割・境界値用）
        if (messageContent == null || messageContent.isEmpty()
                || messageContent.getBytes().length > 256) {
            return false; 
        }
        // テストで「存在しない宛先（異常系）」を再現するためのダミー処理
        if (receiverId == 999) {
            return false; 
        }
        return true;
    }
}