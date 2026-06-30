package com.sns.c4.dto;

// c4_dtos.php - ResponseDto 相当
public class ResponseDto {
    private final String status;
    private final String errorCode;
    private final Object data;

    public ResponseDto(String status, String errorCode, Object data) {
        this.status    = status;
        this.errorCode = errorCode;
        this.data      = data;
    }

    public static ResponseDto ok(Object data)    { return new ResponseDto("success", null, data); }
    public static ResponseDto error(String code) { return new ResponseDto("error", code, null); }

    public String getStatus()    { return status; }
    public String getErrorCode() { return errorCode; }
    public Object getData()      { return data; }
    public boolean isSuccess()   { return "success".equals(status); }
}
