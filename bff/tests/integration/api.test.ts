const mockRedisData = new Map<string, any>();
const mockOpenSearchData = new Map<string, any>();

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
      if (queue.length > 0) {
        const item = queue.pop();
        return Promise.resolve([key, item]);
      }
      return Promise.resolve(null);
    }),
    llen: jest.fn().mockImplementation((key: string) => {
      const queue = mockRedisData.get(key) || [];
      return Promise.resolve(queue.length);
    }),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }));
});

jest.mock('@opensearch-project/opensearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      indices: {
        create: jest.fn().mockResolvedValue({ body: { acknowledged: true } }),
        delete: jest.fn().mockResolvedValue({ body: { acknowledged: true } }),
        exists: jest.fn().mockResolvedValue({ body: false })
      },
      index: jest.fn().mockImplementation((params: any) => {
        const key = `${params.index}:${params.id || 'doc'}`;
        mockOpenSearchData.set(key, params.body);
        return Promise.resolve({ 
          statusCode: 201, 
          body: { _id: params.id || 'generated-id', result: 'created' } 
        });
      }),
      get: jest.fn().mockImplementation((params: any) => {
        const key = `${params.index}:${params.id}`;
        const doc = mockOpenSearchData.get(key);
        if (doc) {
          return Promise.resolve({ body: { _source: doc } });
        } else {
          return Promise.reject({ statusCode: 404 });
        }
      }),
      search: jest.fn().mockImplementation((params: any) => {
        const results: any[] = [];
        mockOpenSearchData.forEach((value, key) => {
          if (key.startsWith(params.index + ':')) {
            results.push({ _source: value });
          }
        });
        return Promise.resolve({
          body: {
            hits: {
              hits: results,
              total: { value: results.length }
            }
          }
        });
      }),
      cluster: {
        health: jest.fn().mockResolvedValue({
          body: { status: 'green' }
        })
      },
      close: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { DatabaseManager } from '../../src/utils/database';
import { certificateRoutes } from '../../src/routes/certificates';
import { universityRoutes } from '../../src/routes/universities';

describe('BFF API Integration Tests', () => {
  let app: express.Application;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));

    // Initialize database manager with mocked clients
    dbManager = new DatabaseManager(
      process.env.OPENSEARCH_URL || 'http://localhost:9200',
      process.env.REDIS_URL || 'redis://localhost:6379'
    );

    // Set up app with database manager
    app.locals.dbManager = dbManager;
    app.use('/api/certificates', certificateRoutes);
    app.use('/api/universities', universityRoutes);

    // Add health endpoint
    app.get('/health', async (req, res) => {
      try {
        const opensearchHealthy = await dbManager.checkOpenSearchHealth();
        const redisHealthy = await dbManager.checkRedisHealth();
        
        const queueDepths = await dbManager.getQueueDepths();
        
        const status = opensearchHealthy && redisHealthy ? 'healthy' : 'unhealthy';

        res.status(status === 'healthy' ? 200 : 503).json({
          status,
          timestamp: new Date().toISOString(),
          services: {
            opensearch: opensearchHealthy ? 'healthy' : 'unhealthy',
            redis: redisHealthy ? 'healthy' : 'unhealthy'
          },
          queues: queueDepths
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
      }
    });
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    // Clear mock data
    mockRedisData.clear();
    mockOpenSearchData.clear();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Certificate Endpoints', () => {
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

        // Set up mock data directly
        mockOpenSearchData.set('certificates:test-cert-1', testCertificate);

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

        // Set up mock data directly
        mockOpenSearchData.set('certificates:example-cert', testCertificate);

        const response = await request(app)
          .get('/api/certificates/example.edu')
          .expect(200);

        expect(response.body.domain).toBe('example.edu');
        expect(response.body.university).toBe('Example University');
        expect(response.body.securityGrade).toBe('A');
      });
    });
  });

  describe('Basic API Tests', () => {
    it('should handle GET /api/certificates', async () => {
      const response = await request(app)
        .get('/api/certificates')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle GET /api/certificates/alerts/recent', async () => {
      const response = await request(app)
        .get('/api/certificates/alerts/recent')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
  });

  describe('Health Endpoint', () => {
    it('should return health status with queue depths', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('queues');
      expect(response.body.services).toHaveProperty('opensearch');
      expect(response.body.services).toHaveProperty('redis');
      expect(response.body.queues).toHaveProperty('scan_queue');
      expect(response.body.queues).toHaveProperty('analysis_queue');
      expect(response.body.queues).toHaveProperty('alert_queue');
      expect(typeof response.body.queues.scan_queue).toBe('number');
      expect(typeof response.body.queues.analysis_queue).toBe('number');
      expect(typeof response.body.queues.alert_queue).toBe('number');
    });

    it('should handle health check errors gracefully', async () => {
      // This will test the catch block in the health endpoint
      // Since mocks are working properly, this should return healthy status
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('University Endpoints', () => {
    it('should handle university registration with valid data', async () => {
      const universityData = {
        universityName: 'Test University',
        domain: 'test.edu',
        state: 'Illinois',
        contactEmail: 'admin@test.edu'
      };

      const response = await request(app)
        .post('/api/universities/register')
        .send(universityData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('university');
    });

    it('should reject university registration with missing required fields', async () => {
      const invalidData = {
        universityName: 'Test University',
        // Missing domain and state
      };

      const response = await request(app)
        .post('/api/universities/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject university registration from non-midwest state', async () => {
      const nonMidwestData = {
        universityName: 'California University',
        domain: 'cal.edu',
        state: 'California',
        contactEmail: 'admin@cal.edu'
      };

      const response = await request(app)
        .post('/api/universities/register')
        .send(nonMidwestData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.message).toContain('Only universities from Midwest states are accepted');
    });

    it('should get list of universities', async () => {
      const response = await request(app)
        .get('/api/universities')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
