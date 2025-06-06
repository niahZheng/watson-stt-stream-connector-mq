
const { Duplex } = require('stream');

class SpeechToTextEngine extends Duplex {
  /* eslint-disable class-methods-use-this */
  _read() {}

  _write() {}

  /**
   * Destroys the Speech To Text Engine if a close from the other side occurs
   */
  // eslint-disable-next-line class-methods-use-this
  destroy() {
    throw new Error('not implemented');
  }
}
module.exports = SpeechToTextEngine;
