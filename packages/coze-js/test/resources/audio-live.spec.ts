import {
  Live,
  type RetrieveLiveData,
  LiveType,
} from '../../src/resources/audio/live/index';
import { CozeAPI } from '../../src/index';

describe('Live', () => {
  let client: CozeAPI;
  let live: Live;

  beforeEach(() => {
    client = new CozeAPI({ token: 'test-token' });
    live = new Live(client);
  });

  describe('retrieve', () => {
    it('should retrieve live info', async () => {
      const mockData: RetrieveLiveData = {
        app_id: 'app-123',
        stream_infos: [
          {
            stream_id: 'stream-1',
            name: 'Origin Stream',
            live_type: LiveType.Origin,
          },
          {
            stream_id: 'stream-2',
            name: 'Translation Stream',
            live_type: LiveType.Translation,
          },
        ],
      };
      vi.spyOn(client, 'get').mockResolvedValue({ data: mockData });

      const result = await live.retrieve('live-123');

      expect(client.get).toHaveBeenCalledWith(
        '/v1/audio/live/live-123',
        undefined,
        false,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it('should retrieve live info with empty stream list', async () => {
      const mockData: RetrieveLiveData = {
        app_id: 'app-456',
        stream_infos: [],
      };
      vi.spyOn(client, 'get').mockResolvedValue({ data: mockData });

      const result = await live.retrieve('live-456');

      expect(client.get).toHaveBeenCalledWith(
        '/v1/audio/live/live-456',
        undefined,
        false,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it('should pass request options through', async () => {
      const mockData: RetrieveLiveData = { app_id: 'app-789', stream_infos: [] };
      vi.spyOn(client, 'get').mockResolvedValue({ data: mockData });

      const options = { headers: { 'x-custom': 'value' } };
      await live.retrieve('live-789', options);

      expect(client.get).toHaveBeenCalledWith(
        '/v1/audio/live/live-789',
        undefined,
        false,
        options,
      );
    });
  });
});
