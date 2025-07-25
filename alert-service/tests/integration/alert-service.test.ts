import { Alert } from 'shared';
import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';

describe('Alert Service Integration Tests', () => {
  let redis: Redis;
  let opensearch: Client;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    opensearch = new Client({
      node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
    });
  });

  afterAll(async () => {
    await redis.quit();
    await opensearch.close();
  });

  beforeEach(async () => {
    await redis.del('alert_queue');
    try {
      await opensearch.indices.delete({ index: 'alerts-test' });
    } catch (error) {
    }

    await opensearch.indices.create({
      index: 'alerts-test',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' },
            severity: { type: 'keyword' },
            university: { type: 'text' },
            domain: { type: 'keyword' },
            message: { type: 'text' },
            timestamp: { type: 'date' },
            resolved: { type: 'boolean' }
          }
        }
      }
    });
  });

  afterEach(async () => {
    await redis.del('alert_queue');
    try {
      await opensearch.indices.delete({ index: 'alerts-test' });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Alert Queue Processing', () => {
    it('should process alerts from Redis queue', async () => {
      const alert: Alert = {
        id: 'integration-test-alert-1',
        type: 'expired',
        severity: 'critical',
        message: 'Certificate has expired',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await redis.lpush('alert_queue', JSON.stringify(alert));

      const queueLength = await redis.llen('alert_queue');
      expect(queueLength).toBe(1);

      const alertFromQueue = await redis.brpop('alert_queue', 1);
      expect(alertFromQueue).not.toBeNull();

      if (alertFromQueue) {
        const parsedAlert = JSON.parse(alertFromQueue[1]);
        expect(parsedAlert.id).toBe('integration-test-alert-1');
        expect(parsedAlert.type).toBe('expired');
        expect(parsedAlert.severity).toBe('critical');
        expect(parsedAlert.university).toBe('Test University');
        expect(parsedAlert.domain).toBe('test.edu');
      }
    });

    it('should handle multiple alerts in queue', async () => {
      const alerts: Alert[] = [
        {
          id: 'alert-1',
          type: 'expiring',
          severity: 'high',
          message: 'Certificate expires in 7 days',
          university: 'University 1',
          domain: 'uni1.edu',
          timestamp: new Date().toISOString(),
          resolved: false
        },
        {
          id: 'alert-2',
          type: 'expired',
          severity: 'critical',
          message: 'Certificate has expired',
          university: 'University 2',
          domain: 'uni2.edu',
          timestamp: new Date().toISOString(),
          resolved: false
        }
      ];

      for (const alert of alerts) {
        await redis.lpush('alert_queue', JSON.stringify(alert));
      }

      const queueLength = await redis.llen('alert_queue');
      expect(queueLength).toBe(2);

      const processedAlerts: Alert[] = [];
      while (await redis.llen('alert_queue') > 0) {
        const alertFromQueue = await redis.brpop('alert_queue', 1);
        if (alertFromQueue) {
          processedAlerts.push(JSON.parse(alertFromQueue[1]) as Alert);
        }
      }

      expect(processedAlerts).toHaveLength(2);
      expect(processedAlerts.map(a => a.id)).toEqual(expect.arrayContaining(['alert-1', 'alert-2']));
    });
  });

  describe('OpenSearch Integration', () => {
    it('should store alerts in OpenSearch', async () => {
      const alert: Alert = {
        id: 'opensearch-test-alert-1',
        type: 'security',
        severity: 'medium',
        message: 'Weak cipher detected',
        university: 'Security University',
        domain: 'security.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await opensearch.index({
        index: 'alerts-test',
        id: alert.id,
        body: alert,
        refresh: 'wait_for'
      });

      const searchResponse = await opensearch.search({
        index: 'alerts-test',
        body: {
          query: {
            term: { 'id.keyword': alert.id }
          }
        }
      });

      expect(searchResponse.body.hits.hits).toHaveLength(1);
      const storedAlert = searchResponse.body.hits.hits[0]._source;
      expect(storedAlert.id).toBe('opensearch-test-alert-1');
      expect(storedAlert.type).toBe('security');
      expect(storedAlert.severity).toBe('medium');
      expect(storedAlert.university).toBe('Security University');
      expect(storedAlert.domain).toBe('security.edu');
      expect(storedAlert.resolved).toBe(false);
    });

    it('should search alerts by severity', async () => {
      const alerts: Alert[] = [
        {
          id: 'critical-alert-1',
          type: 'expired',
          severity: 'critical',
          message: 'Certificate expired',
          university: 'Critical University',
          domain: 'critical.edu',
          timestamp: new Date().toISOString(),
          resolved: false
        },
        {
          id: 'high-alert-1',
          type: 'expiring',
          severity: 'high',
          message: 'Certificate expiring',
          university: 'High University',
          domain: 'high.edu',
          timestamp: new Date().toISOString(),
          resolved: false
        }
      ];

      for (const alert of alerts) {
        await opensearch.index({
          index: 'alerts-test',
          id: alert.id,
          body: alert,
          refresh: 'wait_for'
        });
      }

      const criticalAlerts = await opensearch.search({
        index: 'alerts-test',
        body: {
          query: {
            term: { severity: 'critical' }
          }
        }
      });

      expect(criticalAlerts.body.hits.hits).toHaveLength(1);
      expect(criticalAlerts.body.hits.hits[0]._source.id).toBe('critical-alert-1');

      const highAlerts = await opensearch.search({
        index: 'alerts-test',
        body: {
          query: {
            term: { severity: 'high' }
          }
        }
      });

      expect(highAlerts.body.hits.hits).toHaveLength(1);
      expect(highAlerts.body.hits.hits[0]._source.id).toBe('high-alert-1');
    });

    it('should search unresolved alerts', async () => {
      const alerts: Alert[] = [
        {
          id: 'unresolved-alert-1',
          type: 'expired',
          severity: 'critical',
          message: 'Certificate expired',
          university: 'Test University',
          domain: 'test1.edu',
          timestamp: new Date().toISOString(),
          resolved: false
        },
        {
          id: 'resolved-alert-1',
          type: 'expiring',
          severity: 'high',
          message: 'Certificate expiring',
          university: 'Test University',
          domain: 'test2.edu',
          timestamp: new Date().toISOString(),
          resolved: true
        }
      ];

      for (const alert of alerts) {
        await opensearch.index({
          index: 'alerts-test',
          id: alert.id,
          body: alert,
          refresh: 'wait_for'
        });
      }

      const unresolvedAlerts = await opensearch.search({
        index: 'alerts-test',
        body: {
          query: {
            term: { resolved: false }
          }
        }
      });

      expect(unresolvedAlerts.body.hits.hits).toHaveLength(1);
      expect(unresolvedAlerts.body.hits.hits[0]._source.id).toBe('unresolved-alert-1');
      expect(unresolvedAlerts.body.hits.hits[0]._source.resolved).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed alert data gracefully', async () => {
      const malformedAlert = 'invalid-json-data';

      await redis.lpush('alert_queue', malformedAlert);

      const alertFromQueue = await redis.brpop('alert_queue', 1);
      expect(alertFromQueue).not.toBeNull();

      if (alertFromQueue) {
        expect(() => JSON.parse(alertFromQueue[1])).toThrow();
      }
    });

    it('should handle OpenSearch connection errors', async () => {
      const invalidOpensearch = new Client({
        node: 'http://invalid-host:9200'
      });

      const alert: Alert = {
        id: 'error-test-alert',
        type: 'error',
        severity: 'high',
        message: 'Test error handling',
        university: 'Error University',
        domain: 'error.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await expect(
        invalidOpensearch.index({
          index: 'alerts-test',
          id: alert.id,
          body: alert
        })
      ).rejects.toThrow();

      await invalidOpensearch.close();
    });
  });
});
