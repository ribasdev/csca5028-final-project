import express, { Request, Response } from 'express';
import cors from 'cors';
import { DatabaseManager } from './utils/database';
import { certificateRoutes } from './routes/certificates';
import { universityRoutes } from './routes/universities';

const app = express();
const port = process.env.PORT || 4000;

const dbManager = new DatabaseManager(
  process.env.OPENSEARCH_URL || 'http://localhost:9200',
  process.env.REDIS_URL || 'redis://localhost:6379'
);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

app.locals.dbManager = dbManager;

app.use('/api/certificates', certificateRoutes);
app.use('/api/universities', universityRoutes);

app.get('/health', async (req: Request, res: Response) => {
  try {
    const opensearchHealthy = await dbManager.checkOpenSearchHealth();
    const redisHealthy = await dbManager.checkRedisHealth();
    
    const queueDepths = await dbManager.getQueueDepths();
    
    const status = opensearchHealthy && redisHealthy ? 'healthy' : 'unhealthy';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        opensearch: opensearchHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy'
      },
      queues: queueDepths
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

async function startServer() {
  try {
    
    await dbManager.initializeIndices();

    app.listen(port, () => {
    });
  } catch (error) {
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await dbManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await dbManager.close();
  process.exit(0);
});

startServer();