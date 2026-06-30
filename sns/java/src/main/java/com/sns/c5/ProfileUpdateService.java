package com.sns.c5;

public class ProfileUpdateService {

    public boolean validateAndUpdateProfile(int loginUserId, ProfileUpdateDto updateData) {
        // 設計書エラー処理：必須項目が空欄、または自己紹介が制限（例: 256文字）を超過している場合false
        if (updateData == null || updateData.getName() == null || updateData.getName().isEmpty()) {
            return false;
        }
        if (updateData.getBio() != null && updateData.getBio().length() > 256) {
            return false;
        }
        return true;
    }
}