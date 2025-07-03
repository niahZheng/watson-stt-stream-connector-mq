module.exports = {
  apps: [{
    name: 'watson-stt-stream-connector',
    script: './lib/StreamConnectorServer.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: process.env.PORT || 8080,
      LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
      TELEMETRY: process.env.TELEMETRY || 'false',
      
      // Watson STT Configuration
      WATSON_API_KEY: process.env.WATSON_API_KEY,
      WATSON_INSTANCE_URL: process.env.WATSON_INSTANCE_URL,
      WATSON_MODEL: process.env.WATSON_MODEL || 'en-US_NarrowbandModel',
      
      // MQTT Configuration
      MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
      MQTT_USERNAME: process.env.MQTT_USERNAME,
      MQTT_PASSWORD: process.env.MQTT_PASSWORD,
      
      // Stream Connector Configuration
      STREAM_CONNECTOR_API_KEY: process.env.STREAM_CONNECTOR_API_KEY || 'SGVsbG8sIEkgYW0gdGhlIEFQSSBrZXkh',
      STREAM_ADAPTER_TYPE: process.env.STREAM_ADAPTER_TYPE || 'GenesysAudioHookAdapter',
      
      // OpenTelemetry Configuration
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME || 'watson-stt-stream-connector'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 8080,
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      TELEMETRY: process.env.TELEMETRY || 'true',
      
      // Watson STT Configuration
      WATSON_API_KEY: process.env.WATSON_API_KEY,
      WATSON_INSTANCE_URL: process.env.WATSON_INSTANCE_URL,
      WATSON_MODEL: process.env.WATSON_MODEL || 'en-US_NarrowbandModel',
      
      // MQTT Configuration
      MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
      MQTT_USERNAME: process.env.MQTT_USERNAME,
      MQTT_PASSWORD: process.env.MQTT_PASSWORD,
      
      // Stream Connector Configuration
      STREAM_CONNECTOR_API_KEY: process.env.STREAM_CONNECTOR_API_KEY || 'SGVsbG8sIEkgYW0gdGhlIEFQSSBrZXkh',
      STREAM_ADAPTER_TYPE: process.env.STREAM_ADAPTER_TYPE || 'GenesysAudioHookAdapter',
      
      // OpenTelemetry Configuration
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME || 'watson-stt-stream-connector'
    },
    // PM2 Process Management Configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 8000,
    shutdown_with_message: true,
    
    // Logging Configuration
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Health Check
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }]
}; 