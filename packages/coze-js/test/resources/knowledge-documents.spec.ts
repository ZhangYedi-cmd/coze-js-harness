import {
  Documents,
  type ListDocumentReq,
  type ListDocumentData,
  type CreateDocumentReq,
  type DocumentInfo,
  type DeleteDocumentReq,
  type UpdateDocumentReq,
} from '../../src/resources/knowledge/documents/documents';
import { CozeAPI } from '../../src/index';

describe('Knowledge Documents', () => {
  let client: CozeAPI;
  let documents: Documents;

  beforeEach(() => {
    client = new CozeAPI({ token: 'test-token' });
    documents = new Documents(client);
  });

  const mockDocumentInfo: DocumentInfo = {
    char_count: 1000,
    chunk_strategy: { chunk_type: 0, max_tokens: 500 },
    create_time: 1234567890,
    document_id: 'doc-1',
    format_type: 1,
    hit_count: 5,
    name: 'Document 1',
    size: 2048,
    slice_count: 3,
    status: 1,
    type: 'pdf',
    update_interval: 24,
    update_time: 1234567891,
    update_type: 1,
  };

  const knowledgeHeaders = { headers: { 'agw-js-conv': 'str' } };

  describe('list', () => {
    it('should list knowledge documents', async () => {
      const mockResponse: ListDocumentData = {
        total: 1,
        document_infos: [mockDocumentInfo],
      };
      vi.spyOn(client, 'get').mockResolvedValue(mockResponse);

      const params: ListDocumentReq = {
        dataset_id: 'dataset-id',
        page: 1,
        page_size: 10,
      };

      const result = await documents.list(params);

      expect(client.get).toHaveBeenCalledWith(
        '/open_api/knowledge/document/list',
        params,
        false,
        knowledgeHeaders,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should list knowledge documents with minimal params', async () => {
      const mockResponse: ListDocumentData = {
        total: 0,
        document_infos: [],
      };
      vi.spyOn(client, 'get').mockResolvedValue(mockResponse);

      const params: ListDocumentReq = { dataset_id: 'dataset-id' };

      const result = await documents.list(params);

      expect(client.get).toHaveBeenCalledWith(
        '/open_api/knowledge/document/list',
        params,
        false,
        knowledgeHeaders,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('create', () => {
    it('should create knowledge documents', async () => {
      const mockResponse = { document_infos: [mockDocumentInfo] };
      vi.spyOn(client, 'post').mockResolvedValue(mockResponse);

      const params: CreateDocumentReq = {
        dataset_id: 'dataset-id',
        document_bases: [
          {
            name: 'Document 1',
            source_info: { file_base64: 'base64str', file_type: 'pdf' },
            update_rule: { update_type: 1, update_interval: 24 },
          },
        ],
        chunk_strategy: { chunk_type: 0, max_tokens: 500 },
      };

      const result = await documents.create(params);

      expect(client.post).toHaveBeenCalledWith(
        '/open_api/knowledge/document/create',
        params,
        false,
        knowledgeHeaders,
      );
      expect(result).toEqual([mockDocumentInfo]);
    });

    it('should create knowledge documents from web url', async () => {
      const mockResponse = { document_infos: [mockDocumentInfo] };
      vi.spyOn(client, 'post').mockResolvedValue(mockResponse);

      const params: CreateDocumentReq = {
        dataset_id: 'dataset-id',
        document_bases: [
          {
            name: 'Web Doc',
            source_info: { web_url: 'https://example.com', document_source: 0 },
          },
        ],
      };

      const result = await documents.create(params);

      expect(result).toEqual([mockDocumentInfo]);
    });
  });

  describe('delete', () => {
    it('should delete knowledge documents', async () => {
      vi.spyOn(client, 'post').mockResolvedValue(undefined);

      const params: DeleteDocumentReq = {
        document_ids: ['doc-1', 'doc-2'],
      };

      await documents.delete(params);

      expect(client.post).toHaveBeenCalledWith(
        '/open_api/knowledge/document/delete',
        params,
        false,
        knowledgeHeaders,
      );
    });

    it('should delete a single knowledge document', async () => {
      vi.spyOn(client, 'post').mockResolvedValue(undefined);

      await documents.delete({ document_ids: ['doc-1'] });

      expect(client.post).toHaveBeenCalledWith(
        '/open_api/knowledge/document/delete',
        { document_ids: ['doc-1'] },
        false,
        knowledgeHeaders,
      );
    });
  });

  describe('update', () => {
    it('should update a knowledge document name', async () => {
      vi.spyOn(client, 'post').mockResolvedValue(undefined);

      const params: UpdateDocumentReq = {
        document_id: 'doc-1',
        document_name: 'Updated Name',
      };

      await documents.update(params);

      expect(client.post).toHaveBeenCalledWith(
        '/open_api/knowledge/document/update',
        params,
        false,
        knowledgeHeaders,
      );
    });

    it('should update a knowledge document with update rule', async () => {
      vi.spyOn(client, 'post').mockResolvedValue(undefined);

      const params: UpdateDocumentReq = {
        document_id: 'doc-1',
        document_name: 'Updated Name',
        update_rule: { update_type: 2, update_interval: 48 },
      };

      await documents.update(params);

      expect(client.post).toHaveBeenCalledWith(
        '/open_api/knowledge/document/update',
        params,
        false,
        knowledgeHeaders,
      );
    });
  });
});
