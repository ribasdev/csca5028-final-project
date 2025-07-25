import request from 'supertest';
import express from 'express';
import { DatabaseManager } from '../../src/utils/database';
import { certificateRoutes } from '../../src/routes/certificates';

describe('Certificates API Integration Tests', () => {
  let app: express.Application;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    dbManager = new DatabaseManager(
      process.env.OPENSEARCH_URL || 'http://localhost:9200',
      process.env.REDIS_URL || 'redis://localhost:6379'
    );

    app.locals.dbManager = dbManager;
    app.use('/api/certificates', certificateRoutes);
  });

  afterAll(async () => {
    await dbManager.close();
  });

  beforeEach(async () => {
    try {
      await dbManager.opensearchClient.indices.delete({ index: 'certificates-test' });
      await dbManager.opensearchClient.indices.delete({ index: 'alerts-test' });
    } catch (error) {
      // Indices might not exist
    }

    await dbManager.opensearchClient.indices.create({
      index: 'certificates-test',
      body: {
        mappings: {
          properties: {
            university: { type: 'text' },
            domain: { type: 'keyword' },
            state: { type: 'keyword' },
            issuer: { type: 'text' },
            subject: { type: 'text' },
            validFrom: { type: 'date' },
            validTo: { type: 'date' },
            daysUntilExpiry: { type: 'integer' },
            serialNumber: { type: 'keyword' },
            signatureAlgorithm: { type: 'keyword' },
            keySize: { type: 'integer' },
            securityGrade: { type: 'keyword' },
            status: { type: 'keyword' },
            scanTimestamp: { type: 'date' }
          }
        }
      }
    });

    await dbManager.opensearchClient.indices.create({
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
    try {
      await dbManager.opensearchClient.indices.delete({ index: 'certificates-test' });
      await dbManager.opensearchClient.indices.delete({ index: 'alerts-test' });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/certificates', () => {
    it('should return empty array when no certificates exist', async () => {
      const response = await request(app)
        .get('/api/certificates')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return certificates when they exist', async () => {
      const testCertificate = {
        university: 'Test University',
        domain: 'test.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=test.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-12-31T23:59:59Z',
        daysUntilExpiry: 365,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'A',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      await dbManager.opensearchClient.index({
        index: 'certificates-test',
        id: 'test-cert-1',
        body: testCertificate,
        refresh: 'wait_for'
      });

      const response = await request(app)
        .get('/api/certificates')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].domain).toBe('test.edu');
      expect(response.body[0].university).toBe('Test University');
    });
  });

  describe('GET /api/certificates/:domain', () => {
    it('should return 404 for non-existent certificate', async () => {
      const response = await request(app)
        .get('/api/certificates/nonexistent.edu')
        .expect(404);

      expect(response.body.error).toBe('Certificate not found');
    });

    it('should return certificate for existing domain', async () => {
      const testCertificate = {
        university: 'Example University',
        domain: 'example.edu',
        state: 'CA',
        issuer: 'Let\'s Encrypt',
        subject: 'CN=example.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-01-01T00:00:00Z',
        daysUntilExpiry: 100,
        serialNumber: '67890',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'A',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      await dbManager.opensearchClient.index({
        index: 'certificates-test',
        id: 'example-cert',
        body: testCertificate,
        refresh: 'wait_for'
      });

      const response = await request(app)
        .get('/api/certificates/example.edu')
        .expect(200);

      expect(response.body.domain).toBe('example.edu');
      expect(response.body.university).toBe('Example University');
      expect(response.body.securityGrade).toBe('A');
    });
  });

  describe('GET /api/certificates/alerts/recent', () => {
    it('should return empty array when no alerts exist', async () => {
      const response = await request(app)
        .get('/api/certificates/alerts/recent')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return unresolved alerts', async () => {
      const testAlerts = [
        {
          id: 'alert-1',
          type: 'expired',
          severity: 'critical',
          university: 'Test University',
          domain: 'expired.edu',
          message: 'Certificate has expired',
          timestamp: new Date().toISOString(),
          resolved: false
        },
        {
          id: 'alert-2',
          type: 'expiring',
          severity: 'high',
          university: 'Another University',
          domain: 'expiring.edu',
          message: 'Certificate expires in 5 days',
          timestamp: new Date().toISOString(),
          resolved: true
        }
      ];

      for (const alert of testAlerts) {
        await dbManager.opensearchClient.index({
          index: 'alerts-test',
          id: alert.id,
          body: alert,
          refresh: 'wait_for'
        });
      }

      const response = await request(app)
        .get('/api/certificates/alerts/recent')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('alert-1');
      expect(response.body[0].resolved).toBe(false);
    });
  });

  describe('GET /api/certificates/stats/dashboard', () => {
    it('should return dashboard statistics', async () => {
      const testCertificates = [
        {
          university: 'University A',
          domain: 'a.edu',
          state: 'CO',
          securityGrade: 'A',
          status: 'valid',
          scanTimestamp: new Date().toISOString()
        },
        {
          university: 'University B',
          domain: 'b.edu',
          state: 'CA',
          securityGrade: 'B',
          status: 'expiring',
          scanTimestamp: new Date().toISOString()
        },
        {
          university: 'University C',
          domain: 'c.edu',
          state: 'NY',
          securityGrade: 'F',
          status: 'expired',
          scanTimestamp: new Date().toISOString()
        }
      ];

      for (let i = 0; i < testCertificates.length; i++) {
        await dbManager.opensearchClient.index({
          index: 'certificates-test',
          id: `cert-${i}`,
          body: testCertificates[i],
          refresh: 'wait_for'
        });
      }

      const testAlert = {
        id: 'dashboard-alert-1',
        type: 'expired',
        severity: 'critical',
        university: 'University C',
        domain: 'c.edu',
        message: 'Certificate has expired',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await dbManager.opensearchClient.index({
        index: 'alerts-test',
        id: testAlert.id,
        body: testAlert,
        refresh: 'wait_for'
      });

      const response = await request(app)
        .get('/api/certificates/stats/dashboard')
        .expect(200);

      expect(response.body.totalUniversities).toBe(3);
      expect(response.body.validCertificates).toBe(1);
      expect(response.body.expiringCertificates).toBe(1);
      expect(response.body.expiredCertificates).toBe(1);
      expect(response.body.securityDistribution).toHaveProperty('A', 1);
      expect(response.body.securityDistribution).toHaveProperty('B', 1);
      expect(response.body.securityDistribution).toHaveProperty('F', 1);
      expect(response.body.recentAlerts).toHaveLength(1);
    });
  });

  describe('POST /api/certificates/scan/:domain', () => {
    it('should queue scan job for domain', async () => {
      const response = await request(app)
        .post('/api/certificates/scan/newscan.edu')
        .expect(200);

      expect(response.body.message).toBe('Scan queued for newscan.edu');

      const queueLength = await dbManager.redisClient.llen('scan_queue');
      expect(queueLength).toBe(1);

      const job = await dbManager.redisClient.brpop('scan_queue', 1);
      expect(job).not.toBeNull();

      if (job) {
        const parsedJob = JSON.parse(job[1]);
        expect(parsedJob.domain).toBe('newscan.edu');
        expect(parsedJob.priority).toBe('high');
      }
    });

    it('should handle scan job queuing errors gracefully', async () => {
      await dbManager.redisClient.quit();

      const response = await request(app)
        .post('/api/certificates/scan/error.edu')
        .expect(500);

      expect(response.body.error).toBe('Failed to queue scan job');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      await dbManager.opensearchClient.close();

      const response = await request(app)
        .get('/api/certificates')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch certificates');
    });

    it('should handle invalid request parameters', async () => {
      const response = await request(app)
        .get('/api/certificates/')
        .expect(404);
    });
  });
});
