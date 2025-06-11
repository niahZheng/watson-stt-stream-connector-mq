// const { startSpan, endSpan } = require('./spanUtils');
// const {parentSpan} = require('./wsSpan')
const { trace, SpanKind, context } = require('@opentelemetry/api');

const tracer = trace.getTracer('GenesysAudioHookAdapter');

const WebSocket = require('ws');
const WebSocketServer = require('ws').Server;

// Change to your own Speech To Text Engine implementation, you can use
// the WatsonSpeechToTextEngine.js for guidance
const SpeechToTextEngine = require('./WatsonSpeechToTextEngine');
const StreamingSessionState = require('./GenesysStreamingSessionState');
const url = require('url');

const DEFAULT_PORT = process.env.PORT;
const LOG_LEVEL = process.env.LOG_LEVEL;
const logger = require('./logger');

const rootTopic = "agent-assist/";
const rootSessionTopic = rootTopic + "session";

var eventPublisher = null;
function setEventPublisher(publisher) { eventPublisher = publisher; }
module.exports.setEventPublisher = setEventPublisher;

/**
 * Function for sending an 'opened" response.
 * 
 * @param {*} webSocket 
 * @param {*} openRequest 
 * @param {*} sessionState 
 */
function sendOpenedResponse(webSocket, message, sessionState, parentSpanCtx) {
   //  Notify all the event listeners that a new session is starting
  let event = {
    'type': 'session_started',
    'parameters': {
      'session_id': sessionState.conversationId,
      'customer_ani': sessionState.participant.ani,
      'customer_name': sessionState.participant.aniName,
      'dnis': sessionState.participant.dnis,
    },
    'conversationid': sessionState.conversationId // this is a temporary parameter for routing backend messages
  };

  // this might need to be re-worked at some point
  // because the topic doesn't include the conversationId

  tracer.startActiveSpan('eventPublisher.publishMessage',{kind: SpanKind.INTERNAL}, parentSpanCtx, (span) => {
    eventPublisher.publish(rootSessionTopic, JSON.stringify(event), parentSpanCtx);
    span.end();
  });

  // Send the opened message back to Genesys 
  // sessionState.serverSeq++;
  const openedResponse = {
    "version": "2",
    "id": message.id,
    "type": "opened",
    "seq": message.serverseq+1,
    "clientseq": message.seq,
    "parameters": {
      "startPaused": false,
      "media": [
        {
          "type": "audio",
          "format": "PCMU",
          "channels": ["external", "internal"],
          "rate": 8000
        }
      ]
    }
  };

  logger.info({
    event: 'sending_opened_response',
    sessionId: sessionState.sessionId,
    response: JSON.stringify(openedResponse, null, 2),
    timestamp: new Date().toISOString()
  });

  webSocket.send(JSON.stringify(openedResponse));
}

/**
 * Function for destroying active speech engines.
 * 
 * @param {*} externalSpeechToTextEngine 
 * @param {*} internalSpeechToTextEngine 
 */
function stopSession(externalSpeechToTextEngine, internalSpeechToTextEngine, sessionState, parentSpanCtx) {
  logger.important({
    event: 'session_stop',
    sessionId: sessionState?.sessionId,
    reason: 'normal_termination',
    timestamp: new Date().toISOString()
  });

  // 创建空缓冲区
  let empty_blob = Buffer.alloc(0);

  // 安全地写入空缓冲区
  if (externalSpeechToTextEngine) {
    externalSpeechToTextEngine.write(empty_blob);
  }
  
  if (internalSpeechToTextEngine) {
    internalSpeechToTextEngine.write(empty_blob);
  }

  // 等待最终转录结果后清理
  setTimeout(cleanupSession, 3000, externalSpeechToTextEngine, internalSpeechToTextEngine, sessionState, parentSpanCtx);
}

/**
 * 
 * @param {*} externalSpeechToTextEngine 
 * @param {*} internalSpeechToTextEngine 
 * @param {*} sessionState 
 */
