module.exports = {
  apps: [{
    name: 'watson-stt-stream-connector',
    script: 'app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: 'log/pm2_error.log',
    out_file: 'log/pm2_out.log',
    merge_logs: true,
    env: {
      NODE_ENV: 'production',
      DEFAULT_SERVER_LISTEN_PORT: 80, // Azure 会提供 PORT 环境变量
      LOG_LEVEL: 'info',
      TELEMETRY: process.env.TELEMETRY || 'false',
      STREAM_ADAPTER_TYPE: 'GenesysAudioHookAdapter',
      
      // Watson STT 相关配置
      WATSON_API_KEY: process.env.WATSON_API_KEY,
      WATSON_INSTANCE_URL: process.env.WATSON_INSTANCE_URL,
      WATSON_MODEL: process.env.WATSON_MODEL || 'en-US_NarrowbandModel',
      
      // MQTT 相关配置
      MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
      MQTT_USERNAME: process.env.MQTT_USERNAME,
      MQTT_PASSWORD: process.env.MQTT_PASSWORD,
      
      // API Key 验证（可选）
      STREAM_CONNECTOR_API_KEY: process.env.STREAM_CONNECTOR_API_KEY || 'SGVsbG8sIEkgYW0gdGhlIEFQSSBrZXkh',
      
      // 其他可选配置
      DEFAULT_AUDIO_HOOK_LISTEN_PORT: 80,
      OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME || 'watson-stt-stream-connector'
    }
  }]
}; 