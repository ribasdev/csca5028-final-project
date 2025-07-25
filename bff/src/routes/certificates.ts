import { Router } from 'express';
import { Certificate, Alert, DashboardStats } from 'shared/types';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { dbManager } = req.app.locals;

    const response = await dbManager.opensearchClient.search({
      index: 'certificates',
      body: {
        size: 100,
        sort: [{ scanTimestamp: { order: 'desc' } }],
        collapse: {
          field: 'domain.keyword'
        }
      }
    });

    const certificates = response.body.hits.hits.map((hit: any) => hit._source);
    res.json(certificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.get('/alerts/recent', async (req, res) => {
  try {
    const { dbManager } = req.app.locals;

    const response = await dbManager.opensearchClient.search({
      index: 'alerts',
      body: {
        query: {
          term: { resolved: false }
        },
        sort: [{ timestamp: { order: 'desc' } }],
        size: 50
      }
    });

    const alerts = response.body.hits.hits.map((hit: any) => hit._source);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.get('/stats/dashboard', async (req, res) => {
  try {
    const { dbManager } = req.app.locals;

    const universitiesCountResponse = await fetch('http://opensearch:9200/universities/_count');
    const universitiesCountData = await universitiesCountResponse.json() as { count: number };
    const totalUniversities = universitiesCountData.count;

    if (totalUniversities === 0) {

      const stats: DashboardStats = {
        totalUniversities: 0,
        validCertificates: 0,
        expiringCertificates: 0,
        expiredCertificates: 0,
        securityDistribution: {},
        recentAlerts: [],
        timestamp: new Date().toISOString()
      } as any;

      return res.json(stats);
    }

    const universitiesResponse = await dbManager.opensearchClient.search({
      index: 'universities',
      body: {
        query: { match_all: {} },
        _source: ['domain'],
        size: 1000
      }
    });

    const registeredDomains = new Set(
      universitiesResponse.body.hits.hits.map((hit: any) => hit._source.domain)
    );

    const certResponse = await dbManager.opensearchClient.search({
      index: 'certificates',
      body: {
        size: 0,
        aggs: {
          latest_certs: {
            terms: {
              field: 'domain.keyword',
              size: 1000
            },
            aggs: {
              latest: {
                top_hits: {
                  sort: [{ scanTimestamp: { order: 'desc' } }],
                  size: 1
                }
              }
            }
          }
        }
      }
    });

    const allCertificates = certResponse.body.aggregations.latest_certs.buckets.map(
      (bucket: any) => bucket.latest.hits.hits[0]._source
    );

    const certificates = allCertificates.filter((cert: any) => 
      registeredDomains.has(cert.domain)
    );

    const validCertificates = certificates.filter((cert: Certificate) => cert.status === 'valid').length;
    const expiringCertificates = certificates.filter((cert: Certificate) => cert.status === 'expiring').length;
    const expiredCertificates = certificates.filter((cert: Certificate) => cert.status === 'expired').length;

    const securityDistribution = certificates.reduce((acc: Record<string, number>, cert: Certificate) => {
      acc[cert.securityGrade] = (acc[cert.securityGrade] || 0) + 1;
      return acc;
    }, {});

    const alertResponse = await dbManager.opensearchClient.search({
      index: 'alerts',
      body: {
        query: {
          term: { resolved: false }
        },
        sort: [{ timestamp: { order: 'desc' } }],
        size: 10
      }
    });

    const recentAlerts = alertResponse.body.hits.hits.map((hit: any) => hit._source);

    const stats: DashboardStats = {
      totalUniversities,
      validCertificates,
      expiringCertificates,
      expiredCertificates,
      securityDistribution,
      recentAlerts,
      timestamp: new Date().toISOString()
    } as any;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

router.get('/:domain', async (req, res) => {
  try {
    const { dbManager } = req.app.locals;
    const domain = req.params.domain;

    const response = await dbManager.opensearchClient.search({
      index: 'certificates',
      body: {
        query: {
          term: { 'domain.keyword': domain }
        },
        sort: [{ scanTimestamp: { order: 'desc' } }],
        size: 1
      }
    });

    if (response.body.hits.hits.length === 0) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    const certificate = response.body.hits.hits[0]._source;
    res.json(certificate);
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

router.post('/scan/:domain', async (req, res) => {
  try {
    const { redis } = req.app.locals;
    const domain = req.params.domain;

    await redis.lpush('scan_queue', JSON.stringify({
      universityId: domain,
      domain,
      priority: 'high',
      timestamp: new Date().toISOString()
    }));

    res.json({ message: `Scan queued for ${domain}` });
  } catch (error) {
    console.error('Error queuing scan:', error);
    res.status(500).json({ error: 'Failed to queue scan' });
  }
});

router.delete('/test', async (req, res) => {
  res.json({ message: 'DELETE test successful' });
});

router.put('/test', async (req, res) => {
  res.json({ message: 'PUT test successful' });
});

router.delete('/:domain', async (req, res) => {
  try {
    const { dbManager } = req.app.locals;
    const domain = req.params.domain.toLowerCase();

    const universitySearch = await dbManager.searchDocuments('universities', {
      query: {
        term: { 'domain.keyword': domain }
      }
    });

    const universityExists = universitySearch.body.hits.hits.length > 0;
    let universityData = null;

    if (universityExists) {
      const universityId = universitySearch.body.hits.hits[0]._id;
      universityData = universitySearch.body.hits.hits[0]._source;

      await dbManager.deleteDocument('universities', universityId);
    }

    const certificateDeleteResult = await dbManager.deleteByQuery('certificates', {
      query: {
        term: { 'domain.keyword': domain }
      }
    });

    const deletedCertificates = certificateDeleteResult.body.deleted || 0;

    try {
      await dbManager.deleteByQuery('alerts', {
        query: {
          term: { 'domain.keyword': domain }
        }
      });
    } catch (alertError) {
      console.warn(`Failed to clean up alerts for ${domain}:`, alertError);
    }

    res.json({
      message: 'Certificate and university deleted successfully',
      deleted: {
        domain: domain,
        university: universityData?.universityName || 'Not found',
        certificates: deletedCertificates,
        universityDeleted: universityExists
      }
    });

  } catch (error) {
    console.error('Error deleting certificate and university:', error);
    res.status(500).json({ 
      error: 'Failed to delete certificate and university',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export { router as certificateRoutes };
