import Redis from 'ioredis';
import { Client } from '@opensearch-project/opensearch';
import { AlertProcessor } from './alerter';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const opensearch = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

const alertProcessor = new AlertProcessor();

class AlertService {
  async start() {
    this.processAlertQueue();
  }

  async processAlertQueue() {
    while (true) {
      try {
        const job = await redis.brpop('alert_queue', 10);
        if (job) {
          const alert = JSON.parse(job[1]);
          await this.processAlert(alert);
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processAlert(alert: any) {
    try {
      
      await opensearch.index({
        index: 'alerts',
        id: alert.id,
        body: {
          ...alert,
          processedTimestamp: new Date().toISOString()
        }
      });

      await alertProcessor.processAlert(alert);
      
      await this.updateAlertMetrics(alert);
      
    } catch (error) {
    }
  }

  async updateAlertMetrics(alert: any) {
    try {
      const metrics = {
        alertType: alert.type,
        severity: alert.severity,
        university: alert.university,
        domain: alert.domain,
        timestamp: new Date().toISOString()
      };

      await opensearch.index({
        index: 'alert-metrics',
        body: metrics
      });

    } catch (error) {
    }
  }
}

const service = new AlertService();
service.start();