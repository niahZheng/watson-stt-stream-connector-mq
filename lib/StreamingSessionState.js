
class StreamingSessionState {

  sessionId;

  //  Used to track when the speech engines are ready to receive audio.
  internalSpeechEngineListening = false;
  externalSpeechEngineListening = false;

  //  Used to cache any audio that is received from the CCaaS prior to the speech engine
  //  being ready to receive it.
  preListenCache = {};
  
  constructor(sessionId) {
    this.sessionId = sessionId;
  }

  getPreListenCache(channelName){
    return this.preListenCache[channelName];
  }

  setPreListenCache(channelName, value){
      this.preListenCache[channelName] = value;
  }
  
  isSpeechEngineListening(channelName){
    if (channelName == 'internal')
      return(this.internalSpeechEngineListening);
    else
      return(this.externalSpeechEngineListening);
  }

  setSpeechEngineListening(channelName, value){
    if (channelName == 'internal')
      this.internalSpeechEngineListening = value;
    else
      this.externalSpeechEngineListening = value;
  }
}
module.exports = StreamingSessionState;
