import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../utils/database';

const router = Router();

interface UniversityRegistrationRequest {
  universityName: string;
  domain: string;
  state: string;
  contactEmail?: string;
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { universityName, domain, state, contactEmail }: UniversityRegistrationRequest = req.body;
    const dbManager: DatabaseManager = req.app.locals.dbManager;

    if (!universityName || !domain || !state) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'University name, domain, and state are required'
      });
    }

    const midwestStates = [
      'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Michigan', 'Minnesota', 
      'Missouri', 'Nebraska', 'North Dakota', 'Ohio', 'South Dakota', 'Wisconsin'
    ];

    if (!midwestStates.includes(state)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Only universities from Midwest states are accepted. Supported states: ' + midwestStates.join(', ')
      });
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid domain format'
      });
    }

    const existingUniversity = await dbManager.searchDocuments('universities', {
      query: {
        term: { 'domain.keyword': domain }
      }
    });

    if (existingUniversity.body.hits.hits.length > 0) {
      return res.status(409).json({
        error: 'Domain already exists',
        message: `University with domain ${domain} is already registered`
      });
    }

    const universityDoc = {
      universityName: universityName.trim(),
      domain: domain.toLowerCase().trim(),
      state: state.trim(),
      contactEmail: contactEmail?.trim() || null,
      registeredAt: new Date().toISOString(),
      status: 'active',
      lastScanAt: null,
      certificateCount: 0
    };

    const result = await dbManager.indexDocument('universities', universityDoc);

    if (result.statusCode === 201) {
      try {
        await dbManager.pushToQueue('scan_queue', {
          universityId: result.body._id,
          university: universityName,
          domain: domain,
          state: state,
          priority: 'high',
          timestamp: new Date().toISOString(),
          source: 'university_registration'
        });

      } catch (scanError) {
        console.warn('Failed to queue initial scan:', scanError);
      }

      res.status(201).json({
        message: 'University registered successfully and scan queued',
        university: {
          id: result.body._id,
          ...universityDoc
        }
      });
    } else {
      throw new Error('Failed to store university document');
    }

  } catch (error) {
    console.error('Error registering university:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register university'
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const dbManager: DatabaseManager = req.app.locals.dbManager;

    const result = await dbManager.searchDocuments('universities', {
      query: { match_all: {} },
      sort: [{ registeredAt: { order: 'desc' } }],
      size: 100
    });

    const universities = result.body.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source
    }));

    res.json(universities);

  } catch (error) {
    console.error('Error fetching universities:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch universities'
    });
  }
});

router.get('/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const dbManager: DatabaseManager = req.app.locals.dbManager;

    const result = await dbManager.searchDocuments('universities', {
      query: {
        term: { 'domain.keyword': domain.toLowerCase() }
      }
    });

    if (result.body.hits.hits.length === 0) {
      return res.status(404).json({
        error: 'University not found',
        message: `No university found with domain ${domain}`
      });
    }

    const university = {
      id: result.body.hits.hits[0]._id,
      ...result.body.hits.hits[0]._source
    };

    res.json(university);

  } catch (error) {
    console.error('Error fetching university:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch university'
    });
  }
});

router.put('/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const updates = req.body;
    const dbManager: DatabaseManager = req.app.locals.dbManager;

    const searchResult = await dbManager.searchDocuments('universities', {
      query: {
        term: { 'domain.keyword': domain.toLowerCase() }
      }
    });

    if (searchResult.body.hits.hits.length === 0) {
      return res.status(404).json({
        error: 'University not found',
        message: `No university found with domain ${domain}`
      });
    }

    const universityId = searchResult.body.hits.hits[0]._id;
    const currentData = searchResult.body.hits.hits[0]._source;

    const updateDoc = {
      ...currentData,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    delete updateDoc.domain;
    delete updateDoc.registeredAt;

    const result = await dbManager.updateDocument('universities', universityId, updateDoc);

    if (result.statusCode === 200) {
      res.json({
        message: 'University updated successfully',
        university: {
          id: universityId,
          ...updateDoc,
          domain: domain
        }
      });
    } else {
      throw new Error('Failed to update university document');
    }

  } catch (error) {
    console.error('Error updating university:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update university'
    });
  }
});

router.delete('/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const dbManager: DatabaseManager = req.app.locals.dbManager;

    const searchResult = await dbManager.searchDocuments('universities', {
      query: {
        term: { 'domain.keyword': domain.toLowerCase() }
      }
    });

    if (searchResult.body.hits.hits.length === 0) {
      return res.status(404).json({
        error: 'University not found',
        message: `No university found with domain ${domain}`
      });
    }

    const universityId = searchResult.body.hits.hits[0]._id;
    const universityData = searchResult.body.hits.hits[0]._source;

    try {
      const certificateDeleteResult = await dbManager.deleteByQuery('certificates', {
        query: {
          term: { 'domain.keyword': domain.toLowerCase() }
        }
      });
      const deletedCertificates = certificateDeleteResult.body.deleted || 0;
    } catch (certError) {
      console.warn(`Failed to delete SSL certificates for ${domain}:`, certError);
    }

    try {
      await dbManager.deleteByQuery('alerts', {
        query: {
          term: { 'domain.keyword': domain.toLowerCase() }
        }
      });
    } catch (alertError) {
      console.warn(`Failed to clean up alerts for ${domain}:`, alertError);
    }

    const result = await dbManager.deleteDocument('universities', universityId);

    if (result.statusCode === 200) {
      res.json({
        message: 'University and related SSL certificates deleted successfully',
        deleted: {
          university: universityData.universityName,
          domain: domain
        }
      });
    } else {
      throw new Error('Failed to delete university document');
    }

  } catch (error) {
    console.error('Error deleting university:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete university'
    });
  }
});

export { router as universityRoutes };
