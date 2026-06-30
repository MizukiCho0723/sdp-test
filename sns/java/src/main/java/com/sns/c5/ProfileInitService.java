package com.sns.c5;

public class ProfileInitService {
    
    public boolean validateAndCreateInitData(ProfileInitDto initData) {
        // 設計書エラー処理：氏名や学年などの必須項目が空欄なら仕様通りfalseを返す
        if (initData == null || initData.getName() == null || initData.getName().isEmpty()
                || initData.getGrade() == null) {
            return false;
        }
        // 入力形式チェック（例：学年が1〜4以外なら不正とする）
        if (initData.getGrade() < 1 || initData.getGrade() > 4) {
            return false;
        }
        return true; // 正常終了
    }
}