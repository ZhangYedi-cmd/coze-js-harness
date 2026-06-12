import '@coze/api';

declare module '@coze/api' {
  interface CreateConversationReq {
    connector_id?: string;
  }
  interface RetrieveBotReq {
    connector_id?: string;
  }
}
