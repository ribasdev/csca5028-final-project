import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { CertificateScanner } from './scanner';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const opensearch = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

const scanner = new CertificateScanner();

class CollectionService {
  private universities: any[] = [];
  private lastCacheUpdate: number = 0;

  async loadUniversities() {
    try {
      const response = await opensearch.search({
        index: 'universities',
        body: {
          query: { match_all: {} },
          size: 1000
        }
      });

      this.universities = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        name: hit._source.universityName,
        domain: hit._source.domain,
        state: hit._source.state,
        url: `https://${hit._source.domain}`
      }));
      
      this.lastCacheUpdate = Date.now();
      
      return this.universities;
    } catch (error) {
      return this.universities;
    }
  }

  async getUniversitiesFromDatabase() {
    // Use cached data if recent (within 5 minutes)
    const now = Date.now();
    if (now - this.lastCacheUpdate < 5 * 60 * 1000 && this.universities.length > 0) {
      return this.universities;
    }
    
    return await this.loadUniversities();
  }

  async start() {
    await this.loadUniversities();
    
    setInterval(async () => {
      await this.loadUniversities();
    }, 60 * 60 * 1000); // Every hour
    
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
        const certificateId = `${job.domain}_${Date.now()}`;
        await opensearch.index({
          index: 'certificates',
          id: certificateId,
          body: certificate
        });

        await this.updateLastScanDate(job.domain);

        await redis.lpush('analysis_queue', JSON.stringify({
          certificateId,
          certificate,
          timestamp: new Date().toISOString()
        }));

      }
    } catch (error) {
    }
  }

  async updateLastScanDate(domain: string) {
    try {
      const university = this.universities.find(u => u.domain === domain);
      if (university) {
        await opensearch.update({
          index: 'universities',
          id: university.id,
          body: {
            doc: {
              lastScanDate: new Date().toISOString()
            }
          }
        });
      }
    } catch (error) {
    }
  }

  async schedulePeriodicScans() {
    
    setInterval(async () => {
      await this.queueUniversityScans();
    }, 24 * 60 * 60 * 1000);

    await this.queueUniversityScans();
  }

  async queueUniversityScans() {
    
    const universities = await this.getUniversitiesFromDatabase();
    
    const highPriorityUniversities = universities.filter((u: any) => u.priority === 'high');
    for (const university of highPriorityUniversities) {
      await this.queueScanJob(university, 'high');
    }
    
    const mediumPriorityUniversities = universities.filter((u: any) => u.priority === 'medium' || !u.priority);
    for (const university of mediumPriorityUniversities) {
      await this.queueScanJob(university, 'medium');
    }
    
    const lowPriorityUniversities = universities.filter((u: any) => u.priority === 'low');
    for (const university of lowPriorityUniversities) {
      await this.queueScanJob(university, 'low');
    }
    
  }

  async queueScanJob(university: any, priority: string = 'medium') {
    await redis.lpush('scan_queue', JSON.stringify({
      universityId: university.id,
      domain: university.domain,
      priority,
      timestamp: new Date().toISOString()
    }));
  }
}

const service = new CollectionService();
service.start();