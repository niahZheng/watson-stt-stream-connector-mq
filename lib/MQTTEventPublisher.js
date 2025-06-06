

const mqtt = require('mqtt');
let mqttClient = null;

const LOG_LEVEL = process.env.LOG_LEVEL;
const logger = require('pino')({ level: LOG_LEVEL, name: 'MQTTEventPublisher' });

const EventPublisher = require('./EventPublisher');

class MQTTEventPublisher extends EventPublisher {

   constructor() {
    super();

    let disable_ssl = (process.env.MQTT_BROKER_DISABLE_SLL === 'true');

    let broker_url;
    if (!process.env.MQTT_BROKER_URL.includes("//")){
      if (disable_ssl == false)
        broker_url = "wss://" + process.env.MQTT_BROKER_URL + ":" + process.env.MQTT_BROKER_PORT + process.env.MQTT_BROKER_PATH;
      else
        broker_url = "ws://" + process.env.MQTT_BROKER_URL + ":" + process.env.MQTT_BROKER_PORT + process.env.MQTT_BROKER_PATH;
    }
    else{
      broker_url = process.env.MQTT_BROKER_URL + ":" + process.env.MQTT_BROKER_PORT + process.env.MQTT_BROKER_PATH;
    }

    let username = process.env.MQTT_BROKER_USER_NAME;
    let password = process.env.MQTT_BROKER_PASSWORD;
    let client_id = "mqtt_client_" + Math.floor((Math.random() * 1000) + 1);

    logger.trace('MQTTEventPublisher: broker_url: ' + broker_url);
    logger.trace('MQTTEventPublisher: username: ' + username);
    logger.trace('MQTTEventPublisher: password: ' + password);
    logger.trace('MQTTEventPublisher: client_id: ' + client_id);

    const options = {
        // Clean session
        'clean': true,
        'connectTimeout': 4000,
        // Authentication
        'clientId': client_id,
        'username': username,
        'password': password,
        'keepalive': 30
      }

    mqttClient = mqtt.connect(broker_url, options);

    mqttClient.on("connect", () => {
      logger.debug('MQTTEventPublisher: connected to broker and ready to publish');
    });

    mqttClient.on("error", (error) => {
      logger.debug('MQTTEventPublisher: failed to connect to broker. Error: ' + error);
    });    

    return this;
  }

  /* eslint-disable class-methods-use-this */
  publish(topic, message) {
    logger.debug('MQTTEventPublisher: publishing message: ' + message + ' on topic: ' + topic);
    mqttClient.publish(topic, message);  
  }

  destroy() {
    //  Force the shutdown of the client connection.
    mqttClient.end(true);  
  }
}
module.exports = MQTTEventPublisher;
