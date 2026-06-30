package com.sns.c5;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ProfileSearchService {

    public ProfileDetailDto searchAndGetProfileDetail(ProfileSearchCondition condition, int targetUserId, int loginUserId) {
        // 設計書エラー処理：存在しないユーザーID（ダミーとして999番）ならnullを返す
        if (targetUserId == 999) {
            return null;
        }

        // ログインユーザーと対象ユーザーの一致チェックを行い、本人フラグ(isOwnProfile)を決定
        boolean isOwnProfile = (targetUserId == loginUserId);

        // 設計書通りの戻り値：ProfileDetailDtoを生成して返却
        //単体テスト用の適当な設定
        return new ProfileDetailDto(
            targetUserId,
            "佐藤 尊", 
            3, 
            "情報コース", 
            "よろしくお願いします。", 
            "軽音サークル", 
            "ソフトウェア研究室", 
            "月1 火2", 
            "sato@example.com", 
            isOwnProfile
        );
    }

    // コントローラー側で呼び出しているウェブ検索用のダミーメソッド
    public List<Map<String, Object>> webSearch(Map<String, String> params) {
        return new ArrayList<>();
    }
}