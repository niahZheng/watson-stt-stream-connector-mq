// const setupTelemetry = require('./setupTelemetry');
// const provider = setupTelemetry();

const WebSocket = require('ws');
const WebSocketServer = require('ws').Server;

const EventPublisher = require('./CeleryEventPublisher');
let eventPublisher = null;

//  CCaaS specific adapters currently supported
const GenesysAudioHookAdapter = require('./GenesysAudioHookAdapter');

// 设置默认日志级别
const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';  // 添加默认值
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
      // 使用 Azure 提供的端口或默认端口
      const port = process.env.PORT || 8080;
      
      // 直接创建 WebSocket 服务器
      wsServer = new WebSocket.Server({ 
        port: port,
        path: '/ws'  // 明确指定 WebSocket 路径
      });

      // 错误处理
      wsServer.on('error', (error) => {
        logger.error(error);
      });

      // 监听服务器启动
      wsServer.on('listening', () => {
        logger.info(`Speech To Text Adapter has started. Listening on 0.0.0.0:${port}`);
        resolve();
      });

      // 处理 WebSocket 连接
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

