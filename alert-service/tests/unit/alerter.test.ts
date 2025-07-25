import { AlertProcessor } from '../../src/alerter';
import { Alert } from 'shared';

describe('AlertProcessor Unit Tests', () => {
  let alertProcessor: AlertProcessor;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    alertProcessor = new AlertProcessor();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('processAlert', () => {
    it('should process critical alert', async () => {
      const alert: Alert = {
        id: 'test-alert-1',
        type: 'expiring',
        severity: 'critical',
        message: 'Certificate expires in 1 day',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL ALERT: Certificate expires in 1 day')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📧 Email sent to IT team for Test University')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔗 Webhook notification sent')
      );
    });

    it('should process high priority alert', async () => {
      const alert: Alert = {
        id: 'test-alert-2',
        type: 'expiring',
        severity: 'high',
        message: 'Certificate expires in 7 days',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  HIGH PRIORITY: Certificate expires in 7 days')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📧 Email sent to IT team for Test University')
      );
    });

    it('should process medium priority alert without notifications', async () => {
      const alert: Alert = {
        id: 'test-alert-3',
        type: 'expiring',
        severity: 'medium',
        message: 'Certificate expires in 30 days',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test University')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL ALERT')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('⚠️  HIGH PRIORITY')
      );
    });

    it('should log alert details correctly', async () => {
      const alert: Alert = {
        id: 'test-alert-4',
        type: 'expired',
        severity: 'critical',
        message: 'Certificate has expired',
        university: 'Example University',
        domain: 'example.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL: Certificate has expired')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('University: Example University')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Domain: example.edu')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Type: expired')
      );
    });

    it('should update metrics for all alert types', async () => {
      const alert: Alert = {
        id: 'test-alert-5',
        type: 'security',
        severity: 'medium',
        message: 'Weak cipher detected',
        university: 'Security University',
        domain: 'security.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Metrics updated:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Alert type: security')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Severity: medium')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('University: Security University')
      );
    });
  });

  describe('Email notification formatting', () => {
    it('should format critical email correctly', async () => {
      const alert: Alert = {
        id: 'test-alert-6',
        type: 'expired',
        severity: 'critical',
        message: 'Certificate has expired',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Subject: [CRITICAL] SSL Certificate Alert - test.edu')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Body: Certificate has expired')
      );
    });

    it('should format high priority email correctly', async () => {
      const alert: Alert = {
        id: 'test-alert-7',
        type: 'expiring',
        severity: 'high',
        message: 'Certificate expires soon',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Subject: [HIGH] SSL Certificate Alert - test.edu')
      );
    });
  });

  describe('Webhook notification', () => {
    it('should send webhook for critical alerts', async () => {
      const alert: Alert = {
        id: 'test-alert-8',
        type: 'expired',
        severity: 'critical',
        message: 'Certificate has expired',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('URL: https://university-alerts.example.com/webhook')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payload: ')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle undefined alert gracefully', async () => {
      await expect(alertProcessor.processAlert(undefined as any)).rejects.toThrow();
    });

    it('should handle alert with missing fields', async () => {
      const incompleteAlert = {
        id: 'incomplete-alert',
        type: 'error',
        severity: 'low'
      } as Alert;

      await expect(alertProcessor.processAlert(incompleteAlert)).resolves.not.toThrow();
    });

    it('should handle very long alert messages', async () => {
      const longMessage = 'A'.repeat(1000);
      const alert: Alert = {
        id: 'long-message-alert',
        type: 'error',
        severity: 'low',
        message: longMessage,
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await expect(alertProcessor.processAlert(alert)).resolves.not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(longMessage.substring(0, 100))
      );
    });
  });

  describe('Alert severity handling', () => {
    it('should handle low severity alerts', async () => {
      const alert: Alert = {
        id: 'low-severity-alert',
        type: 'error',
        severity: 'low',
        message: 'Minor configuration issue',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      await alertProcessor.processAlert(alert);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('LOW: Minor configuration issue')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL ALERT')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('⚠️  HIGH PRIORITY')
      );
    });

    it('should handle unknown severity gracefully', async () => {
      const alert = {
        id: 'unknown-severity-alert',
        type: 'error',
        severity: 'unknown',
        message: 'Test message',
        university: 'Test University',
        domain: 'test.edu',
        timestamp: new Date().toISOString(),
        resolved: false
      } as any;

      await expect(alertProcessor.processAlert(alert)).resolves.not.toThrow();
    });
  });
});
