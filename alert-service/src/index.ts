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
    console.log('Alert Service started');
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
        console.error('Error processing alert queue:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processAlert(alert: any) {
    try {
      console.log(`Processing alert: ${alert.type} for ${alert.domain}`);
      
      await opensearch.index({
        index: 'alerts',
        id: alert.id,
        body: alert
      });

      await alertProcessor.processAlert(alert);
      
      console.log(`Alert processed: ${alert.id}`);
    } catch (error) {
      console.error(`Error processing alert ${alert.id}:`, error);
    }
  }
}

const service = new AlertService();
service.start().catch(console.error);