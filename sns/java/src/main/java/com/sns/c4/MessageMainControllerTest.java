package com.sns.c4;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.sns.c4.dto.MessageContextDto;
import com.sns.c4.dto.ResponseDto;

class MessageMainControllerTest {

    private MessageMainController controller;

    @BeforeEach
    void setUp() {
        // テストごとに毎回コントローラーとダミーのサービスを初期化
        MessageSendService sendService = new MessageSendService(null);
        MessageFetchService fetchService = new MessageFetchService(null);
        MessagePartnerListService partnerListService = new MessagePartnerListService(null);
        
        controller = new MessageMainController(sendService, fetchService, partnerListService);
    }

    // ==========================================
    // 1. 同値分割・境界値分析に基づいたテストケース
    // ==========================================

    @Test
    @DisplayName("【正常系：同値分割】actionTypeが'send'でメッセージが正常に送信できること")
    void testDispatch_Send_Success() {
        MessageContextDto context = new MessageContextDto();
        context.setLoginUserId(1);
        context.setPartnerUserId(2);
        context.setMessageContent("こんにちは"); // 正常な文字列（同値分割：有効値）

        ResponseDto response = controller.dispatchMessageAction("send", context);

        assertNotNull(response);
        assertEquals("success", response.getStatus());
    }

    @Test
    @DisplayName("【異常系：境界値分析】メッセージが空文字(0文字)の場合は送信失敗すること")
    void testDispatch_Send_Boundary_Empty() {
        MessageContextDto context = new MessageContextDto();
        context.setLoginUserId(1);
        context.setPartnerUserId(2);
        context.setMessageContent(""); // 0文字（境界値）

        ResponseDto response = controller.dispatchMessageAction("send", context);

        assertNotNull(response);
        assertEquals("error", response.getStatus());
        assertEquals("MESSAGE_SEND_FAILED", response.getErrorCode());
    }

    @Test
    @DisplayName("【異常系：境界値分析】メッセージが257バイト以上の場合は送信失敗すること")
    void testDispatch_Send_Boundary_Overflow() {
        MessageContextDto context = new MessageContextDto();
        context.setLoginUserId(1);
        context.setPartnerUserId(2);
        // 日本語1文字=3バイト計算で、90文字（270バイト）の文字列を作成
        context.setMessageContent("あ".repeat(90)); 

        ResponseDto response = controller.dispatchMessageAction("send", context);

        assertNotNull(response);
        assertEquals("error", response.getStatus());
        assertEquals("MESSAGE_SEND_FAILED", response.getErrorCode());
    }

    // ==========================================
    // 2. 分岐網羅（カバレッジ100%）のためのテストケース
    // ==========================================

    @Test
    @DisplayName("【異常系】actionTypeがnullの場合、INVALID_ACTIONエラーが返ること")
    void testDispatch_ActionType_Null() {
        MessageContextDto context = new MessageContextDto();
        ResponseDto response = controller.dispatchMessageAction(null, context);

        assertNotNull(response);
        assertEquals("error", response.getStatus());
        assertEquals("INVALID_ACTION", response.getErrorCode());
    }

    @Test
    @DisplayName("【正常系】actionTypeが'history'の場合、チャット履歴が返ること")
    void testDispatch_History_Success() {
        MessageContextDto context = new MessageContextDto();
        context.setLoginUserId(1);
        context.setPartnerUserId(2);

        ResponseDto response = controller.dispatchMessageAction("history", context);

        assertNotNull(response);
        assertEquals("success", response.getStatus());
    }

    @Test
    @DisplayName("【正常系】actionTypeが'partners'の場合、チャット相手一覧が返ること")
    void testDispatch_Partners_Success() {
        MessageContextDto context = new MessageContextDto();
        context.setLoginUserId(1);

        ResponseDto response = controller.dispatchMessageAction("partners", context);

        assertNotNull(response);
        assertEquals("success", response.getStatus());
    }

    @Test
    @DisplayName("【異常系】actionTypeが想定外の文字列（例：'delete'）の場合、INVALID_ACTIONエラーが返ること")
    void testDispatch_InvalidActionType() {
        MessageContextDto context = new MessageContextDto();
        ResponseDto response = controller.dispatchMessageAction("delete", context);

        assertNotNull(response);
        assertEquals("error", response.getStatus());
        assertEquals("INVALID_ACTION", response.getErrorCode());
    }
}