function cleanupSession(externalSpeechToTextEngine, internalSpeechToTextEngine, sessionState, parentSpanCtx) {

  if (externalSpeechToTextEngine != null) {
    externalSpeechToTextEngine.removeAllListeners();
    externalSpeechToTextEngine.on('error', () => { }); // no-op
    externalSpeechToTextEngine.destroy();
    externalSpeechToTextEngine = null;
  }

  if (internalSpeechToTextEngine != null) {
    internalSpeechToTextEngine.removeAllListeners();
    internalSpeechToTextEngine.on('error', () => { }); // no-op
    internalSpeechToTextEngine.destroy();
    internalSpeechToTextEngine = null
  }

  //  Notify all the event listeners that the session as ended
  let event = {
    'type': 'session_ended'
  };
  eventPublisher.publish(rootTopic + sessionState.conversationId, JSON.stringify(event), parentSpanCtx);
}

/**
 * This menthod is used to send a disconnect back to Genesys. This typically happens when there is an error
 * or problem encountered here at the server.
 * 
 * @param {*} webSocket 
 */
function sendDisconnect(webSocket, sessionState, reason) {
  if (webSocket.readyState === WebSocket.OPEN && sessionState.state != 'disconnected') {
    sessionState.state = 'disconnected';
    webSocket.send(JSON.stringify({
      "version": "2",
      "type": "disconnect",
      "seq": sessionState.serverSeq,
      "clientseq": sessionState.clientSeq,
      "id": sessionState.sessionId,
      "parameters": {
        "reason": reason
      }
    }));
  }
}

/**
 * Function for setting up new speech engines.
 * 
 * @param {*} externalSpeechToTextEngine 
 * @param {*} internalSpeechToTextEngine 
 * @param {*} webSocket 
 * @param {*} sessionState 
 */
function setupSpeechEngine(channelName, speechToTextEngine, webSocket, sessionState, parentSpanCtx) {

  speechToTextEngine.on('listening', () => {
    logger.debug(channelName + ' Speech Engine is listening.');
    sessionState.setSpeechEngineListening(channelName, true);

    if (sessionState.getPreListenCache(channelName) != null) {
      logger.debug('Flush pre listen cache for ' + channelName);
      speechToTextEngine.write(sessionState.getPreListenCache(channelName));
      sessionState.setPreListenCache(channelName, null);
    }
  });

  speechToTextEngine.on('data', (sttMessage) => {

    const { transcript } = sttMessage.results[0].alternatives[0];
    const { final } = sttMessage.results[0];

    //  Timestamp is the time for the first word in the utterance.
    let timestamp = sttMessage.results[0].alternatives[0].timestamps[0][1];

    //  We only publish the final transcription.
    if (final) {
      tracer.startActiveSpan('speechToTextEngine.eventPublisher', { kind: SpanKind.INTERNAL }, parentSpanCtx, (span) => {
        //  Increatement the event sequence number.
        sessionState.eventCount++;

        //  Notify all the event listeners of a new transcription event
        let event = {
          'type': 'transcription',
          'parameters': {
            'source': channelName,
            'text': transcript,
            'seq': sessionState.eventCount,
            'timestamp': timestamp,
          },
          'conversationid': sessionState.conversationId, // this is a temporary way to route messages to agents only
        };

        logger.debug("Publish event for channel: " + channelName + " transcription: " + event.parameters.text);
        eventPublisher.publish(rootTopic + sessionState.conversationId + "/transcription", JSON.stringify(event), parentSpanCtx);
        span.end();
      });
    }
    else {
      //  Note that you will not get hypothesis with all speech models (e.g LSM does not send these)
      logger.debug(channelName + ` transcription hypothesis received:` + transcript);

    }
  });

  speechToTextEngine.on('error', (error) => {
    logger.error(error, channelName + ' SpeechToTextEngine encountered an error: ' + error.message);
    sendDisconnect(webSocket, sessionState, error);
  });

  speechToTextEngine.on('end', (reason = 'No close reason defined') => {
    logger.debug(channelName + ' SpeechToTextEngine received an end, sending a disconnect');
    sendDisconnect(webSocket, sessionState, reason);
  });

  //  This code initialzes the speech recognition engines. This kicks off the initialization process and avoids
  //  any race conditions with getting the 'listening' events back. Note that I tried to use the 'initialize'
  //  method on the SDK but that didn't seem to work.
  speechToTextEngine.write(Buffer.alloc(1));
}

