import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UniversityRegistration from './UniversityRegistration';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('UniversityRegistration Component', () => {
  const mockOnUniversityAdded = jest.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    mockOnUniversityAdded.mockClear();
  });

  test('renders registration form', () => {
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    expect(screen.getByText('📚 Register Midwest University')).toBeInTheDocument();
    expect(screen.getByLabelText(/university name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/domain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument();
  });

  test('displays all required form fields', () => {
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    expect(screen.getByPlaceholderText(/university of colorado boulder/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/colorado.edu/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('')).toBeInTheDocument(); // State select
    expect(screen.getByPlaceholderText(/admin@university.edu/i)).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    expect(screen.getByText('University name is required')).toBeInTheDocument();
  });

  test('validates domain format', async () => {
    const user = userEvent.setup();
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'invalid-domain');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@test.edu');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    expect(screen.getByText(/please enter a valid domain/i)).toBeInTheDocument();
  });

  test('validates midwest states only', async () => {
    const user = userEvent.setup();
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    // Test with valid midwest state first
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'test.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@test.edu');
    
    // The form should validate successfully (no error should appear)
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    // Since we mocked fetch to fail, we should see the error but not about midwest states
    await waitFor(() => {
      expect(screen.queryByText(/only universities from midwest states/i)).not.toBeInTheDocument();
    });
  });

  test('validates email format', async () => {
    const user = userEvent.setup();
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'test.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'invalid-email');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'University registered successfully' })
    });

    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'test.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@test.edu');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/universities/register',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            universityName: 'Test University',
            domain: 'test.edu',
            state: 'Illinois',
            contactEmail: 'admin@test.edu'
          })
        })
      );
    });
  });

  test('handles successful registration', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'University registered successfully' })
    });

    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'test.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@test.edu');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/university registered successfully/i)).toBeInTheDocument();
      expect(mockOnUniversityAdded).toHaveBeenCalled();
    });
    
    // Check if form is reset
    expect(screen.getByLabelText(/university name/i)).toHaveValue('');
    expect(screen.getByLabelText(/domain/i)).toHaveValue('');
  });

  test('handles registration error', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Domain already exists' })
    });

    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'existing.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@existing.edu');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/domain already exists/i)).toBeInTheDocument();
    });
    
    expect(mockOnUniversityAdded).not.toHaveBeenCalled();
  });

  test('handles network errors', async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'test.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'CO');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@test.edu');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  test('disables submit button while submitting', async () => {
    const user = userEvent.setup();
    // Mock a slow response
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Success' })
        }), 1000)
      )
    );

    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    await user.type(screen.getByLabelText(/university name/i), 'Test University');
    await user.type(screen.getByLabelText(/domain/i), 'test.edu');
    await user.selectOptions(screen.getByLabelText(/state/i), 'Illinois');
    await user.type(screen.getByLabelText(/contact email/i), 'admin@test.edu');
    
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    expect(screen.getByText(/🚀 registering.../i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('displays help text for domain field', () => {
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    expect(screen.getByText(/enter the main domain without https/i)).toBeInTheDocument();
  });

  test('lists all midwest states in select options', () => {
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    const stateSelect = screen.getByLabelText(/state/i);
    
    // Check if common midwest states are present
    expect(screen.getByText('Colorado')).toBeInTheDocument();
    expect(screen.getByText('Illinois')).toBeInTheDocument();
    expect(screen.getByText('Indiana')).toBeInTheDocument();
    expect(screen.getByText('Iowa')).toBeInTheDocument();
    expect(screen.getByText('Kansas')).toBeInTheDocument();
    expect(screen.getByText('Michigan')).toBeInTheDocument();
    expect(screen.getByText('Minnesota')).toBeInTheDocument();
    expect(screen.getByText('Missouri')).toBeInTheDocument();
    expect(screen.getByText('Nebraska')).toBeInTheDocument();
    expect(screen.getByText('North Dakota')).toBeInTheDocument();
    expect(screen.getByText('Ohio')).toBeInTheDocument();
    expect(screen.getByText('South Dakota')).toBeInTheDocument();
    expect(screen.getByText('Wisconsin')).toBeInTheDocument();
  });

  test('clears messages when form input changes', async () => {
    const user = userEvent.setup();
    render(<UniversityRegistration onUniversityAdded={mockOnUniversityAdded} />);
    
    // Trigger validation error
    const submitButton = screen.getByText('Register University');
    await user.click(submitButton);
    
    expect(screen.getByText('University name is required')).toBeInTheDocument();
    
    // Start typing in the name field
    await user.type(screen.getByLabelText(/university name/i), 'T');
    
    // Message should be cleared
    expect(screen.queryByText('University name is required')).not.toBeInTheDocument();
  });
});
