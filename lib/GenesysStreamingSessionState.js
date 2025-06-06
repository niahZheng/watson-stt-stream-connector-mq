const StreamingSessionState = require('./StreamingSessionState');

class GenesysStreamingSessionState extends StreamingSessionState {
  constructor(openMessage) {
    super();
    this.sessionId = openMessage.id;
    this.conversationId = openMessage.parameters.conversationId;
    this.organizationId = openMessage.parameters.organizationId;
    this.participant = openMessage.parameters.participant;
    this.clientSeq = openMessage.seq;

  }

  updatePosition(samples) {
    this.samplesProcessed += samples;
  }

  getPosition() {
    return `PT${this.samplesProcessed / this.sampleRate}S`;
  }

  // 处理暂停状态
  pause(isClientInitiated) {
    if (isClientInitiated) {
      this.isClientPaused = true;
    } else {
      this.isServerPaused = true;
    }
    this.isPaused = true;
  }

  // 处理恢复状态
  resume(isClientInitiated) {
    if (isClientInitiated) {
      this.isClientPaused = false;
    } else {
      this.isServerPaused = false;
    }
    this.isPaused = this.isClientPaused || this.isServerPaused;
  }
}

module.exports = GenesysStreamingSessionState;