/**
 * 
 * @param {*} headers 
 * @returns 
 *    true: if headers contain a valid API KEY
 *    false: if headers do NOT contain a valid API KEY
 */
function isApiKeyValid(headers) {

  if (process.env.STREAM_CONNECTOR_API_KEY == "") {
    logger.debug('WARNING: No API key configured. Accepting websocket. Only use when testing.');
    return (true);
  }

  //  We check both cases of the x-api-key header because Genesys doc says that the header
  //  will be sent with all caps. Note that http headers in general are supposed to be case insensitive. 
  if (headers.hasOwnProperty('x-api-key')) {
    if (headers['x-api-key'] !== process.env.STREAM_CONNECTOR_API_KEY) {
      logger.error('WeSocket connection does not contain a valid API Key. Rejecting webSocket.');
      return false;
    }
    else {
      logger.debug('Valid API Key detected. Setting up webSocket session.');
    }
  }
  else if (headers.hasOwnProperty('X-API-KEY')) {
    if (headers['X-API-KEY'] !== process.env.STREAM_CONNECTOR_API_KEY) {
      logger.error('WeSocket connection does not contain a valid API Key. Rejecting webSocket.');
      return false;
    }
    else {
      logger.debug('Valid API Key detected. Setting up webSocket session.');
    }
  }
  else {
    logger.error('WeSocket connection does not contain an X-API-KEY header. Rejecting webSocket.');
    return false;
  }
  return true;
}

/**
 * Handles inbound audio data from the websocket.
 * 
 * @param {*} channelName 
 * @param {*} speechToTextEngine 
 * @param {*} sessionState 
 * @param {*} buffer 
 */
