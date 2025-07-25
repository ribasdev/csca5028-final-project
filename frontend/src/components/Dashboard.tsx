import React, { useState, useEffect } from 'react';
import { Certificate, Alert, DashboardStats, University } from '../types';
import UniversityRegistration from './UniversityRegistration';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const Dashboard: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [certsResponse, statsResponse, universitiesResponse] = await Promise.all([
        fetch(`${API_URL}/api/certificates`),
        fetch(`${API_URL}/api/certificates/stats/dashboard`),
        fetch(`${API_URL}/api/universities`)
      ]);

      const certsData = await certsResponse.json();
      const statsData = await statsResponse.json();
      const universitiesData = await universitiesResponse.json();

      setCertificates(certsData);
      setStats(statsData);
      setUniversities(universitiesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleUniversityAdded = () => {
    fetchData();
    setShowRegistrationForm(false);

    const refreshIntervals = [2000, 5000, 10000, 15000];

    refreshIntervals.forEach((delay, index) => {
      setTimeout(() => {
        fetchData();
      }, delay);
    });
  };

  const handleDeleteUniversity = async (domain: string, universityName: string) => {

    if (!window.confirm(`Are you sure you want to remove ${universityName} (${domain}) from SSL monitoring? This action cannot be undone.`)) {
      return;
    }

    try {
      const deleteUrl = `${API_URL}/api/universities/${domain}`;

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });

      if (response.ok) {
        const responseData = await response.json();

        if (selectedCertificate?.domain === domain) {
          setSelectedCertificate(null);
        }

        alert(`University ${universityName} removed successfully!`);

        setTimeout(async () => {
          await fetchData();
        }, 500);
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        alert(`Failed to remove university: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error removing university:', error);
      alert('Network error. Please check your connection and try again.');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'valid': return '#10b981';
      case 'expiring': return '#f59e0b';
      case 'expired': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return '#10b981';
      case 'B': return '#3b82f6';
      case 'C': return '#f59e0b';
      case 'D': return '#f97316';
      case 'F': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const filteredCertificates = certificates.filter(cert => {
    if (filter === 'all') return true;
    return cert.status === filter;
  });

  const mergedUniversityData = universities.map(university => {
    const cert = certificates.find(c => c.domain === university.domain);
    return {
      id: university.id,
      universityName: university.universityName,
      domain: university.domain,
      state: university.state,
      contactEmail: university.contactEmail,
      registeredAt: university.registeredAt,
      status: university.status,
      certificate: cert || null
    };
  });

  const filteredUniversityData = mergedUniversityData.filter(item => {
    if (filter === 'all') return true;
    if (!item.certificate) return filter === 'no-certificate';
    return item.certificate.status === filter;
  });

  const triggerScan = async (domain: string) => {
    try {
      await fetch(`${API_URL}/api/certificates/scan/${domain}`, {
        method: 'POST'
      });
      alert(`Scan queued for ${domain}`);
    } catch (error) {
      console.error('Error triggering scan:', error);
      alert('Failed to trigger scan');
    }
  };

  if (loading) {
    return <div className="loading">Loading certificate data...</div>;
  }

  return (
    <div className="dashboard">
      {/* Statistics Overview */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Universities</h3>
            <div className="stat-number">{stats.totalUniversities}</div>
          </div>
          <div className="stat-card valid">
            <h3>Valid Certificates</h3>
            <div className="stat-number">{stats.validCertificates}</div>
          </div>
          <div className="stat-card expiring">
            <h3>Expiring Soon</h3>
            <div className="stat-number">{stats.expiringCertificates}</div>
          </div>
          <div className="stat-card expired">
            <h3>Expired</h3>
            <div className="stat-number">{stats.expiredCertificates}</div>
          </div>
        </div>
      )}

      <div className="main-content">
        {/* University Registration Form */}
        {showRegistrationForm && (
          <div className="registration-section">
            <UniversityRegistration onUniversityAdded={handleUniversityAdded} />
          </div>
        )}

        {/* Certificate List */}
        <div className="certificate-panel">
          <div className="panel-header">
            <h2>SSL Certificates</h2>
            <div className="header-actions">
              <button 
                className="add-university-btn"
                onClick={() => setShowRegistrationForm(!showRegistrationForm)}
              >
                {showRegistrationForm ? '✕ Cancel' : '➕ Add University'}
              </button>
              <div className="filters">
                <button 
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
                <button 
                  className={filter === 'valid' ? 'active' : ''}
                  onClick={() => setFilter('valid')}
                >
                  Valid
                </button>
                <button 
                  className={filter === 'expiring' ? 'active' : ''}
                  onClick={() => setFilter('expiring')}
                >
                  Expiring
                </button>
                <button 
                  className={filter === 'expired' ? 'active' : ''}
                  onClick={() => setFilter('expired')}
                >
                  Expired
                </button>
              </div>
            </div>
          </div>

          <div className="certificate-list">
            {filteredUniversityData.length === 0 ? (
              <div className="no-certificates">
                <div className="empty-state">
                  <h3>🔒 No Universities Found</h3>
                  <p>Register a university to start monitoring SSL certificates</p>
                  {!showRegistrationForm && (
                    <button 
                      className="add-university-btn primary"
                      onClick={() => setShowRegistrationForm(true)}
                    >
                      ➕ Register Your First University
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredUniversityData.map((item, index) => (
                <div 
                  key={item.id}
                  className={`certificate-item ${selectedCertificate?.domain === item.domain ? 'selected' : ''}`}
                  onClick={() => item.certificate && setSelectedCertificate(item.certificate)}
                >
                  <div className="cert-basic-info">
                    <div className="university-name">{item.universityName}</div>
                    <div className="domain">{item.domain}</div>
                    <div className="state">{item.state}</div>
                  </div>
                  <div className="cert-status">
                    {item.certificate ? (
                      <>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(item.certificate.status) }}
                        >
                          {item.certificate.status.toUpperCase()}
                        </span>
                        <span 
                          className="grade-badge"
                          style={{ backgroundColor: getGradeColor(item.certificate.securityGrade) }}
                        >
                          {item.certificate.securityGrade}
                        </span>
                      </>
                    ) : (
                      (() => {
                        const registeredAt = new Date(item.registeredAt);
                        const now = new Date();
                        const minutesSinceRegistration = (now.getTime() - registeredAt.getTime()) / (1000 * 60);

                        if (minutesSinceRegistration < 2) {
                          return (
                            <span 
                              className="status-badge scanning"
                              style={{ backgroundColor: '#3b82f6', color: 'white' }}
                              title="Certificate scanning in progress..."
                            >
                              🔄 SCANNING
                            </span>
                          );
                        } else {
                          return (
                            <span 
                              className="status-badge"
                              style={{ backgroundColor: '#6b7280' }}
                            >
                              NO CERTIFICATE
                            </span>
                          );
                        }
                      })()
                    )}
                  </div>
                  <div className="cert-expiry">
                    {item.certificate 
                      ? (item.certificate.daysUntilExpiry > 0 
                          ? `${item.certificate.daysUntilExpiry} days` 
                          : 'Expired')
                      : (() => {
                          const registeredAt = new Date(item.registeredAt);
                          const now = new Date();
                          const minutesSinceRegistration = (now.getTime() - registeredAt.getTime()) / (1000 * 60);

                          return minutesSinceRegistration < 2 ? 'Scanning...' : 'Not scanned';
                        })()
                    }
                  </div>
                  <div className="cert-actions">
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUniversity(item.domain, item.universityName);
                      }}
                      title={`Remove ${item.universityName} from monitoring`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Certificate Details */}
        <div className="details-panel">
          {selectedCertificate ? (
            <div className="certificate-details">
              <div className="details-header">
                <h2>Certificate Details</h2>
                <div className="header-buttons">
                  <button 
                    className="scan-button"
                    onClick={() => triggerScan(selectedCertificate.domain)}
                  >
                    🔄 Rescan
                  </button>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteUniversity(selectedCertificate.domain, selectedCertificate.university)}
                    title={`Remove ${selectedCertificate.university} from monitoring`}
                  >
                    🗑️ Remove University
                  </button>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <label>University:</label>
                  <span>{selectedCertificate.university}</span>
                </div>
                <div className="detail-item">
                  <label>Domain:</label>
                  <span>{selectedCertificate.domain}</span>
                </div>
                <div className="detail-item">
                  <label>State:</label>
                  <span>{selectedCertificate.state}</span>
                </div>
                <div className="detail-item">
                  <label>Issuer:</label>
                  <span>{selectedCertificate.issuer}</span>
                </div>
                <div className="detail-item">
                  <label>Valid From:</label>
                  <span>{new Date(selectedCertificate.validFrom).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <label>Valid To:</label>
                  <span>{new Date(selectedCertificate.validTo).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <label>Days Until Expiry:</label>
                  <span style={{ color: selectedCertificate.daysUntilExpiry <= 30 ? '#ef4444' : '#10b981' }}>
                    {selectedCertificate.daysUntilExpiry > 0 ? selectedCertificate.daysUntilExpiry : 'Expired'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Security Grade:</label>
                  <span 
                    className="grade-badge large"
                    style={{ backgroundColor: getGradeColor(selectedCertificate.securityGrade) }}
                  >
                    {selectedCertificate.securityGrade}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Key Size:</label>
                  <span>{selectedCertificate.keySize} bits</span>
                </div>
                <div className="detail-item">
                  <label>Signature Algorithm:</label>
                  <span>{selectedCertificate.signatureAlgorithm}</span>
                </div>
                <div className="detail-item full-width">
                  <label>Last Scanned:</label>
                  <span>{new Date(selectedCertificate.scanTimestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <h3>Select a certificate to view details</h3>
              <p>Click on any university in the list to see detailed certificate information.</p>
            </div>
          )}

          {/* Recent Alerts */}
          {stats && stats.recentAlerts.length > 0 && (
            <div className="alerts-section">
              <h3>Recent Alerts</h3>
              <div className="alerts-list">
                {stats.recentAlerts.slice(0, 5).map((alert, index) => (
                  <div key={index} className={`alert-item ${alert.severity}`}>
                    <div className="alert-header">
                      <span className="alert-type">{alert.type.toUpperCase()}</span>
                      <span className="alert-severity">{alert.severity.toUpperCase()}</span>
                    </div>
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-time">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
