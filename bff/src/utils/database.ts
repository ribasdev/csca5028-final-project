import { Client } from '@opensearch-project/opensearch';
import Redis from 'ioredis';

export class DatabaseManager {
  private opensearch: Client;
  private redis: Redis;

  constructor(opensearchUrl: string, redisUrl: string) {
    this.opensearch = new Client({
      node: opensearchUrl,
      requestTimeout: 30000,
      pingTimeout: 3000,
    });

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
  }

  get opensearchClient(): Client {
    return this.opensearch;
  }

  get redisClient(): Redis {
    return this.redis;
  }

  async initializeIndices(): Promise<void> {
    try {
      const certIndexExists = await this.opensearch.indices.exists({
        index: 'certificates'
      });

      if (!certIndexExists.body) {
        await this.opensearch.indices.create({
          index: 'certificates',
          body: {
            mappings: {
              properties: {
                university: { type: 'text', analyzer: 'standard' },
                domain: { 
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                state: { type: 'keyword' },
                issuer: { type: 'text' },
                subject: { type: 'text' },
                validFrom: { type: 'date' },
                validTo: { type: 'date' },
                daysUntilExpiry: { type: 'integer' },
                serialNumber: { type: 'keyword' },
                signatureAlgorithm: { type: 'keyword' },
                keySize: { type: 'integer' },
                securityGrade: { type: 'keyword' },
                status: { type: 'keyword' },
                scanTimestamp: { type: 'date' }
              }
            }
          }
        });
      }

      const alertIndexExists = await this.opensearch.indices.exists({
        index: 'alerts'
      });

      if (!alertIndexExists.body) {
        await this.opensearch.indices.create({
          index: 'alerts',
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                type: { type: 'keyword' },
                university: { type: 'text' },
                domain: { 
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                message: { type: 'text' },
                severity: { type: 'keyword' },
                timestamp: { type: 'date' },
                resolved: { type: 'boolean' }
              }
            }
          }
        });
      }

      const universityIndexExists = await this.opensearch.indices.exists({
        index: 'universities'
      });

      if (!universityIndexExists.body) {
        await this.opensearch.indices.create({
          index: 'universities',
          body: {
            mappings: {
              properties: {
                universityName: { type: 'text', analyzer: 'standard' },
                domain: { 
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                state: { type: 'keyword' },
                contactEmail: { type: 'keyword' },
                registeredAt: { type: 'date' },
                updatedAt: { type: 'date' },
                status: { type: 'keyword' },
                lastScanAt: { type: 'date' },
                certificateCount: { type: 'integer' }
              }
            }
          }
        });
      }

    } catch (error) {
      console.error('Error initializing indices:', error);
    }
  }

  async checkOpenSearchHealth(): Promise<boolean> {
    try {
      const response = await this.opensearch.cluster.health();
      return response.body.status === 'green' || response.body.status === 'yellow';
    } catch (error) {
      console.error('OpenSearch health check failed:', error);
      return false;
    }
  }

  async checkRedisHealth(): Promise<boolean> {
    try {
      const response = await this.redis.ping();
      return response === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  async searchCertificates(query: any): Promise<any> {
    try {
      const response = await this.opensearch.search({
        index: 'certificates',
        body: query
      });
      return response.body;
    } catch (error) {
      console.error('Error searching certificates:', error);
      throw error;
    }
  }

  async searchAlerts(query: any): Promise<any> {
    try {
      const response = await this.opensearch.search({
        index: 'alerts',
        body: query
      });
      return response.body;
    } catch (error) {
      console.error('Error searching alerts:', error);
      throw error;
    }
  }

  async indexCertificate(id: string, certificate: any): Promise<void> {
    try {
      await this.opensearch.index({
        index: 'certificates',
        id,
        body: certificate
      });
    } catch (error) {
      console.error('Error indexing certificate:', error);
      throw error;
    }
  }

  async indexAlert(id: string, alert: any): Promise<void> {
    try {
      await this.opensearch.index({
        index: 'alerts',
        id,
        body: alert
      });
    } catch (error) {
      console.error('Error indexing alert:', error);
      throw error;
    }
  }

  async pushToQueue(queueName: string, data: any): Promise<void> {
    try {
      await this.redis.lpush(queueName, JSON.stringify(data));
    } catch (error) {
      console.error(`Error pushing to queue ${queueName}:`, error);
      throw error;
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    try {
      return await this.redis.llen(queueName);
    } catch (error) {
      return 0;
    }
  }

  async getQueueDepths(): Promise<{ [key: string]: number }> {
    try {
      const [scanQueue, analysisQueue, alertQueue] = await Promise.all([
        this.redis.llen('scan_queue'),
        this.redis.llen('analysis_queue'),
        this.redis.llen('alert_queue')
      ]);

      return {
        scan_queue: scanQueue,
        analysis_queue: analysisQueue,
        alert_queue: alertQueue
      };
    } catch (error) {
      return {
        scan_queue: 0,
        analysis_queue: 0,
        alert_queue: 0
      };
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }

  async indexDocument(index: string, document: any, id?: string): Promise<any> {
    try {
      const params: any = {
        index,
        body: document
      };

      if (id) {
        params.id = id;
      }

      return await this.opensearch.index(params);
    } catch (error) {
      console.error(`Error indexing document in ${index}:`, error);
      throw error;
    }
  }

  async searchDocuments(index: string, query: any): Promise<any> {
    try {
      return await this.opensearch.search({
        index,
        body: query
      });
    } catch (error) {
      console.error(`Error searching documents in ${index}:`, error);
      throw error;
    }
  }

  async updateDocument(index: string, id: string, document: any): Promise<any> {
    try {
      return await this.opensearch.index({
        index,
        id,
        body: document
      });
    } catch (error) {
      console.error(`Error updating document in ${index}:`, error);
      throw error;
    }
  }

  async deleteDocument(index: string, id: string): Promise<any> {
    try {
      return await this.opensearch.delete({
        index,
        id
      });
    } catch (error) {
      console.error(`Error deleting document from ${index}:`, error);
      throw error;
    }
  }

  async deleteByQuery(index: string, query: any): Promise<any> {
    try {
      return await this.opensearch.deleteByQuery({
        index,
        body: query
      });
    } catch (error) {
      console.error(`Error deleting documents by query from ${index}:`, error);
      throw error;
    }
  }

  async getDocument(index: string, id: string): Promise<any> {
    try {
      return await this.opensearch.get({
        index,
        id
      });
    } catch (error) {
      console.error(`Error getting document from ${index}:`, error);
      throw error;
    }
  }
}