function processReceivedData(channelName, speechToTextEngine, sessionState, buffer) {
  // 记录音频数据接收
  logger.important({
    event: 'audio_data_received',
    channel: channelName,
    sessionId: sessionState?.sessionId,
    bufferSize: buffer.length,
    timestamp: new Date().toISOString()
  });

  if (speechToTextEngine != null && sessionState.isSpeechEngineListening(channelName) == true) {
    if (sessionState.receivedBufferCount % 100 == 0) {
      logger.important({
        event: 'audio_processing',
        channel: channelName,
        sessionId: sessionState?.sessionId,
        bufferCount: sessionState.receivedBufferCount,
        bufferSize: buffer.length,
        timestamp: new Date().toISOString()
      });
    }

    speechToTextEngine.write(buffer);
  } else {
    // 缓存音频直到语音引擎准备就绪
    if (sessionState.getPreListenCache(channelName) == null) {
      logger.important({
        event: 'audio_caching_started',
        channel: channelName,
        sessionId: sessionState?.sessionId,
        bufferSize: buffer.length,
        timestamp: new Date().toISOString()
      });
      sessionState.setPreListenCache(channelName, buffer);
    } else {
      let newBuffer = Buffer.alloc(sessionState.getPreListenCache(channelName).length + buffer.length);
      sessionState.getPreListenCache(channelName).copy(newBuffer);
      buffer.copy(newBuffer, sessionState.getPreListenCache(channelName).length);
      sessionState.setPreListenCache(channelName, newBuffer);

      logger.important({
        event: 'audio_cache_updated',
        channel: channelName,
        sessionId: sessionState?.sessionId,
        totalCacheSize: newBuffer.length,
        newBufferSize: buffer.length,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * Function for handling a new Genesys AudioHook connection.
 * 
 * @param {*} webSocket 
 * @param {*} incomingMessage 
 */
function handleAudioHookConnection(webSocket, incomingMessage) {
  let sessionState = null;
  let externalSpeechToTextEngine = null;
  let internalSpeechToTextEngine = null;

  // 注释掉 API Key 验证
  // const apiKey = getApiKey(incomingMessage);
  // if (!isValidApiKey(apiKey)) {
  //   logger.error('Invalid API Key, closing connection');
  //   webSocket.close();
  //   return;
  // }

  logger.debug('connection received');
  // Parse query parameters
  const queryParams = url.parse(incomingMessage.url, true).query;
  logger.debug(queryParams, 'query parameters:');

  // Get headers
  const { headers } = incomingMessage;
  logger.debug(headers, 'headers on websocket connection:');

  // 处理消息
  webSocket.on('message', (data) => {
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        logger.info(message);
        handleControlMessage(message);
      } else if (Buffer.isBuffer(data)) {
        handleAudioData(data);
      }
    } catch (err) {
      logger.error('Message processing failed', err);
      webSocket.close(1000, 'Invalid message format');
    }
  });

  // 处理控制消息
  function handleControlMessage(message) {
    if (message.type === 'ping') {
      // 立即响应 ping 消息
      const pongResponse = {
        "version": "2",
        "type": "pong",
        "seq": message.serverseq+1,
        "clientseq": message.seq,
        "id": message.id,
        "parameters": { }
      };

      webSocket.send(JSON.stringify(pongResponse));
      return;
    }
    
    if (message.type === 'open') {
      sessionState = new StreamingSessionState(message);
      
      // 探测消息特殊处理
      if (isProbeMessage(message)) {
        logger.info('Probe message received');
        sendOpenedResponse(webSocket, message, sessionState);
        return;
      }

      // 正常会话处理
      logger.info({
        event: 'session_start',
        sessionId: sessionState.sessionId
      });
      
      initializeSpeechEngines();
      sendOpenedResponse(webSocket, message, sessionState);
    } else if (message.type === 'close') {
      // 处理关闭请求
      logger.info({
        event: 'close_request',
        sessionId: message.id,
        reason: message.parameters.reason
      });

      // 在清理之前保存必要的状态
      // const currentSeq = sessionState ? sessionState.serverSeq + 1 : 0;
      
      // 发送 closed 响应
      const closedResponse = {
        version: '2',
        type: 'closed',
        seq: message.serverseq+1,
        clientseq: message.seq,
        id: message.id,
        parameters: {}
      };
      
      webSocket.send(JSON.stringify(closedResponse));
      
      // 开始会话结束流程
      cleanup();
      
      // 延迟关闭 WebSocket 连接，确保 closed 消息能够发送
      setTimeout(() => {
        webSocket.close(1000, 'Session ended normally');
      }, 1000);
    } else if (message.type === 'discarded') {
      // 处理音频丢弃消息
      logger.info({
        event: 'audio_discarded',
        sessionId: message.id,
        start: message.parameters.start,
        discarded: message.parameters.discarded,
        position: message.position
      });

      // 更新音频时间线
      if (sessionState) {
        // 将 ISO 8601 持续时间转换为秒数
        const startSeconds = parseDuration(message.parameters.start);
        const discardedSeconds = parseDuration(message.parameters.discarded);
        
        // 更新会话状态中的音频位置
        sessionState.updatePosition(startSeconds * sessionState.sampleRate);
        
        // 通知语音引擎音频丢弃
        if (externalSpeechToTextEngine) {
          externalSpeechToTextEngine.handleDiscarded(startSeconds, discardedSeconds);
        }
        if (internalSpeechToTextEngine) {
          internalSpeechToTextEngine.handleDiscarded(startSeconds, discardedSeconds);
        }
      }
    }
  }

  // 辅助函数：解析 ISO 8601 持续时间
  function parseDuration(duration) {
    // 示例: "PT23.4S" -> 23.4
    const match = duration.match(/PT(\d+(?:\.\d+)?)S/);
    return match ? parseFloat(match[1]) : 0;
  }

  // 处理音频数据
  function handleAudioData(data) {
    if (!sessionState || sessionState.isPaused) return;
    // 验证数据长度是否为偶数(确保完整的样本)
    if (data.length % 2 !== 0) {
      logger.error({
        event: 'invalid_audio_data',
        reason: 'Incomplete samples',
        length: data.length
      });
      return;
    }

    const {external, internal} = splitAudioChannels(data);
    
    // 更新音频时间线
    const samplesProcessed = data.length / 2; // PCMU 8000Hz
    sessionState.updatePosition(samplesProcessed);

    if (externalSpeechToTextEngine) {
      externalSpeechToTextEngine.write(external);
    }
    
    if (internalSpeechToTextEngine) {
      internalSpeechToTextEngine.write(internal);
    }
  }

  // 初始化语音引擎
  function initializeSpeechEngines() {
    externalSpeechToTextEngine = new SpeechToTextEngine();
    internalSpeechToTextEngine = new SpeechToTextEngine();
    setupSpeechEngine('external', externalSpeechToTextEngine, webSocket, sessionState);
    setupSpeechEngine('internal', internalSpeechToTextEngine, webSocket, sessionState);
  }

  // 清理资源
  function cleanup() {
    if (!sessionState) return; // 防止重复调用

    logger.info({
      event: 'session_end',
      sessionId: sessionState.sessionId
    });

    if (externalSpeechToTextEngine) {
      externalSpeechToTextEngine.destroy();
      externalSpeechToTextEngine = null;
    }
    if (internalSpeechToTextEngine) {
      internalSpeechToTextEngine.destroy();
      internalSpeechToTextEngine = null;
    }

    // 清理完成后重置 sessionState
    sessionState = null;
  }

  // 错误处理
  webSocket.on('error', (err) => {
    // 改进错误日志格式
    logger.error({
      event: 'websocket_error',
      sessionId: sessionState?.sessionId,
      error: {
        message: err.message || 'Unknown error',
        code: err.code,
        type: err.type,
        name: err.name
      }
    });

    // 确保只调用一次 cleanup
    if (sessionState) {
      cleanup();
    }
  });

  // 关闭连接处理
  webSocket.on('close', (code, reason) => {
    logger.info({
      event: 'connection_closed',
      sessionId: sessionState?.sessionId,
      code,
      reason: reason || 'Normal closure'
    });

    // 确保只调用一次 cleanup
    if (sessionState) {
      cleanup();
    }
  });
}

// 可以保留这些辅助函数，但不再使用它们
function getApiKey(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  return request.headers['x-api-key'] || url.searchParams.get('X-API-KEY');
}

function isValidApiKey(apiKey) {
  const validApiKey = process.env.API_KEY;
  if (!validApiKey) {
    logger.error('API_KEY not configured');
    return false;
  }
  return apiKey === validApiKey;
}

function isProbeMessage(message) {
  return message.parameters.conversationId === "00000000-0000-0000-0000-000000000000";
}

function splitAudioChannels(data) {
  const halfLength = data.length / 2;
  const external = Buffer.alloc(halfLength);
  const internal = Buffer.alloc(halfLength);
  
  for (let i = 0, j = 0; i < data.length; i += 2, j++) {
    external[j] = data[i];
    internal[j] = data[i + 1];
  }
  
  return { external, internal };
}

// 添加暂停/恢复功能
function handlePause() {
  if (!sessionState.isPaused) {
    sessionState.isPaused = true;
    sendPausedResponse();
  }
}

function handleResume() {
  if (sessionState.isPaused) {
    sessionState.isPaused = false;
    sendResumedResponse();
  }
}

module.exports.handleAudioHookConnection = handleAudioHookConnection;