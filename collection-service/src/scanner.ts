import * as tls from 'tls';
import { Client } from '@opensearch-project/opensearch';
import { Certificate } from '../../shared/types';

const opensearch = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

export class CertificateScanner {
  private universityCache: any[] = [];
  private lastCacheUpdate: number = 0;

  async getUniversitiesFromDatabase() {
    const now = Date.now();
    if (now - this.lastCacheUpdate < 5 * 60 * 1000 && this.universityCache.length > 0) {
      return this.universityCache;
    }

    try {
      const response = await opensearch.search({
        index: 'universities',
        body: {
          query: { match_all: {} },
          size: 1000
        }
      });

      this.universityCache = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        name: hit._source.universityName,
        domain: hit._source.domain,
        state: hit._source.state
      }));
      this.lastCacheUpdate = now;

      return this.universityCache;
    } catch (error) {
      console.error('Error fetching universities from database:', error);
      return this.universityCache;
    }
  }

  async scanDomain(domain: string): Promise<Certificate | null> {
    try {
      const socket = tls.connect(443, domain, {
        servername: domain,
        rejectUnauthorized: false
      });

      return new Promise((resolve, reject) => {
        socket.on('secureConnect', async () => {
          try {
            const cert = socket.getPeerCertificate();
            const certificate = await this.parseCertificate(cert, domain);
            socket.end();
            resolve(certificate);
          } catch (error) {
            socket.end();
            reject(error);
          }
        });

        socket.on('error', (error) => {
          socket.end();
          reject(error);
        });

        setTimeout(() => {
          socket.end();
          reject(new Error('Connection timeout'));
        }, 10000);
      });
    } catch (error) {
      console.error(`Failed to scan ${domain}:`, error);
      return null;
    }
  }

  private async parseCertificate(cert: any, domain: string): Promise<Certificate> {
    const now = new Date();
    const validTo = new Date(cert.valid_to);
    const validFrom = new Date(cert.valid_from);
    const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'valid' | 'expiring' | 'expired' | 'invalid' = 'valid';
    if (daysUntilExpiry < 0) status = 'expired';
    else if (daysUntilExpiry <= 30) status = 'expiring';

    return {
      university: await this.getUniversityName(domain),
      domain,
      state: await this.getState(domain),
      issuer: cert.issuer?.CN || 'Unknown',
      subject: cert.subject?.CN || domain,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      daysUntilExpiry,
      serialNumber: cert.serialNumber || '',
      signatureAlgorithm: cert.signatureAlgorithm || 'Unknown',
      keySize: this.getKeySize(cert),
      securityGrade: this.calculateSecurityGrade(cert, daysUntilExpiry),
      status,
      scanTimestamp: new Date().toISOString()
    };
  }

  private async getUniversityName(domain: string): Promise<string> {
    const universities = await this.getUniversitiesFromDatabase();
    const university = universities.find((u: any) => u.domain === domain);
    return university?.name || domain;
  }

  private async getState(domain: string): Promise<string> {
    const universities = await this.getUniversitiesFromDatabase();
    const university = universities.find((u: any) => u.domain === domain);
    return university?.state || 'Unknown';
  }

  private getKeySize(cert: any): number {
    return cert.bits || 2048;
  }

  private calculateSecurityGrade(cert: any, daysUntilExpiry: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 100;

    if (daysUntilExpiry < 0) score -= 50;
    else if (daysUntilExpiry <= 7) score -= 30;
    else if (daysUntilExpiry <= 30) score -= 15;

    if (cert.signatureAlgorithm?.includes('SHA1')) score -= 20;

    const keySize = this.getKeySize(cert);
    if (keySize < 2048) score -= 25;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}