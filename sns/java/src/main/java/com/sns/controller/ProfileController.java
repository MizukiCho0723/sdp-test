package com.sns.controller;

import com.sns.util.ApiHelper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// profiles.php 相当
@RestController
@RequestMapping("/api/profiles")
public class ProfileController {

    private final JdbcTemplate jdbc;

    public ProfileController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @RequestMapping
    public ResponseEntity<Map<String, Object>> dispatch(HttpServletRequest req, HttpSession session) {
        Integer userId = ApiHelper.getLoginUserId(session);
        if (userId == null) return ApiHelper.error("ログインが必要です", 401);

        String action = p(req, "action");
        return switch (action) {
            case "get"    -> getProfile(req, userId);
            case "update" -> updateProfile(req, userId);
            case "search" -> searchProfiles(req, userId);
            default       -> ApiHelper.error("不正なアクション");
        };
    }

    // ---- getProfile() ----
    private ResponseEntity<Map<String, Object>> getProfile(HttpServletRequest req, int loginUserId) {
        int targetId = parseIntParam(req, "user_id", loginUserId);

        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT pr.*, u.email,
                   TRIM(pr.last_name || ' ' || pr.first_name) AS name,
                   (? = pr.user_id) AS is_own
            FROM profiles pr
            JOIN users u ON pr.user_id = u.user_id
            WHERE pr.user_id = ?
            """, loginUserId, targetId);

        if (rows.isEmpty()) return ApiHelper.error("このユーザーは退会済みです", 404);
        return ApiHelper.ok(Map.of("profile", rows.get(0)));
    }

    // ---- updateProfile() ----
    private ResponseEntity<Map<String, Object>> updateProfile(HttpServletRequest req, int userId) {
        String lastName  = p(req, "last_name");
        String firstName = p(req, "first_name");
        String bio       = p(req, "bio");

        if (lastName.isEmpty())
            return ApiHelper.error("名前（姓）を入力してください（名前は必須項目です）");
        if ((lastName + " " + firstName).getBytes().length > 64)
            return ApiHelper.error("名前は64バイト以下（全角約21文字以内）にしてください");
        if (bio.getBytes().length > 1024)
            return ApiHelper.error("自己紹介は1024バイト以下（全角約340文字以内）にしてください");

        int    grade      = parseIntParam(req, "grade", 0);
        String department = p(req, "department");
        String course     = p(req, "course");
        String lab        = p(req, "lab");
        String clubs      = p(req, "clubs");
        String timetable  = p(req, "timetable");

        jdbc.update("""
            UPDATE profiles
            SET last_name=?, first_name=?, grade=?, department=?, course=?, lab=?, clubs=?, bio=?, timetable=?
            WHERE user_id=?
            """, lastName, firstName, grade, department, course, lab, clubs, bio, timetable, userId);
        return ApiHelper.ok();
    }

    // ---- searchProfiles() ----
    private ResponseEntity<Map<String, Object>> searchProfiles(HttpServletRequest req, int loginUserId) {
        StringBuilder sql = new StringBuilder("""
            SELECT pr.user_id, TRIM(pr.last_name || ' ' || pr.first_name) AS name,
                   pr.icon_id, pr.grade, pr.department, pr.course, pr.bio
            FROM profiles pr
            WHERE pr.user_id != ?
            """);
        List<Object> params = new ArrayList<>();
        params.add(loginUserId);

        String name   = p(req, "name");
        String grade  = p(req, "grade");
        String course = p(req, "course");
        String clubs  = p(req, "clubs");
        String lab    = p(req, "lab");

        if (!name.isEmpty()) {
            sql.append(" AND ((pr.last_name || ' ' || pr.first_name) LIKE ?" +
                       " OR (pr.last_name || pr.first_name) LIKE ?)");
            params.add("%" + name + "%");
            params.add("%" + name + "%");
        }
        if (!grade.isEmpty()) {
            sql.append(" AND pr.grade = ?");
            params.add(Integer.parseInt(grade));
        }
        if (!course.isEmpty()) {
            sql.append(" AND pr.course LIKE ?");
            params.add("%" + course + "%");
        }
        if (!clubs.isEmpty()) {
            sql.append(" AND pr.clubs LIKE ?");
            params.add("%" + clubs + "%");
        }
        if (!lab.isEmpty()) {
            sql.append(" AND pr.lab LIKE ?");
            params.add("%" + lab + "%");
        }
        sql.append(" ORDER BY pr.last_name, pr.first_name LIMIT 50");

        List<Map<String, Object>> results = jdbc.queryForList(sql.toString(), params.toArray());
        return ApiHelper.ok(Map.of("profiles", results));
    }

    private String p(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return v != null ? v.trim() : "";
    }

    private int parseIntParam(HttpServletRequest req, String name, int def) {
        try { return Integer.parseInt(p(req, name)); } catch (NumberFormatException e) { return def; }
    }
}
