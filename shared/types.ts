export interface University {
  id: string;
  name: string;
  domain: string;
  state: string;
  url: string;
}

export interface Certificate {
  university: string;
  domain: string;
  state: string;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  serialNumber: string;
  signatureAlgorithm: string;
  keySize: number;
  securityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'valid' | 'expiring' | 'expired' | 'invalid';
  scanTimestamp: string;
}

export interface ScanJob {
  universityId: string;
  domain: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface AnalysisJob {
  certificateId: string;
  certificate: Certificate;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'expiring' | 'expired' | 'security' | 'error';
  university: string;
  domain: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  resolved: boolean;
}

export interface DashboardStats {
  totalUniversities: number;
  validCertificates: number;
  expiringCertificates: number;
  expiredCertificates: number;
  securityDistribution: Record<string, number>;
  recentAlerts: Alert[];
}