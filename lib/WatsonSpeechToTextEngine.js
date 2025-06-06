
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const SpeechToTextEngine = require('./SpeechToTextEngine');
const { BasicAuthenticator, IamAuthenticator } = require('ibm-watson/auth');

const LOG_LEVEL = process.env.LOG_LEVEL;
const logger = require('pino')({ level: LOG_LEVEL, name: 'WatsonSpeechToTextEngine' });

const WatsonSpeechToTextCredentials = {
                                        'username': process.env.WATSON_STT_USERNAME,
                                        'password': process.env.WATSON_STT_PASSWORD
                                      };

const { username, password } = WatsonSpeechToTextCredentials;
const basicAuthenticator = new BasicAuthenticator({ username, password });

const speechToText = new SpeechToTextV1({
  authenticator: basicAuthenticator,
  url: process.env.WATSON_STT_URL
});

class WatsonSpeechToTextEngine extends SpeechToTextEngine {
  /**
   * Creates an instace of the WatsonSpeechToTextEngine
   */
  constructor() {
    super();

    //  Pass these parameters into the STT object.
    const params = {
        'contentType': 'audio/basic', // Encoding of the audio, defaults to mulaw (pcmu) at 8kHz
        'action': 'start',            // Start message for Watson Speech To Text
        'interimResults': true,
        //'lowLatency': true,
        'inactivityTimeout': -1,
        'model': process.env.WATSON_STT_MODEL, // Use Narrowband Model for english at 8kHZ
        'objectMode': true,
        'endOfPhraseSilenceTime': parseFloat(process.env.WATSON_STT_END_OF_PHRASE_SILENCE_TIME),
        'smartFormatting': true,
        'splitTranscriptAtPhraseEnd': true,
        'backgroundAudioSuppression': 0.5,
        'speechDetectorSensitivity': 0.4,
        'timestamps': true
      };

    logger.debug (params, 'Watson STT engine parameters');

    // Watson Node-SDK supports NodeJS streams, its open source you can
    // see the implementation of the recognize stream here: https://github.com/watson-developer-cloud/node-sdk/blob/master/lib/recognize-stream.ts
    // As a result, we can return recognize stream as our stream for the adapter
    // The idea is your implementation must emit 'data' events that are formatted as Watson results
    // See the WatsonSpeechToText API https://www.ibm.com/watson/developercloud/speech-to-text/api/v1/#recognize_sessionless_nonmp12
    this.recognizeStream = speechToText.recognizeUsingWebSocket(params);

    this.recognizeStream.destroy = () => {
      this.recognizeStream.stop();
    };

    return this.recognizeStream;
  }
  /* eslint-disable class-methods-use-this */
  _read() {}

  _write() {}
}
module.exports = WatsonSpeechToTextEngine;
