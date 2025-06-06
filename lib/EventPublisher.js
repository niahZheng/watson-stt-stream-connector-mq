
class EventPublisher {
  /* eslint-disable class-methods-use-this */
  publish(topic, message, parentSpanCtx) {}

  /**
   * Destroys the Event Publisher if a close from the other side occurs
   */
  // eslint-disable-next-line class-methods-use-this
  destroy() {
    throw new Error('not implemented');
  }
}
module.exports = EventPublisher;