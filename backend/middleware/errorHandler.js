import { isProduction } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  logger.error(`[${req.method}] ${req.originalUrl} - ${statusCode} - ${message}`);
  if (!isProduction && err.stack) {
    logger.debug(err.stack);
  }

  const response = {
    error: message
  };

  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
}

export default errorHandler;
