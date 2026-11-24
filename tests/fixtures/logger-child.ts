import { logger } from '../../src/main/logger';

logger.info('first log entry');
logger.warn('second log entry');
logger.error('third log entry', new Error('expected detail'));
