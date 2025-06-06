const { startSpan } = require('./spanUtils');

// Start the parent span
const parentSpan = startSpan('receive-audio-stream');

// Pass the parent span to other modules
module.exports = { parentSpan };