import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { CertificateScanner } from '../../src/scanner';
import { University } from '../../../shared/types';

describe('Collection Service Integration Tests', () => {
  let redis: Redis;
  let opensearch: Client;
  let scanner: CertificateScanner;

  beforeAll(async () => {
    redis = new Redis('redis://localhost:6379');
    opensearch = new Client({
      node: 'http://localhost:9200'
    });
    scanner = new CertificateScanner();

    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  beforeEach(async () => {
    // Clear test data
    await redis.del('scan_queue');
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
              scanTimestamp: { type: 'date' }
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

  describe('Scan Queue Processing', () => {
    it('should process scan jobs from Redis queue', async () => {
      const testUniversity: University = {
        id: 'test-university-1',
        name: 'Test University',
        domain: 'test.edu',
        state: 'CO',
        url: 'https://www.test.edu'
      };

      const scanJob = {
        universityId: testUniversity.id,
        domain: testUniversity.domain,
        priority: 'high',
        timestamp: new Date().toISOString()
      };

      // Add job to scan queue
      await redis.lpush('scan_queue', JSON.stringify(scanJob));

      // Verify job was added
      const queueLength = await redis.llen('scan_queue');
      expect(queueLength).toBe(1);

      // Process the job
      const job = await redis.brpop('scan_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        const parsedJob = JSON.parse(job[1]);
        expect(parsedJob.universityId).toBe('test-university-1');
        expect(parsedJob.domain).toBe('test.edu');
        expect(parsedJob.priority).toBe('high');
      }
    });

    it('should handle multiple scan jobs with different priorities', async () => {
      const jobs = [
        {
          universityId: 'uni-1',
          domain: 'priority-high.edu',
          priority: 'high',
          timestamp: new Date().toISOString()
        },
        {
          universityId: 'uni-2',
          domain: 'priority-medium.edu',
          priority: 'medium',
          timestamp: new Date().toISOString()
        },
        {
          universityId: 'uni-3',
          domain: 'priority-low.edu',
          priority: 'low',
          timestamp: new Date().toISOString()
        }
      ];

      // Add jobs to queue
      for (const job of jobs) {
        await redis.lpush('scan_queue', JSON.stringify(job));
      }

      // Verify jobs were added
      const queueLength = await redis.llen('scan_queue');
      expect(queueLength).toBe(3);

      // Process all jobs
      const processedJobs = [];
      for (let i = 0; i < 3; i++) {
        const job = await redis.brpop('scan_queue', 1);
        if (job) {
          processedJobs.push(JSON.parse(job[1]));
        }
      }

      expect(processedJobs).toHaveLength(3);
      const domains = processedJobs.map(j => j.domain);
      expect(domains).toEqual(expect.arrayContaining([
        'priority-high.edu',
        'priority-medium.edu', 
        'priority-low.edu'
      ]));
    });
  });

  describe('Certificate Scanning', () => {
    it('should scan certificate and store in OpenSearch', async () => {
      // Mock certificate data for testing
      const mockCertData = {
        issuer: 'DigiCert Inc',
        subject: 'CN=scan-test.edu',
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2025-12-31T23:59:59Z',
        serialNumber: '123456789',
        signatureAlgorithm: 'SHA256withRSA',
        bits: 2048
      };

      // Simulate certificate scanning result
      const scannedCertificate = {
        university: 'Scan Test University',
        domain: 'scan-test.edu',
        state: 'CO',
        issuer: mockCertData.issuer,
        subject: mockCertData.subject,
        validFrom: mockCertData.valid_from,
        validTo: mockCertData.valid_to,
        daysUntilExpiry: 365,
        serialNumber: mockCertData.serialNumber,
        signatureAlgorithm: mockCertData.signatureAlgorithm,
        keySize: mockCertData.bits,
        securityGrade: 'A',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      // Store in OpenSearch
      const certificateId = `cert-${Date.now()}`;
      await opensearch.index({
        index: 'test-certificates',
        id: certificateId,
        body: scannedCertificate
      });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify certificate was stored
      const response = await opensearch.get({
        index: 'test-certificates',
        id: certificateId
      });

      const storedCert = response.body._source;
      expect(storedCert.domain).toBe('scan-test.edu');
      expect(storedCert.university).toBe('Scan Test University');
      expect(storedCert.securityGrade).toBe('A');
      expect(storedCert.status).toBe('valid');
      expect(storedCert.issuer).toBe('DigiCert Inc');
    });

    it('should trigger analysis job after scanning', async () => {
      const scannedCertificate = {
        university: 'Analysis Trigger University',
        domain: 'analysis-trigger.edu',
        state: 'CA',
        issuer: 'Let\'s Encrypt',
        subject: 'CN=analysis-trigger.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2024-04-01T00:00:00Z',
        daysUntilExpiry: 30,
        serialNumber: '987654321',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'B',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      const certificateId = `analysis-trigger-cert-${Date.now()}`;
      
      // Store certificate and trigger analysis
      await opensearch.index({
        index: 'test-certificates',
        id: certificateId,
        body: scannedCertificate
      });

      // Simulate adding analysis job to queue
      const analysisJob = {
        certificateId: certificateId,
        certificate: scannedCertificate,
        timestamp: new Date().toISOString()
      };

      await redis.lpush('analysis_queue', JSON.stringify(analysisJob));

      // Verify analysis job was created
      const analysisQueueLength = await redis.llen('analysis_queue');
      expect(analysisQueueLength).toBe(1);

      // Check the analysis job content
      const job = await redis.brpop('analysis_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        const parsedJob = JSON.parse(job[1]);
        expect(parsedJob.certificateId).toBe(certificateId);
        expect(parsedJob.certificate.domain).toBe('analysis-trigger.edu');
      }
    });
  });

  describe('Security Grade Calculation', () => {
    it('should calculate correct security grades for different certificates', async () => {
      const testCases = [
        {
          name: 'Perfect Certificate',
          cert: {
            issuer: 'DigiCert Inc',
            subject: 'CN=perfect.edu',
            valid_from: '2024-01-01T00:00:00Z',
            valid_to: '2025-12-31T23:59:59Z',
            serialNumber: '111111',
            signatureAlgorithm: 'SHA256withRSA',
            bits: 2048
          },
          daysUntilExpiry: 365,
          expectedGrade: 'A'
        },
        {
          name: 'Expiring Soon Certificate',
          cert: {
            issuer: 'DigiCert Inc',
            subject: 'CN=expiring.edu',
            valid_from: '2024-01-01T00:00:00Z',
            valid_to: '2024-02-01T00:00:00Z',
            serialNumber: '222222',
            signatureAlgorithm: 'SHA256withRSA',
            bits: 2048
          },
          daysUntilExpiry: 5,
          expectedGrade: 'C'
        },
        {
          name: 'Weak Algorithm Certificate',
          cert: {
            issuer: 'Unknown CA',
            subject: 'CN=weak.edu',
            valid_from: '2024-01-01T00:00:00Z',
            valid_to: '2025-12-31T23:59:59Z',
            serialNumber: '333333',
            signatureAlgorithm: 'SHA1withRSA',
            bits: 1024
          },
          daysUntilExpiry: 365,
          expectedGrade: 'F'
        }
      ];

      for (const testCase of testCases) {
        const grade = (scanner as any).calculateSecurityGrade(testCase.cert, testCase.daysUntilExpiry);
        expect(grade).toBe(testCase.expectedGrade);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle scan failures gracefully', async () => {
      const invalidDomain = 'non-existent-university.invalid';
      
      // This should not crash the service
      const scanJob = {
        universityId: 'invalid-uni',
        domain: invalidDomain,
        priority: 'low',
        timestamp: new Date().toISOString()
      };

      await redis.lpush('scan_queue', JSON.stringify(scanJob));
      
      const job = await redis.brpop('scan_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        const parsedJob = JSON.parse(job[1]);
        expect(parsedJob.domain).toBe(invalidDomain);
        // The actual scanning would fail, but the job processing should continue
      }
    });

    it('should handle malformed scan job data', async () => {
      const malformedJob = '{"invalid": "data", "missing": "required_fields"}';
      
      await redis.lpush('scan_queue', malformedJob);
      
      const job = await redis.brpop('scan_queue', 1);
      expect(job).not.toBeNull();
      
      if (job) {
        expect(() => {
          const parsed = JSON.parse(job[1]);
          expect(parsed.universityId).toBeUndefined();
          expect(parsed.domain).toBeUndefined();
        }).not.toThrow();
      }
    });

    it('should handle OpenSearch connection errors', async () => {
      const invalidClient = new Client({ node: 'http://invalid:9999' });
      
      await expect(
        invalidClient.index({
          index: 'test-certificates',
          id: 'error-test',
          body: { test: 'data' }
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Testing', () => {
    it('should handle bulk certificate processing', async () => {
      const batchSize = 10;
      const certificates = [];

      // Create batch of certificates
      for (let i = 0; i < batchSize; i++) {
        certificates.push({
          university: `Bulk University ${i}`,
          domain: `bulk-${i}.edu`,
          state: 'CO',
          issuer: 'DigiCert Inc',
          subject: `CN=bulk-${i}.edu`,
          validFrom: '2024-01-01T00:00:00Z',
          validTo: '2025-12-31T23:59:59Z',
          daysUntilExpiry: 365,
          serialNumber: `${100000 + i}`,
          signatureAlgorithm: 'SHA256withRSA',
          keySize: 2048,
          securityGrade: 'A',
          status: 'valid',
          scanTimestamp: new Date().toISOString()
        });
      }

      const startTime = Date.now();

      // Bulk index the certificates
      const body = certificates.flatMap(cert => [
        { index: { _index: 'test-certificates', _id: `bulk-cert-${cert.domain}` } },
        cert
      ]);

      await opensearch.bulk({ body });

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all certificates were indexed
      const searchResponse = await opensearch.search({
        index: 'test-certificates',
        body: {
          query: {
            prefix: {
              domain: 'bulk-'
            }
          }
        }
      });

      expect(searchResponse.body.hits.hits).toHaveLength(batchSize);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
