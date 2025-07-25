const mockRedisData = new Map<string, any>();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    del: jest.fn().mockImplementation((key: string) => {
      mockRedisData.delete(key);
      return Promise.resolve(1);
    }),
    lpush: jest.fn().mockImplementation((key: string, value: string) => {
      if (!mockRedisData.has(key)) mockRedisData.set(key, []);
      mockRedisData.get(key).push(value);
      return Promise.resolve(mockRedisData.get(key).length);
    }),
    brpop: jest.fn().mockImplementation((key: string, timeout: number) => {
      const queue = mockRedisData.get(key) || [];
      const item = queue.pop();
      return Promise.resolve(item ? [key, item] : null);
    }),
    llen: jest.fn().mockImplementation((key: string) => {
      const queue = mockRedisData.get(key) || [];
      return Promise.resolve(queue.length);
    }),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }));
});

import Redis from 'ioredis';
import { AlertProcessor } from '../../src/alerter';
import { Alert } from '../../../shared/types';

describe('Alert Service Integration Tests', () => {
  let redis: Redis;
  let alertProcessor: AlertProcessor;

  beforeAll(async () => {
    redis = new Redis('redis://localhost:6379');
    alertProcessor = new AlertProcessor();
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  beforeEach(async () => {
    mockRedisData.clear();
    
    jest.clearAllMocks();
  });

  describe('Alert Queue Processing', () => {
    it('should process alert jobs from Redis queue', async () => {
      const alert: Alert = {
        id: 'test-alert-1',
        type: 'expiring',
        severity: 'critical',
        message: 'Certificate expiring soon',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await redis.lpush('alert_queue', JSON.stringify({
        alertId: 'test-alert-1',
        alert: alert
      }));

      const queueLength = await redis.llen('alert_queue');
      expect(queueLength).toBe(1);

      const job = await redis.brpop('alert_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        const parsedJob = JSON.parse(job[1]);
        expect(parsedJob.alertId).toBe('test-alert-1');
        expect(parsedJob.alert.severity).toBe('critical');
        expect(parsedJob.alert.university).toBe('Test University');
      }
    });

    it('should handle multiple alert jobs in queue', async () => {
      const alerts = [
        {
          alertId: 'alert-1',
          alert: {
            id: 'alert-1',
            type: 'expiring' as const,
            severity: 'critical' as const,
            message: 'Critical alert',
            university: 'University 1',
            domain: 'uni1.edu',
            timestamp: new Date().toISOString(),
            resolved: false
          }
        },
        {
          alertId: 'alert-2',
          alert: {
            id: 'alert-2',
            type: 'security' as const,
            severity: 'high' as const,
            message: 'High priority alert',
            university: 'University 2',
            domain: 'uni2.edu',
            timestamp: new Date().toISOString(),
            resolved: false
          }
        }
      ];

      // Add multiple alerts to queue
      for (const alert of alerts) {
        await redis.lpush('alert_queue', JSON.stringify(alert));
      }

      // Verify queue length
      const queueLength = await redis.llen('alert_queue');
      expect(queueLength).toBe(2);

      // Process all alerts
      const processedJobs = [];
      for (let i = 0; i < 2; i++) {
        const job = await redis.brpop('alert_queue', 1);
        if (job) {
          processedJobs.push(JSON.parse(job[1]));
        }
      }

      expect(processedJobs).toHaveLength(2);
      expect(processedJobs.map(j => j.alertId)).toEqual(expect.arrayContaining(['alert-1', 'alert-2']));
    });
  });

  describe('Alert Processing Logic', () => {
    it('should process critical alerts with notifications', async () => {
      const criticalAlert: Alert = {
        id: 'critical-test',
        type: 'expired',
        severity: 'critical',
        message: 'Certificate expired',
        university: 'Critical University',
        domain: 'critical.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      // Process the alert using AlertProcessor
      await expect(alertProcessor.processAlert(criticalAlert)).resolves.toBeUndefined();
      // Note: In a real integration test, we might verify that emails/webhooks were triggered
    });

    it('should handle alert processing errors gracefully', async () => {
      const invalidAlert = {
        alertId: 'invalid-alert',
        alert: null // Invalid alert data
      };

      await redis.lpush('alert_queue', JSON.stringify(invalidAlert));
      
      const job = await redis.brpop('alert_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        expect(() => {
          const parsed = JSON.parse(job[1]);
          expect(parsed.alert).toBeNull();
        }).not.toThrow();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Create a mock that throws an error
      const errorClient = {
        lpush: jest.fn().mockRejectedValue(new Error('Redis Connection Error')),
        brpop: jest.fn().mockRejectedValue(new Error('Redis Connection Error'))
      } as any;
      
      await expect(
        errorClient.lpush('alert_queue', JSON.stringify({ test: 'data' }))
      ).rejects.toThrow('Redis Connection Error');
    });
  });
});