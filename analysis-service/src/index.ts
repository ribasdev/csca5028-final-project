import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { CertificateAnalyzer } from './analyzer';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const opensearch = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

const analyzer = new CertificateAnalyzer();

class AnalysisService {
  async start() {
    this.processAnalysisQueue();
  }

  async processAnalysisQueue() {
    while (true) {
      try {
        const job = await redis.brpop('analysis_queue', 10);
        if (job) {
          const analysisJob = JSON.parse(job[1]);
          await this.processAnalysisJob(analysisJob);
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processAnalysisJob(job: any) {
    try {
      const analysis = analyzer.analyzeCertificate(job.certificate);

      await opensearch.update({
        index: 'certificates',
        id: job.certificateId,
        body: {
          doc: {
            securityGrade: analysis.securityGrade,
            vulnerabilities: analysis.vulnerabilities,
            recommendations: analysis.recommendations,
            riskLevel: analysis.riskLevel,
            analysisTimestamp: new Date().toISOString()
          }
        }
      });

      const alerts = analyzer.generateAlerts(job.certificate, analysis);

      for (const alert of alerts) {
        await redis.lpush('alert_queue', JSON.stringify(alert));
      }

    } catch (error) {
      console.error(`Error analyzing certificate for ${job.certificate.domain}:`, error);
    }
  }
}

const service = new AnalysisService();
service.start().catch(console.error);