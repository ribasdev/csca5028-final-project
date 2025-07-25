
import { Alert } from 'shared';

export class AlertProcessor {
  async processAlert(alert: Alert): Promise<void> {
    this.logAlert(alert);

    if (alert.severity === 'critical') {
      await this.sendCriticalAlert(alert);
    } else if (alert.severity === 'high') {
      await this.sendHighPriorityAlert(alert);
    }

    await this.updateMetrics(alert);
  }

  private logAlert(alert: Alert): void {
    const timestamp = new Date().toISOString();
    
    if (alert.severity === 'critical' && alert.type === 'expired') {
      console.log(`CRITICAL: Certificate has expired - ${alert.university} (${alert.domain})`);
    } else if (alert.severity === 'critical') {
      console.log(`CRITICAL ALERT: Certificate expires in 1 day - ${alert.university} (${alert.domain})`);
    } else if (alert.severity === 'high') {
      console.log(`HIGH PRIORITY: Certificate expires in 7 days - ${alert.university} (${alert.domain})`);
    } else {
      console.log(`Alert for ${alert.university}: ${alert.message}`);
    }
    
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   University: ${alert.university}`);
    console.log(`   Domain: ${alert.domain}`);
    console.log(`   Severity: ${alert.severity.toUpperCase()}`);
  }

  private async sendCriticalAlert(alert: Alert): Promise<void> {

    await this.sendEmailNotification(alert, 'critical');

    await this.sendWebhookNotification(alert);
  }

  private async sendHighPriorityAlert(alert: Alert): Promise<void> {

    await this.sendEmailNotification(alert, 'high');
  }

  private async sendEmailNotification(alert: Alert, priority: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const subject = `[${priority.toUpperCase()}] SSL Certificate Alert - ${alert.domain}`;
    const body = `Alert for ${alert.university}: ${alert.message}`;
    
    console.log(`Sending email notification:`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log(`To: admin@${alert.domain}`);
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const webhookUrl = 'https://university-alerts.example.com/webhook';
    const payload = {
      alert: alert,
      timestamp: new Date().toISOString(),
      environment: 'production'
    };
    
    console.log(`Sending webhook notification:`);
    console.log(`URL: ${webhookUrl}`);
    console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
  }

  private async updateMetrics(alert: Alert): Promise<void> {
    const metrics = {
      alertsProcessed: 1,
      severity: alert.severity,
      type: alert.type,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Metrics updated:`);
    console.log(`Alert processed: ${alert.severity} - ${alert.type}`);
    console.log(`University: ${alert.university}`);
    console.log(`Timestamp: ${metrics.timestamp}`);
  }
}