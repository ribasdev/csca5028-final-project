
import { Alert } from 'shared';

export class AlertProcessor {
  async processAlert(alert: Alert): Promise<void> {
    this.logAlert(alert);

    if (alert.severity === 'critical') {
      await this.sendCriticalAlert(alert);
    } else if (alert.severity === 'high') {
      await this.sendHighPriorityAlert(alert);
    } else if (alert.severity === 'medium') {
      await this.sendMediumPriorityAlert(alert);
    }

    await this.updateMetrics(alert);
  }

  private logAlert(alert: Alert): void {
    const timestamp = new Date().toISOString();
    
    if (alert.severity === 'critical') {
      if (alert.type === 'expiring') {
        console.log(`CRITICAL ALERT: Certificate expires in ${alert.message.match(/\d+/)?.[0] || 'unknown'} day`);
      } else {
        console.log(`CRITICAL: ${alert.message}`);
      }
    } else if (alert.severity === 'high') {
      if (alert.type === 'expiring') {
        console.log(`HIGH PRIORITY: Certificate expires in ${alert.message.match(/\d+/)?.[0] || 'unknown'} days`);
      } else {
        console.log(`HIGH PRIORITY: ${alert.message}`);
      }
    } else {
      console.log(`Alert for ${alert.university}: ${alert.message}`);
    }
    
    console.log(`Alert details: ${alert.university} - ${alert.domain} - ${alert.type} - ${timestamp}`);
  }

  private async sendCriticalAlert(alert: Alert): Promise<void> {
    await this.sendEmailNotification(alert, 'critical');
    await this.sendWebhookNotification(alert);
  }

  private async sendHighPriorityAlert(alert: Alert): Promise<void> {
    await this.sendEmailNotification(alert, 'high');
  }

  private async sendMediumPriorityAlert(alert: Alert): Promise<void> {
  }

  private async sendEmailNotification(alert: Alert, priority: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const emailContent = {
      to: this.getNotificationRecipients(alert.university),
      subject: `[${priority.toUpperCase()}] SSL Certificate Alert - ${alert.domain}`,
      body: `
        University: ${alert.university}
        Domain: ${alert.domain}
        Issue: ${alert.message}
        Severity: ${alert.severity}
        Time: ${alert.timestamp}
        
        Action Required: Please review and address this certificate issue.
      `
    };
    
    console.log(`Subject: [${priority.toUpperCase()}] SSL Certificate Alert - ${alert.domain}`);
    console.log(`Sending email to: ${emailContent.to}`);
    console.log(`Body: Alert for ${alert.university}: ${alert.message}`);
    console.log(`University: ${alert.university}`);
    console.log(`Domain: ${alert.domain}`);
    console.log(`Severity: ${alert.severity.toUpperCase()}`);
  }

  private getNotificationRecipients(university: string): string {
    return `it-security@${university.toLowerCase().replace(/\s+/g, '')}.edu`;
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    // Simulate webhook call delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const webhookPayload = {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      university: alert.university,
      domain: alert.domain,
      message: alert.message,
      timestamp: alert.timestamp,
      actions: {
        view_certificate: `https://ssl-monitor.example.com/certificates/${alert.domain}`,
        acknowledge: `https://ssl-monitor.example.com/alerts/${alert.id}/acknowledge`
      }
    };
    
    const webhookUrl = 'https://university-alerts.example.com/webhook';
    console.log(`Sending webhook notification`);
    console.log(`URL: ${webhookUrl}`);
    console.log(`Payload: ${JSON.stringify(webhookPayload, null, 2)}`);
  }

  private async updateMetrics(alert: Alert): Promise<void> {
    const metrics = {
      alertsProcessed: 1,
      severity: alert.severity,
      type: alert.type,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Metrics updated: ${JSON.stringify(metrics)}`);
    console.log(`Alert processing completed for ${alert.university}`);
    console.log(`Alert processed: ${alert.severity} - ${alert.type}`);
    console.log(`University: ${alert.university}`);
  }
}