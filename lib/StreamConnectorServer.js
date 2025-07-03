// const setupTelemetry = require('./setupTelemetry');
// const provider = setupTelemetry();

const WebSocket = require('ws');
const WebSocketServer = require('ws').Server;

const EventPublisher = require('./CeleryEventPublisher');
let eventPublisher = null;

//  CCaaS specific adapters currently supported
const GenesysAudioHookAdapter = require('./GenesysAudioHookAdapter');

// Set default log level
const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';  // Add default value
const logger = require('pino')({ 
  level: LOG_LEVEL,
  name: 'StreamConnectorServer' 
});

let wsServer = null;

/**
 * 
 * @returns 
 */
function startServer() {
  return new Promise((resolve, reject) => {
    //  Setup event publisher
    eventPublisher = new EventPublisher();

    try {
      // Use Azure provided port or default port
      const port = process.env.PORT || process.env.DEFAULT_SERVER_LISTEN_PORT;
      
      // Create WebSocket server directly
      wsServer = new WebSocket.Server({ 
        port: port,
        path: '/ws'  // Explicitly specify WebSocket path
      });

      // Error handling
      wsServer.on('error', (error) => {
        logger.error(error);
      });

      // Listen for server startup
      wsServer.on('listening', () => {
        logger.info(`Speech To Text Adapter has started. Listening on 0.0.0.0:${port}`);
        resolve();
      });

      // Handle WebSocket connections
      if (process.env.STREAM_ADAPTER_TYPE === 'GenesysAudioHookAdapter') {
        GenesysAudioHookAdapter.setEventPublisher(eventPublisher);
        wsServer.on('connection', GenesysAudioHookAdapter.handleAudioHookConnection);
      } else {
        logger.error(`Unknown adapter type`);
      }

    } catch (e) {
      logger.error('Failed to start server:', e);
      return reject(e);
    }
  });
}

/**
 * 
 * @returns 
 */
function stopServer() {
  return new Promise((resolve, reject) => {
    
    if (eventPublisher != null){
      eventPublisher.destroy();
      eventPublisher = null;
    }

    if (wsServer === null) {
      return reject(new Error('server not started'));
    }
    
    wsServer.close((err) => {
      if (err) {
        return reject(err);
      }
      wsServer = null;
      return resolve();
    });
  });
}

module.exports = {
  start: startServer,
  stop: stopServer
};

