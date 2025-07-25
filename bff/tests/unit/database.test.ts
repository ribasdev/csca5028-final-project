import { DatabaseManager } from '../../src/utils/database';

describe('DatabaseManager Unit Tests', () => {
  let dbManager: DatabaseManager;
  let mockOpenSearchClient: any;
  let mockRedisClient: any;

  beforeEach(() => {
    // Create mock clients
    mockOpenSearchClient = {
      indices: {
        exists: jest.fn().mockResolvedValue({ body: true }),
        create: jest.fn().mockResolvedValue({ body: { acknowledged: true } }),
      },
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            hits: [{ _source: { test: 'data' } }],
            total: { value: 1 }
          }
        }
      }),
      cluster: {
        health: jest.fn().mockResolvedValue({
          body: { status: 'green' }
        })
      }
    };

    mockRedisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
      lpush: jest.fn().mockResolvedValue(1),
      llen: jest.fn().mockResolvedValue(0),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };

    // Create DatabaseManager with test URLs
    dbManager = new DatabaseManager(
      'http://localhost:9200',
      'redis://localhost:6379'
    );

    // Replace the clients with mocks
    (dbManager as any).opensearch = mockOpenSearchClient;
    (dbManager as any).redis = mockRedisClient;
  });

  afterEach(async () => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('Client Getters', () => {
    it('should provide OpenSearch client', () => {
      const client = dbManager.opensearchClient;
      expect(client).toBeDefined();
      expect(client.indices).toBeDefined();
      expect(client.search).toBeDefined();
    });

    it('should provide Redis client', () => {
      const client = dbManager.redisClient;
      expect(client).toBeDefined();
      expect(client.ping).toBeDefined();
      expect(client.lpush).toBeDefined();
    });
  });

  describe('Index Management', () => {
    it('should initialize indices without errors', async () => {
      await expect(dbManager.initializeIndices()).resolves.not.toThrow();
    });
  });

  describe('Health Checks', () => {
    it('should check OpenSearch health', async () => {
      const isHealthy = await dbManager.checkOpenSearchHealth();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should check Redis health', async () => {
      const isHealthy = await dbManager.checkRedisHealth();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Search Operations', () => {
    it('should handle search certificates with empty query', async () => {
      const query = { query: { match_all: {} } };
      await expect(dbManager.searchCertificates(query)).resolves.toBeDefined();
    });

    it('should handle search alerts with empty query', async () => {
      const query = { query: { match_all: {} } };
      await expect(dbManager.searchAlerts(query)).resolves.toBeDefined();
    });
  });

  describe('Queue Operations', () => {
    it('should push data to queue', async () => {
      const testData = { test: 'data', timestamp: new Date().toISOString() };
      await expect(dbManager.pushToQueue('test-queue', testData)).resolves.not.toThrow();
    });

    it('should get queue length', async () => {
      const length = await dbManager.getQueueLength('test-queue');
      expect(typeof length).toBe('number');
      expect(length).toBeGreaterThanOrEqual(0);
    });

    it('should get queue depths for all queues', async () => {
      // Mock different queue lengths
      mockRedisClient.llen = jest.fn()
        .mockResolvedValueOnce(5)  // scan_queue
        .mockResolvedValueOnce(3)  // analysis_queue
        .mockResolvedValueOnce(1); // alert_queue

      const depths = await dbManager.getQueueDepths();
      
      expect(depths).toEqual({
        scan_queue: 5,
        analysis_queue: 3,
        alert_queue: 1
      });
      
      expect(mockRedisClient.llen).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.llen).toHaveBeenCalledWith('scan_queue');
      expect(mockRedisClient.llen).toHaveBeenCalledWith('analysis_queue');
      expect(mockRedisClient.llen).toHaveBeenCalledWith('alert_queue');
    });

    it('should handle queue depth errors gracefully', async () => {
      // Mock Redis llen to throw an error
      mockRedisClient.llen = jest.fn().mockRejectedValue(new Error('Redis Error'));
      
      const depths = await dbManager.getQueueDepths();
      
      expect(depths).toEqual({
        scan_queue: 0,
        analysis_queue: 0,
        alert_queue: 0
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenSearch connection errors gracefully', async () => {
      // Mock OpenSearch cluster health to throw an error
      mockOpenSearchClient.cluster.health = jest.fn().mockRejectedValue(new Error('Connection Error'));
      
      const isHealthy = await dbManager.checkOpenSearchHealth();
      expect(isHealthy).toBe(false);
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis ping to throw an error
      mockRedisClient.ping = jest.fn().mockRejectedValue(new Error('Redis Connection Error'));
      
      const isHealthy = await dbManager.checkRedisHealth();
      expect(isHealthy).toBe(false);
    });
  });
});
