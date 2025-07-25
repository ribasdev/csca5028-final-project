import { CertificateScanner } from '../../src/scanner';

describe('CertificateScanner Unit Tests', () => {
  let scanner: CertificateScanner;

  beforeEach(() => {
    scanner = new CertificateScanner();
  });

  describe('Security Grade Calculation', () => {
    it('should assign grade A for secure certificate', () => {
      const mockCert = {
        issuer: 'DigiCert Inc',
        subject: 'CN=test.edu',
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2025-12-31T23:59:59Z',
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        bits: 2048
      };

      const daysUntilExpiry = 365;
      const grade = (scanner as any).calculateSecurityGrade(mockCert, daysUntilExpiry);

      expect(grade).toBe('A');
    });

    it('should assign grade F for expired certificate', () => {
      const mockCert = {
        issuer: 'DigiCert Inc',
        subject: 'CN=expired.edu',
        valid_from: '2023-01-01T00:00:00Z',
        valid_to: '2024-01-01T00:00:00Z',
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        bits: 2048
      };

      const daysUntilExpiry = -30;
      const grade = (scanner as any).calculateSecurityGrade(mockCert, daysUntilExpiry);

      expect(grade).toBe('F');
    });

    it('should deduct points for weak signature algorithm', () => {
      const mockCert = {
        issuer: 'DigiCert Inc',
        subject: 'CN=weak.edu',
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2025-12-31T23:59:59Z',
        serialNumber: '12345',
        signatureAlgorithm: 'SHA1withRSA',
        bits: 2048
      };

      const daysUntilExpiry = 365;
      const grade = (scanner as any).calculateSecurityGrade(mockCert, daysUntilExpiry);

      expect(grade).toBe('C');
    });

    it('should deduct points for small key size', () => {
      const mockCert = {
        issuer: 'DigiCert Inc',
        subject: 'CN=smallkey.edu',
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2025-12-31T23:59:59Z',
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        bits: 1024
      };

      const daysUntilExpiry = 365;
      const grade = (scanner as any).calculateSecurityGrade(mockCert, daysUntilExpiry);

      expect(grade).toBe('C');
    });

    it('should assign appropriate grades for different score ranges', () => {
      const testCases = [
        { score: 95, expectedGrade: 'A' },
        { score: 85, expectedGrade: 'B' },
        { score: 75, expectedGrade: 'C' },
        { score: 65, expectedGrade: 'D' },
        { score: 45, expectedGrade: 'F' }
      ];

      testCases.forEach(({ score, expectedGrade }) => {
        const mockCert = {
          issuer: 'DigiCert Inc',
          subject: `CN=test${score}.edu`,
          valid_from: '2024-01-01T00:00:00Z',
          valid_to: '2025-12-31T23:59:59Z',
          serialNumber: '12345',
          signatureAlgorithm: score < 75 ? 'SHA1withRSA' : 'SHA256withRSA',
          bits: score < 70 ? 1024 : 2048
        };

        const daysUntilExpiry = score < 55 ? -10 : 365;
        const grade = (scanner as any).calculateSecurityGrade(mockCert, daysUntilExpiry);

        expect(grade).toBe(expectedGrade);
      });
    });
  });

  describe('Key Size Detection', () => {
    it('should return correct key size from certificate', () => {
      const mockCert = { bits: 4096 };
      const keySize = (scanner as any).getKeySize(mockCert);
      expect(keySize).toBe(4096);
    });

    it('should return default 2048 when bits not available', () => {
      const mockCert = {};
      const keySize = (scanner as any).getKeySize(mockCert);
      expect(keySize).toBe(2048);
    });
  });

  describe('Status Determination', () => {
    it('should return expired for negative days', () => {
      const status = (scanner as any).getStatus(-5);
      expect(status).toBe('expired');
    });

    it('should return expiring for 0-30 days', () => {
      expect((scanner as any).getStatus(0)).toBe('expiring');
      expect((scanner as any).getStatus(15)).toBe('expiring');
      expect((scanner as any).getStatus(30)).toBe('expiring');
    });

    it('should return valid for more than 30 days', () => {
      const status = (scanner as any).getStatus(45);
      expect(status).toBe('valid');
    });
  });

  describe('Days Until Expiry Calculation', () => {
    it('should calculate correct days until expiry', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const days = (scanner as any).getDaysUntilExpiry(futureDate.toISOString());
      expect(days).toBeCloseTo(30, 0);
    });

    it('should return negative days for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const days = (scanner as any).getDaysUntilExpiry(pastDate.toISOString());
      expect(days).toBeCloseTo(-10, 0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid domain gracefully', async () => {
      const result = await scanner.scanDomain('invalid.domain.that.does.not.exist');
      expect(result).toBeNull();
    }, 10000);

    it('should handle connection timeout gracefully', async () => {
      const result = await scanner.scanDomain('10.255.255.1');
      expect(result).toBeNull();
    }, 15000);

    it('should handle non-HTTPS domains gracefully', async () => {
      const result = await scanner.scanDomain('http-only-site.example');
      expect(result).toBeNull();
    }, 10000);
  });

  describe('Certificate Processing', () => {
    it('should process certificate data correctly', () => {
      const mockCert = {
        issuer: { CN: 'DigiCert Inc' },
        subject: { CN: 'test.edu' },
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2025-12-31T23:59:59Z',
        serialNumber: '123456789',
        signatureAlgorithm: 'sha256WithRSAEncryption',
        bits: 2048
      };

      const university = 'Test University';
      const domain = 'test.edu';
      const state = 'Colorado';

      const processedCert = (scanner as any).processCertificate(mockCert, university, domain, state);

      expect(processedCert.university).toBe(university);
      expect(processedCert.domain).toBe(domain);
      expect(processedCert.state).toBe(state);
      expect(processedCert.issuer).toBe('DigiCert Inc');
      expect(processedCert.subject).toBe('CN=test.edu');
      expect(processedCert.keySize).toBe(2048);
      expect(processedCert.serialNumber).toBe('123456789');
    });

    it('should handle missing certificate fields', () => {
      const mockCert = {
        issuer: {},
        subject: {},
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2025-12-31T23:59:59Z'
      };

      const processedCert = (scanner as any).processCertificate(mockCert, 'Test Uni', 'test.edu', 'CO');

      expect(processedCert.issuer).toBe('Unknown');
      expect(processedCert.subject).toBe('Unknown');
      expect(processedCert.serialNumber).toBe('Unknown');
      expect(processedCert.keySize).toBe(2048);
    });
  });
});
