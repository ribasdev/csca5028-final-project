import { Certificate, Alert } from '../../shared/types';
export interface CertificateAnalysis {
  securityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  vulnerabilities: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class CertificateAnalyzer {
  analyzeCertificate(certificate: Certificate): CertificateAnalysis {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (certificate.daysUntilExpiry < 0) {
      vulnerabilities.push('Certificate has expired');
      recommendations.push('Renew certificate immediately');
      score -= 50;
    } else if (certificate.daysUntilExpiry <= 7) {
      vulnerabilities.push('Certificate expires within 7 days');
      recommendations.push('Renew certificate urgently');
      score -= 30;
    } else if (certificate.daysUntilExpiry <= 30) {
      vulnerabilities.push('Certificate expires within 30 days');
      recommendations.push('Schedule certificate renewal');
      score -= 15;
    }

    if (certificate.signatureAlgorithm.includes('SHA1')) {
      vulnerabilities.push('Uses weak SHA-1 signature algorithm');
      recommendations.push('Upgrade to SHA-2 or SHA-3');
      score -= 25;
    }

    if (certificate.keySize < 2048) {
      vulnerabilities.push(`Weak key size: ${certificate.keySize} bits`);
      recommendations.push('Use at least 2048-bit keys');
      score -= 25;
    } else if (certificate.keySize < 4096) {
      recommendations.push('Consider upgrading to 4096-bit keys for enhanced security');
    }

    if (certificate.issuer === 'Unknown' || certificate.issuer.includes('self-signed')) {
      vulnerabilities.push('Certificate from untrusted or unknown issuer');
      recommendations.push('Obtain certificate from trusted Certificate Authority');
      score -= 20;
    }

    let securityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) securityGrade = 'A';
    else if (score >= 80) securityGrade = 'B';
    else if (score >= 70) securityGrade = 'C';
    else if (score >= 60) securityGrade = 'D';
    else securityGrade = 'F';

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (certificate.status === 'expired') riskLevel = 'critical';
    else if (certificate.daysUntilExpiry <= 7) riskLevel = 'high';
    else if (vulnerabilities.length > 2) riskLevel = 'high';
    else if (vulnerabilities.length > 0) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      securityGrade,
      vulnerabilities,
      recommendations,
      riskLevel
    };
  }

  generateAlerts(certificate: Certificate, analysis: CertificateAnalysis): Alert[] {
    const alerts: Alert[] = [];
    const now = new Date().toISOString();

    if (certificate.status === 'expired') {
      alerts.push({
        id: `${certificate.domain}_expired_${Date.now()}`,
        type: 'expired',
        university: certificate.university,
        domain: certificate.domain,
        message: `Certificate for ${certificate.domain} has expired`,
        severity: 'critical',
        timestamp: now,
        resolved: false
      });
    } else if (certificate.status === 'expiring') {
      alerts.push({
        id: `${certificate.domain}_expiring_${Date.now()}`,
        type: 'expiring',
        university: certificate.university,
        domain: certificate.domain,
        message: `Certificate for ${certificate.domain} expires in ${certificate.daysUntilExpiry} days`,
        severity: certificate.daysUntilExpiry <= 7 ? 'high' : 'medium',
        timestamp: now,
        resolved: false
      });
    }

    if (analysis.vulnerabilities.length > 0) {
      alerts.push({
        id: `${certificate.domain}_security_${Date.now()}`,
        type: 'security',
        university: certificate.university,
        domain: certificate.domain,
        message: `Security issues detected: ${analysis.vulnerabilities.join(', ')}`,
        severity: analysis.riskLevel === 'critical' ? 'critical' : 
                 analysis.riskLevel === 'high' ? 'high' : 'medium',
        timestamp: now,
        resolved: false
      });
    }

    return alerts;
  }
}