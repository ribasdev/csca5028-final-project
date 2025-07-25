import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { CertificateScanner } from './scanner';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const opensearch = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

const scanner = new CertificateScanner();

class CollectionService {
  async getUniversitiesFromDatabase() {
    try {
      const response = await opensearch.search({
        index: 'universities',
        body: {
          query: { match_all: {} },
          size: 1000
        }
      });

      return response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        name: hit._source.universityName,
        domain: hit._source.domain,
        state: hit._source.state,
        url: `https://${hit._source.domain}`
      }));
    } catch (error) {
      console.error('Error fetching universities from database:', error);
      return [];
    }
  }

  async start() {

    this.processScanQueue();

    this.schedulePeriodicScans();
  }

  async processScanQueue() {
    while (true) {
      try {
        const job = await redis.brpop('scan_queue', 10);
        if (job) {
          const scanJob = JSON.parse(job[1]);
          await this.processScanJob(scanJob);
        }
      } catch (error) {
        console.error('Error processing scan queue:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processScanJob(job: any) {
    try {

      const certificate = await scanner.scanDomain(job.domain);

      if (certificate) {
        await opensearch.index({
          index: 'certificates',
          id: `${job.domain}_${Date.now()}`,
          body: certificate
        });

        await redis.lpush('analysis_queue', JSON.stringify({
          certificateId: `${job.domain}_${Date.now()}`,
          certificate,
          timestamp: new Date().toISOString()
        }));

      }
    } catch (error) {
      console.error(`Error scanning ${job.domain}:`, error);
    }
  }

  async schedulePeriodicScans() {
    setInterval(async () => {
      const universities = await this.getUniversitiesFromDatabase();
      for (const university of universities) {
        await redis.lpush('scan_queue', JSON.stringify({
          universityId: university.id,
          domain: university.domain,
          priority: 'medium',
          timestamp: new Date().toISOString()
        }));
      }
    }, 24 * 60 * 60 * 1000);

    const universities = await this.getUniversitiesFromDatabase();
    for (const university of universities) {
      await redis.lpush('scan_queue', JSON.stringify({
        universityId: university.id,
        domain: university.domain,
        priority: 'high',
        timestamp: new Date().toISOString()
      }));
    }
  }
}

const service = new CollectionService();
service.start().catch(console.error);