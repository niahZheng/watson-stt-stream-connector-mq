const celery = require('celery-node');

const LOG_LEVEL = process.env.LOG_LEVEL;
const logger = require('pino')({ level: LOG_LEVEL, name: 'CeleryEventPublisher' });

const { trace, SpanKind, context } = require('@opentelemetry/api');

const tracer = trace.getTracer('GenesysAudioHookAdapter');

const EventPublisher = require('./EventPublisher');

class CeleryEventPublisher extends EventPublisher {

   constructor() {
    super();

    // TODO: take proper env vars
    const rabbitUrl = process.env.AAN_AMQP_URI || 'amqp://rxadmin:rxadmin321@20.39.130.141:5672';
    const redisUrl = process.env.AAN_REDIS_URI || `rediss://default:${process.env.REDIS_PASSWORD}@rx-redis.redis.cache.windows.net:6380/1?ssl=true`
    
    // 添加 Celery 配置选项
    const celeryOptions = {
      connectTimeout: 10000,
      heartbeat: 30,
      retry: true,
      retryMaxTimes: 10,
      retryDelay: 1000,
      // 添加 RabbitMQ 特定配置
      exchange: {
        name: 'default',
        type: 'direct',
        auto_delete: false,  // 使用下划线格式
        durable: true
      },
      queue: {
        auto_delete: false,  // 使用下划线格式
        durable: true
      }
    };
    
    this.client = celery.createClient(
        rabbitUrl, 
        redisUrl, 
        celeryOptions
    );

    // 设置 Celery 配置
    this.client.conf.TASK_PROTOCOL = 1;
    this.client.conf.TASK_SERIALIZER = 'json';
    this.client.conf.RESULT_SERIALIZER = 'json';
    this.client.conf.ACCEPT_CONTENT = ['json'];
    this.client.conf.TASK_QUEUE_MAX_PRIORITY = 10;
    this.client.conf.TASK_DEFAULT_PRIORITY = 5;
    this.client.conf.TASK_DEFAULT_QUEUE = 'default';
    this.client.conf.TASK_DEFAULT_EXCHANGE = 'default';
    this.client.conf.TASK_DEFAULT_EXCHANGE_TYPE = 'direct';
    this.client.conf.TASK_DEFAULT_ROUTING_KEY = 'default';
    this.client.conf.TASK_DEFAULT_DELIVERY_MODE = 2;  // 持久化
    this.client.conf.TASK_DEFAULT_AUTO_DELETE = false;

    // name of the celery task
    this.task = this.client.createTask("aan_extensions.DispatcherAgent.tasks.process_transcript");
    logger.debug('CeleryEventPublisher: established celery client');
    return this;
  }

  /* eslint-disable class-methods-use-this */
  publish(topic, message, parentSpanCtx) {
    logger.debug('CeleryEventPublisher: publishing message: ' + message + ' on topic: ' + topic);
    // mqttClient.publish(topic, message);
    // const span = tracer.startSpan('CeleryEventPublisher', parentSpanCtx)
    // this.task.applyAsync([topic, message])
    // span.end()
    const execTask = this.task.applyAsync
    const taskInput = [topic, message]
    tracer.startActiveSpan('CeleryEventPublisher.send_celery',  {kind: SpanKind.PRODUCER} ,parentSpanCtx, (span) => {
      logger.debug('send_celery context ')
      logger.debug(parentSpanCtx)
      logger.debug(span._spanContext)
      logger.debug(span.parentSpanId)
      //console.log(execTask)
      //context.with(parentSpanCtx, execTask, this, taskInput)
      this.task.applyAsync([topic, message])
      span.end();
    });

  }

  destroy() {
    //  Force the shutdown of the client connection.
    this.client.disconnect()  
  }
}
module.exports = CeleryEventPublisher;
