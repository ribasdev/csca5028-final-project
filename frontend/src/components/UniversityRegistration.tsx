import React, { useState } from 'react';

interface UniversityRegistrationProps {
  onUniversityAdded: () => void;
}

const UniversityRegistration: React.FC<UniversityRegistrationProps> = ({ onUniversityAdded }) => {
  const [formData, setFormData] = useState({
    universityName: '',
    domain: '',
    state: '',
    contactEmail: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.universityName.trim()) {
      setMessage({ type: 'error', text: 'University name is required' });
      return false;
    }

    if (!formData.domain.trim()) {
      setMessage({ type: 'error', text: 'Domain is required' });
      return false;
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(formData.domain)) {
      setMessage({ type: 'error', text: 'Please enter a valid domain (e.g., university.edu)' });
      return false;
    }

    if (!formData.state.trim()) {
      setMessage({ type: 'error', text: 'State is required' });
      return false;
    }

    if (!midwestStates.includes(formData.state)) {
      setMessage({ type: 'error', text: 'Only universities from Midwest states are accepted' });
      return false;
    }

    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/universities/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'University registered successfully!' });
        setFormData({
          universityName: '',
          domain: '',
          state: '',
          contactEmail: ''
        });
        onUniversityAdded();

        setTimeout(() => setMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setMessage({ 
          type: 'error', 
          text: errorData.message || 'Failed to register university' 
        });
      }
    } catch (error) {
      console.error('Error registering university:', error);
      setMessage({ 
        type: 'error', 
        text: 'Network error. Please check your connection and try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearMessage = () => {
    setMessage(null);
  };

  const midwestStates = [
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Michigan', 'Minnesota', 
    'Missouri', 'Nebraska', 'North Dakota', 'Ohio', 'South Dakota', 'Wisconsin'
  ];

  return (
    <div className="university-registration">
      <div className="registration-header">
        <h3>📚 Register Midwest University</h3>
        <p>Add a Midwest university domain to monitor its SSL certificates</p>
        <p className="midwest-note">🌾 Only universities from Midwest states are accepted</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          <span>{message.text}</span>
          <button type="button" onClick={clearMessage} className="close-message">×</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="registration-form">
        <div className="form-group">
          <label htmlFor="universityName">University Name *</label>
          <input
            type="text"
            id="universityName"
            name="universityName"
            value={formData.universityName}
            onChange={handleInputChange}
            placeholder="e.g., University of Colorado Boulder"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="domain">Domain *</label>
          <input
            type="text"
            id="domain"
            name="domain"
            value={formData.domain}
            onChange={handleInputChange}
            placeholder="e.g., colorado.edu"
            required
            disabled={isSubmitting}
          />
          <small className="help-text">Enter the main domain without https:</small>
        </div>

        <div className="form-group">
          <label htmlFor="state">State *</label>
          <select
            id="state"
            name="state"
            value={formData.state}
            onChange={handleInputChange}
            required
            disabled={isSubmitting}
          >
            <option value="">Select a Midwest state</option>
            {midwestStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <small className="help-text">Only Midwest states are supported</small>
        </div>

        <div className="form-group">
          <label htmlFor="contactEmail">Contact Email (Optional)</label>
          <input
            type="email"
            id="contactEmail"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleInputChange}
            placeholder="admin@university.edu"
            disabled={isSubmitting}
          />
          <small className="help-text">For notifications about certificate issues</small>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner"></span>
                Registering...
              </>
            ) : (
              <>
                <span>🚀</span>
                Register University
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UniversityRegistration;
