package com.sns.c4.dto;

// c4_dtos.php - MessageContextDto 相当
public class MessageContextDto {
    private Integer senderId;
    private Integer receiverId;
    private String  messageContent;
    private Integer partnerUserId;
    private Integer loginUserId;

    public MessageContextDto() {}

    public MessageContextDto(Integer senderId, Integer receiverId, String messageContent,
                              Integer partnerUserId, Integer loginUserId) {
        this.senderId       = senderId;
        this.receiverId     = receiverId;
        this.messageContent = messageContent;
        this.partnerUserId  = partnerUserId;
        this.loginUserId    = loginUserId;
    }

    public Integer getSenderId()      { return senderId; }
    public Integer getReceiverId()    { return receiverId; }
    public String  getMessageContent(){ return messageContent; }
    public Integer getPartnerUserId() { return partnerUserId; }
    public Integer getLoginUserId()   { return loginUserId; }

    public void setSenderId(Integer v)      { this.senderId = v; }
    public void setReceiverId(Integer v)    { this.receiverId = v; }
    public void setMessageContent(String v) { this.messageContent = v; }
    public void setPartnerUserId(Integer v) { this.partnerUserId = v; }
    public void setLoginUserId(Integer v)   { this.loginUserId = v; }
}
