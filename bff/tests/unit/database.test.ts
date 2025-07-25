import { DatabaseManager } from '../../src/utils/database';

describe('DatabaseManager Unit Tests', () => {
  let dbManager: DatabaseManager;

  beforeAll(() => {
    dbManager = new DatabaseManager(
      'http://localhost:9200',
      'redis://localhost:6379'
    );
  });

  afterAll(async () => {
    await dbManager.close();
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
  });

  describe('Error Handling', () => {
    it('should handle OpenSearch connection errors gracefully', async () => {
      const invalidDbManager = new DatabaseManager('http://invalid:9200', 'redis://localhost:6379');

      const isHealthy = await invalidDbManager.checkOpenSearchHealth();
      expect(isHealthy).toBe(false);

      await invalidDbManager.close();
    });

    it('should handle Redis connection errors gracefully', async () => {
      const invalidDbManager = new DatabaseManager('http://localhost:9200', 'redis://invalid:6379');

      const isHealthy = await invalidDbManager.checkRedisHealth();
      expect(isHealthy).toBe(false);

      await invalidDbManager.close();
    });
  });
});
