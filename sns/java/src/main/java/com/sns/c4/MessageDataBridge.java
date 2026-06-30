package com.sns.c4;

// 💡 エラー回避のため一時的にコメントアウト（結合テスト時に戻せば問題ありません）
@Component
public class MessageDataBridge {

    public Object bridgeToStorage(Object rawTransferData) {
        try {
            return rawTransferData;
        } catch (Exception e) {
            throw new RuntimeException(
                "データ通信または変換処理中に予期せぬエラーが発生しました: " + e.getMessage(), e);
        }
    }
}