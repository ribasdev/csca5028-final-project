import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { Certificate } from '../../../shared/types';

describe('Analysis Service Integration Tests', () => {
  let redis: Redis;
  let opensearch: Client;

  beforeAll(async () => {
    redis = new Redis('redis://localhost:6379');
    opensearch = new Client({
      node: 'http://localhost:9200'
    });

    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  beforeEach(async () => {
    // Clear test data
    await redis.del('analysis_queue');
    
    // Create test index if it doesn't exist
    try {
      await opensearch.indices.create({
        index: 'test-certificates',
        body: {
          mappings: {
            properties: {
              university: { type: 'keyword' },
              domain: { type: 'keyword' },
              state: { type: 'keyword' },
              issuer: { type: 'text' },
              subject: { type: 'text' },
              validFrom: { type: 'date' },
              validTo: { type: 'date' },
              daysUntilExpiry: { type: 'integer' },
              securityGrade: { type: 'keyword' },
              status: { type: 'keyword' },
              vulnerabilities: { type: 'text' },
              recommendations: { type: 'text' },
              analysisTimestamp: { type: 'date' }
            }
          }
        }
      });
    } catch (error) {
      // Index might already exist
    }
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await opensearch.indices.delete({ index: 'test-certificates' });
    } catch (error) {
      // Index might not exist
    }
  });

  describe('Analysis Queue Processing', () => {
    it('should process analysis jobs from Redis queue', async () => {
      const testCertificate: Certificate = {
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

      const analysisJob = {
        certificateId: 'test-cert-1',
        certificate: testCertificate,
        timestamp: new Date().toISOString()
      };

      // Add job to queue
      await redis.lpush('analysis_queue', JSON.stringify(analysisJob));

      // Verify job was added
      const queueLength = await redis.llen('analysis_queue');
      expect(queueLength).toBe(1);

      // Process the job (simulate analysis service processing)
      const job = await redis.brpop('analysis_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        const parsedJob = JSON.parse(job[1]);
        expect(parsedJob.certificateId).toBe('test-cert-1');
        expect(parsedJob.certificate.domain).toBe('test.edu');
        expect(parsedJob.certificate.university).toBe('Test University');
      }
    });

    it('should handle multiple analysis jobs in queue', async () => {
      const jobs = [
        {
          certificateId: 'cert-1',
          certificate: {
            university: 'University 1',
            domain: 'uni1.edu',
            state: 'CO',
            issuer: 'DigiCert',
            subject: 'CN=uni1.edu',
            validFrom: '2024-01-01T00:00:00Z',
            validTo: '2025-12-31T23:59:59Z',
            daysUntilExpiry: 365,
            serialNumber: '11111',
            signatureAlgorithm: 'SHA256withRSA',
            keySize: 2048,
            securityGrade: 'A',
            status: 'valid',
            scanTimestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        },
        {
          certificateId: 'cert-2',
          certificate: {
            university: 'University 2',
            domain: 'uni2.edu',
            state: 'CA',
            issuer: 'Let\'s Encrypt',
            subject: 'CN=uni2.edu',
            validFrom: '2024-01-01T00:00:00Z',
            validTo: '2024-04-01T00:00:00Z',
            daysUntilExpiry: 5,
            serialNumber: '22222',
            signatureAlgorithm: 'SHA256withRSA',
            keySize: 2048,
            securityGrade: 'B',
            status: 'expiring',
            scanTimestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }
      ];

      // Add jobs to queue
      for (const job of jobs) {
        await redis.lpush('analysis_queue', JSON.stringify(job));
      }

      // Verify jobs were added
      const queueLength = await redis.llen('analysis_queue');
      expect(queueLength).toBe(2);

      // Process jobs
      const processedJobs = [];
      for (let i = 0; i < 2; i++) {
        const job = await redis.brpop('analysis_queue', 1);
        if (job) {
          processedJobs.push(JSON.parse(job[1]));
        }
      }

      expect(processedJobs).toHaveLength(2);
      expect(processedJobs.map(j => j.certificateId)).toEqual(expect.arrayContaining(['cert-1', 'cert-2']));
    });
  });

  describe('OpenSearch Integration', () => {
    it('should update certificate analysis in OpenSearch', async () => {
      const certificateId = 'opensearch-test-cert-1';
      const testCertificate: Certificate = {
        university: 'OpenSearch University',
        domain: 'opensearch.edu',
        state: 'WA',
        issuer: 'DigiCert Inc',
        subject: 'CN=opensearch.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-12-31T23:59:59Z',
        daysUntilExpiry: 365,
        serialNumber: '54321',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'A',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      // First index the certificate
      await opensearch.index({
        index: 'test-certificates',
        id: certificateId,
        body: testCertificate
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update with analysis results (simulate analysis service update)
      await opensearch.update({
        index: 'test-certificates',
        id: certificateId,
        body: {
          doc: {
            securityGrade: 'A',
            vulnerabilities: [],
            recommendations: ['Monitor certificate expiry'],
            analysisTimestamp: new Date().toISOString()
          }
        }
      });

      // Wait for update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the update
      const response = await opensearch.get({
        index: 'test-certificates',
        id: certificateId
      });

      const updatedCert = response.body._source;
      expect(updatedCert.securityGrade).toBe('A');
      expect(updatedCert.vulnerabilities).toEqual([]);
      expect(updatedCert.recommendations).toContain('Monitor certificate expiry');
      expect(updatedCert.analysisTimestamp).toBeDefined();
    });

    it('should handle certificate with vulnerabilities', async () => {
      const certificateId = 'vulnerable-cert-1';
      const vulnerableCertificate: Certificate = {
        university: 'Vulnerable University',
        domain: 'vulnerable.edu',
        state: 'TX',
        issuer: 'Unknown CA',
        subject: 'CN=vulnerable.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2024-02-01T00:00:00Z',
        daysUntilExpiry: 5,
        serialNumber: '99999',
        signatureAlgorithm: 'SHA1withRSA',
        keySize: 1024,
        securityGrade: 'F',
        status: 'expiring',
        scanTimestamp: new Date().toISOString()
      };

      // Index the vulnerable certificate
      await opensearch.index({
        index: 'test-certificates',
        id: certificateId,
        body: vulnerableCertificate
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update with vulnerability analysis
      await opensearch.update({
        index: 'test-certificates',
        id: certificateId,
        body: {
          doc: {
            securityGrade: 'F',
            vulnerabilities: [
              'Certificate expires within 7 days',
              'Uses weak SHA-1 signature algorithm',
              'Uses weak 1024-bit key',
              'Unknown or untrusted CA'
            ],
            recommendations: [
              'Renew certificate urgently',
              'Upgrade to SHA-256 signature algorithm',
              'Use 2048-bit or higher key size',
              'Switch to trusted CA'
            ],
            analysisTimestamp: new Date().toISOString()
          }
        }
      });

      // Wait for update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the analysis
      const response = await opensearch.get({
        index: 'test-certificates',
        id: certificateId
      });

      const analyzedCert = response.body._source;
      expect(analyzedCert.securityGrade).toBe('F');
      expect(analyzedCert.vulnerabilities).toHaveLength(4);
      expect(analyzedCert.vulnerabilities).toContain('Uses weak SHA-1 signature algorithm');
      expect(analyzedCert.recommendations).toContain('Renew certificate urgently');
    });
  });

  describe('Alert Generation', () => {
    it('should generate alerts for critical certificates', async () => {
      const criticalCertificate: Certificate = {
        university: 'Critical University',
        domain: 'critical.edu',
        state: 'NY',
        issuer: 'DigiCert Inc',
        subject: 'CN=critical.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2024-01-02T00:00:00Z',
        daysUntilExpiry: -10,
        serialNumber: '88888',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'F',
        status: 'expired',
        scanTimestamp: new Date().toISOString()
      };

      const analysisJob = {
        certificateId: 'critical-cert-1',
        certificate: criticalCertificate,
        timestamp: new Date().toISOString()
      };

      // Add to analysis queue
      await redis.lpush('analysis_queue', JSON.stringify(analysisJob));

      // Process and generate alerts (simulate)
      const job = await redis.brpop('analysis_queue', 1);
      if (job) {
        // Simulate alert generation by adding to alert queue
        const alert = {
          id: `alert-${Date.now()}`,
          type: 'expired',
          university: criticalCertificate.university,
          domain: criticalCertificate.domain,
          message: 'Certificate has expired',
          severity: 'critical',
          timestamp: new Date().toISOString(),
          resolved: false
        };

        await redis.lpush('alert_queue', JSON.stringify(alert));
      }

      // Verify alert was generated
      const alertQueueLength = await redis.llen('alert_queue');
      expect(alertQueueLength).toBe(1);

      const generatedAlert = await redis.brpop('alert_queue', 1);
      expect(generatedAlert).not.toBeNull();
      
      if (generatedAlert) {
        const alert = JSON.parse(generatedAlert[1]);
        expect(alert.type).toBe('expired');
        expect(alert.severity).toBe('critical');
        expect(alert.university).toBe('Critical University');
        expect(alert.domain).toBe('critical.edu');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed analysis job data', async () => {
      const malformedJob = '{"invalid": "json", "missing": "required_fields"}';
      
      await redis.lpush('analysis_queue', malformedJob);
      
      const job = await redis.brpop('analysis_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        expect(() => {
          const parsed = JSON.parse(job[1]);
          expect(parsed.certificateId).toBeUndefined();
          expect(parsed.certificate).toBeUndefined();
        }).not.toThrow();
      }
    });

    it('should handle OpenSearch connection errors gracefully', async () => {
      const invalidClient = new Client({ node: 'http://invalid:9999' });
      
      await expect(
        invalidClient.index({
          index: 'test-certificates',
          id: 'error-test-1',
          body: { test: 'data' }
        })
      ).rejects.toThrow();
    });
  });
});
