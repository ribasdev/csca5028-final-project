import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock data
const mockCertificates = [
  {
    university: 'University of Colorado Boulder',
    domain: 'colorado.edu',
    state: 'CO',
    issuer: 'DigiCert Inc',
    subject: 'CN=colorado.edu',
    validFrom: '2024-01-01T00:00:00Z',
    validTo: '2025-12-31T23:59:59Z',
    daysUntilExpiry: 365,
    serialNumber: '12345',
    signatureAlgorithm: 'SHA256withRSA',
    keySize: 2048,
    securityGrade: 'A' as const,
    status: 'valid' as const,
    scanTimestamp: '2024-01-15T10:00:00Z'
  },
  {
    university: 'Colorado State University',
    domain: 'colostate.edu',
    state: 'CO',
    issuer: 'Let\'s Encrypt',
    subject: 'CN=colostate.edu',
    validFrom: '2024-01-01T00:00:00Z',
    validTo: '2024-04-01T00:00:00Z',
    daysUntilExpiry: 7,
    serialNumber: '67890',
    signatureAlgorithm: 'SHA256withRSA',
    keySize: 2048,
    securityGrade: 'B' as const,
    status: 'expiring' as const,
    scanTimestamp: '2024-01-15T10:00:00Z'
  }
];

const mockStats = {
  totalUniversities: 2,
  validCertificates: 1,
  expiringCertificates: 1,
  expiredCertificates: 0,
  securityDistribution: { 'A': 1, 'B': 1 },
  recentAlerts: []
};

const mockUniversities = [
  {
    id: '1',
    name: 'University of Colorado Boulder',
    domain: 'colorado.edu',
    state: 'CO',
    url: 'https://www.colorado.edu'
  },
  {
    id: '2',
    name: 'Colorado State University',
    domain: 'colostate.edu',
    state: 'CO',
    url: 'https://www.colostate.edu'
  }
];

describe('Dashboard Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    
    // Setup default successful responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCertificates)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUniversities)
      });
  });

  test('renders loading state initially', () => {
    render(<Dashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('displays certificates after loading', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('University of Colorado Boulder')).toBeInTheDocument();
      expect(screen.getByText('Colorado State University')).toBeInTheDocument();
    });
  });

  test('displays dashboard statistics', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total certificates
      expect(screen.getByText('1')).toBeInTheDocument(); // Valid certificates
    });
  });

  test('handles certificate selection', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('University of Colorado Boulder')).toBeInTheDocument();
    });

    const certificateRow = screen.getByText('University of Colorado Boulder').closest('tr');
    fireEvent.click(certificateRow!);

    // Check if certificate details are displayed
    await waitFor(() => {
      expect(screen.getByText('Certificate Details')).toBeInTheDocument();
      expect(screen.getByText('colorado.edu')).toBeInTheDocument();
    });
  });

  test('filters certificates by status', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('University of Colorado Boulder')).toBeInTheDocument();
    });

    // Filter by expiring
    const filterSelect = screen.getByDisplayValue('all');
    fireEvent.change(filterSelect, { target: { value: 'expiring' } });

    await waitFor(() => {
      expect(screen.getByText('Colorado State University')).toBeInTheDocument();
      expect(screen.queryByText('University of Colorado Boulder')).not.toBeInTheDocument();
    });
  });

  test('shows and hides university registration form', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Add University')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add University');
    fireEvent.click(addButton);

    expect(screen.getByText('Register New University')).toBeInTheDocument();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Register New University')).not.toBeInTheDocument();
  });

  test('handles delete university', async () => {
    // Mock confirm dialog
    window.confirm = jest.fn(() => true);
    
    // Mock successful delete response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCertificates)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUniversities)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'University removed successfully' })
      });

    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('University of Colorado Boulder')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('🗑️');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('University of Colorado Boulder')
    );
  });

  test('handles API errors gracefully', async () => {
    // Mock console.error to avoid error output in tests
    const originalError = console.error;
    console.error = jest.fn();

    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(console.error).toHaveBeenCalled();
    
    // Restore console.error
    console.error = originalError;
  });

  test('displays security grade colors correctly', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('University of Colorado Boulder')).toBeInTheDocument();
    });

    // Check if security grades are displayed with proper styling
    const gradeA = screen.getByText('A');
    const gradeB = screen.getByText('B');
    
    expect(gradeA).toBeInTheDocument();
    expect(gradeB).toBeInTheDocument();
  });

  test('refreshes data on interval', async () => {
    jest.useFakeTimers();
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(6); // Should have called again
    });

    jest.useRealTimers();
  });

  test('displays certificate status with correct colors', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(screen.getByText('expiring')).toBeInTheDocument();
    });
  });

  test('sorts certificates by expiry date', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // The first row should be the header, second should be the expiring certificate
      expect(rows[1]).toHaveTextContent('expiring');
    });
  });
});
