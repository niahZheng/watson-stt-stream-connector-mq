
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('stream-connector');
// Function to start a new span
function startSpan(operationName, parentSpan) {
  if (parentSpan) {
    return tracer.withSpan(parentSpan).startSpan(operationName);
  } else {
    return tracer.startSpan(operationName);
  }
}

// Function to end a span
function endSpan(span) {
  span.end();
}

module.exports = {
  startSpan,
  endSpan
};