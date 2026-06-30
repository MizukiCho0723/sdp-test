package com.sns.c5;

public class ProfileUpdateDto {
    private String name;
    private Integer grade;
    private String course;
    private String bio;

    // Getter / Setter
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getGrade() { return grade; }
    public void setGrade(Integer grade) { this.grade = grade; }
    public String getCourse() { return course; }
    public void setCourse(String course) { this.course = course; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
}