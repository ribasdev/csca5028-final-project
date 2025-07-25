import { CertificateAnalyzer, CertificateAnalysis } from '../../src/analyzer';
import { Certificate } from '../../../shared/types';

describe('CertificateAnalyzer Unit Tests', () => {
  let analyzer: CertificateAnalyzer;

  beforeEach(() => {
    analyzer = new CertificateAnalyzer();
  });

  describe('analyzeCertificate', () => {
    it('should assign grade A for perfect certificate', () => {
      const certificate: Certificate = {
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

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.securityGrade).toBe('A');
      expect(analysis.vulnerabilities).toHaveLength(0);
      expect(analysis.riskLevel).toBe('low');
    });

    it('should detect expired certificate', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'expired.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=expired.edu',
        validFrom: '2023-01-01T00:00:00Z',
        validTo: '2024-01-01T00:00:00Z',
        daysUntilExpiry: -30,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'F',
        status: 'expired',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.securityGrade).toBe('F');
      expect(analysis.vulnerabilities).toContain('Certificate has expired');
      expect(analysis.recommendations).toContain('Renew certificate immediately');
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should detect certificate expiring within 7 days', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'expiring.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=expiring.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-01-08T00:00:00Z',
        daysUntilExpiry: 5,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'C',
        status: 'expiring',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.vulnerabilities).toContain('Certificate expires within 7 days');
      expect(analysis.recommendations).toContain('Renew certificate urgently');
      expect(analysis.riskLevel).toBe('high');
    });

    it('should detect weak signature algorithm', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'weak.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=weak.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-12-31T23:59:59Z',
        daysUntilExpiry: 365,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA1withRSA',
        keySize: 2048,
        securityGrade: 'C',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.vulnerabilities).toContain('Uses weak SHA-1 signature algorithm');
      expect(analysis.recommendations).toContain('Upgrade to SHA-2 or SHA-3');
      expect(analysis.securityGrade).toBe('C');
    });

    it('should detect weak key size', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'weakkey.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=weakkey.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-12-31T23:59:59Z',
        daysUntilExpiry: 365,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 1024,
        securityGrade: 'C',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.vulnerabilities).toContain('Weak key size: 1024 bits');
      expect(analysis.recommendations).toContain('Use at least 2048-bit keys');
      expect(analysis.securityGrade).toBe('C');
    });

    it('should detect untrusted issuer', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'selfsigned.edu',
        state: 'CO',
        issuer: 'self-signed',
        subject: 'CN=selfsigned.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-12-31T23:59:59Z',
        daysUntilExpiry: 365,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'B',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.vulnerabilities).toContain('Certificate from untrusted or unknown issuer');
      expect(analysis.recommendations).toContain('Obtain certificate from trusted Certificate Authority');
      expect(analysis.securityGrade).toBe('B');
    });

    it('should suggest 4096-bit keys for 2048-bit certificates', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'good.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=good.edu',
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

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.recommendations).toContain('Consider upgrading to 4096-bit keys for enhanced security');
      expect(analysis.securityGrade).toBe('A');
    });

    it('should handle multiple vulnerabilities correctly', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'multiple-issues.edu',
        state: 'CO',
        issuer: 'Unknown',
        subject: 'CN=multiple-issues.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-01-08T00:00:00Z',
        daysUntilExpiry: 3,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA1withRSA',
        keySize: 1024,
        securityGrade: 'F',
        status: 'expiring',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = analyzer.analyzeCertificate(certificate);

      expect(analysis.vulnerabilities).toHaveLength(4);
      expect(analysis.vulnerabilities).toContain('Certificate expires within 7 days');
      expect(analysis.vulnerabilities).toContain('Uses weak SHA-1 signature algorithm');
      expect(analysis.vulnerabilities).toContain('Weak key size: 1024 bits');
      expect(analysis.vulnerabilities).toContain('Certificate from untrusted or unknown issuer');
      expect(analysis.securityGrade).toBe('F');
      expect(analysis.riskLevel).toBe('high');
    });
  });

  describe('generateAlerts', () => {
    it('should generate expired certificate alert', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'expired.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=expired.edu',
        validFrom: '2023-01-01T00:00:00Z',
        validTo: '2024-01-01T00:00:00Z',
        daysUntilExpiry: -30,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'F',
        status: 'expired',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = {
        securityGrade: 'F',
        vulnerabilities: ['Certificate has expired'],
        recommendations: ['Renew certificate immediately'],
        riskLevel: 'critical'
      };

      const alerts = analyzer.generateAlerts(certificate, analysis);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].type).toBe('expired');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].message).toContain('has expired');
      expect(alerts[1].type).toBe('security');
    });

    it('should generate expiring certificate alert with high severity', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'expiring-soon.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=expiring-soon.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-01-08T00:00:00Z',
        daysUntilExpiry: 5,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'C',
        status: 'expiring',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = {
        securityGrade: 'C',
        vulnerabilities: ['Certificate expires within 7 days'],
        recommendations: ['Renew certificate urgently'],
        riskLevel: 'high'
      };

      const alerts = analyzer.generateAlerts(certificate, analysis);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].type).toBe('expiring');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].message).toContain('expires in 5 days');
    });

    it('should generate expiring certificate alert with medium severity', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'expiring-later.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=expiring-later.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-02-15T00:00:00Z',
        daysUntilExpiry: 20,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA256withRSA',
        keySize: 2048,
        securityGrade: 'B',
        status: 'expiring',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = {
        securityGrade: 'B',
        vulnerabilities: ['Certificate expires within 30 days'],
        recommendations: ['Schedule certificate renewal'],
        riskLevel: 'medium'
      };

      const alerts = analyzer.generateAlerts(certificate, analysis);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].type).toBe('expiring');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].message).toContain('expires in 20 days');
    });

    it('should generate security alert for vulnerabilities', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'security-issues.edu',
        state: 'CO',
        issuer: 'self-signed',
        subject: 'CN=security-issues.edu',
        validFrom: '2024-01-01T00:00:00Z',
        validTo: '2025-12-31T23:59:59Z',
        daysUntilExpiry: 365,
        serialNumber: '12345',
        signatureAlgorithm: 'SHA1withRSA',
        keySize: 1024,
        securityGrade: 'D',
        status: 'valid',
        scanTimestamp: new Date().toISOString()
      };

      const analysis: CertificateAnalysis = {
        securityGrade: 'D',
        vulnerabilities: [
          'Uses weak SHA-1 signature algorithm',
          'Weak key size: 1024 bits',
          'Certificate from untrusted or unknown issuer'
        ],
        recommendations: [
          'Upgrade to SHA-2 or SHA-3',
          'Use at least 2048-bit keys',
          'Obtain certificate from trusted Certificate Authority'
        ],
        riskLevel: 'high'
      };

      const alerts = analyzer.generateAlerts(certificate, analysis);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('security');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].message).toContain('Security issues detected');
      expect(alerts[0].message).toContain('SHA-1');
      expect(alerts[0].message).toContain('1024 bits');
      expect(alerts[0].message).toContain('untrusted');
    });

    it('should not generate alerts for valid certificates', () => {
      const certificate: Certificate = {
        university: 'Test University',
        domain: 'valid.edu',
        state: 'CO',
        issuer: 'DigiCert Inc',
        subject: 'CN=valid.edu',
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

      const analysis: CertificateAnalysis = {
        securityGrade: 'A',
        vulnerabilities: [],
        recommendations: ['Consider upgrading to 4096-bit keys for enhanced security'],
        riskLevel: 'low'
      };

      const alerts = analyzer.generateAlerts(certificate, analysis);

      expect(alerts).toHaveLength(0);
    });
  });
});
