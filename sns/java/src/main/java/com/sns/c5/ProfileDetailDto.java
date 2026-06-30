package com.sns.c5;

// M2の戻り値：プロフィール詳細データと編集権限フラグを含むオブジェクト
public record ProfileDetailDto(
    int userId,
    String name,        // last_name + " " + first_name
    Integer grade,
    String course,
    String bio,
    String department,  // 団体・学科相当
    String lab,         // 授業・研究室相当
    String timetable,
    String email,
    boolean isOwnProfile // 💡 閲覧・編集権限の判定結果(本人フラグ)
) {}
