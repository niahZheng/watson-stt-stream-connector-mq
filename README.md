# Watson STT Stream Connector

The Watson STT Stream Connector is a microservice that provides a streaming server for doing real-time transcriptions. It's designed to integrate with various CCaaS platforms using native APIs. Here is a list of what this server currently supports:

Here is a current list of platforms that this server supports:

- Genesys CX (AudioHook API): The AudioHook spec can be found [here](https://developer.genesys.cloud/devapps/audiohook/).
- WebStreamingAdapter: Used to process a stream initiated from the web streaming client.

## Background

This microservice is part of a larger set of microservices that make up an agent assistant platform.


## Requires
- NodeJS v16 and higher. Go [here](https://nodejs.org/en/download/).
- A Waton STT instance is required to perform the transcriptions. Go [here](https://cloud.ibm.com/docs/speech-to-text?topic=speech-to-text-gettingStarted) to get started.
- This stream connector uses the Watson SDK for Speech To Text found [here](https://github.com/watson-developer-cloud/node-sdk).
- The stream connector publishes all transcription events in real-time to a confgired MQTT broker. To do that the service uses the MQTT client package found [here](https://github.com/mqttjs/MQTT.js).

## Configuration

Configuration is managed through environment variables to ensure flexibility and security. Variables include connection details for the MQTT broker, IBM Watson Machine Learning, and Watsonx.AI credentials. 

### Environment Variables

> Please refer to the .env-example in `watson-stt-stream-connector` for the enviroment variables that need to be added to this repo.

<br>

| Variable Name | Details | Default Value |
|---------------|---------|---------------|
| `WATSON_STT_URL` | Server URL of the Watson STT endpoint used to generate the transcriptions from the inbound audio streams. This URL can be obtained from your Watson STT service instance. | N/A |
| `WATSON_STT_USERNAME` | User name part of the Watson STT credential used when connecting to the broker. | apikey |
| `WATSON_STT_PASSWORD` | Password part of the Watson STT credential used when connecting to the broker. | N/A |
| `WATSON_STT_MODEL` | Speech model used to transcribe audio. | US_NarrowbandModel |
| `WATSON_STT_END_OF_PHRASE_SILENCE_TIME` | Specifies the duration in seconds of the audio pause interval at which the service splits a transcript into multiple events. This is a floating point number. | 2.0 |
| `STREAM_CONNECTOR_API_KEY` |This is the API KEY use to authenticate all inbound connections. The service expects that this api key will be passed in the HTTP request that opens the websocket in the following header: 'x-api-key'. It is up to the person deploying this service to generate a UUID for this value. | N/A |
| `STREAM_ADAPTER_TYPE` | This service is design to support multiple streaming APIs. Currently, the only supported adapters are: 'GenesysAudioHookAdapter' (which is the default) and the 'WebStreamingAdapter'. | GenesysAudioHookAdapter |
| `LOG_LEVEL` | Choices include 'debug', 'fatal', 'error', 'warn', 'info', 'debug', 'trace' or 'silent'. | debug |

**Note that this service is hardcoded in the Docker file to expose and listen on port 8080 which is the default port exposed on IBM Code Engine. If this needs to be changed you will need to modify the Docker file.**

**Note that Genesys CX will not be able to connect to a locally running version of this docker image. The only reason to run locally is for basic testing with a tool like Postman.**

## Build and run on IBM Code Engine

IBM Code Engine is a Docker container service that runs in IBM cloud that can be used to deploy and test this service with Genesys CX. 

### Requirements

These instructions assume that you will use the IBM Container Registry to act as a repository for the images you build locally. IBM Code Engine will pull your stream connector image directly out of the IBM Container Registry. So to follow these instrutions you will need both an IBM Container Registry namespace to be setup and an instance of IBM Code Engine project.

- Go [here](https://cloud.ibm.com/registry/overview) to setup an IBM Container Registry namespace.
- Go [here](https://cloud.ibm.com/codeengine/overview) to setup an IBM Code Engine project.

### Session Started Event

Whenever a new streaming session is established by the CCaaS, one of these events will be published by the service. Here are the details:

- Topic: **agent-assist/session**
- Event:
    ```
    {
      type: 'session_started',
      parameters: {
        session_id: <CCaaS identifier for the session>
        customer_ani: <the caller's/customer's phone number>,
        customer_name: <the customers caller ID if enabled>,
        dnis: <the original phone number that was dialed>
      }
    }
    ```
    **Note that session ID is used to generate the session topic used to publish all related transcription events. This is the ID that relates back to the CCaaS call ID. It will be known to the agent so that the agent assist application knows which topic to subscribe on to receive not only transcription events, but events for all the various agent assist microservices. Also, any microservice that needs to receive transcription events will need to subscribe on this topic and create a new subscription for every session ID that service wishes to receive transcription events for.**

### Transcript Event

This event is published when either an internal channel (agents) or external channel (customers/callers) speaks, followed by a pause (the pause is configurable).

- Topic: **agent-assist/'session id'/transcription**
- Event:
    ```
    {
        type: 'transcription',
        parameters: {
          source: 'internal' or 'external',
          text: <transcript text>,
          seq: sessionState.internalEventCount
        }
    }
    ```
    **Note that the session ID in the topic path is dynamic based on the call session ID (for Genesys this is the conversation ID). This ID is directly accessible by the agent and can be passed into the agent assist widget through the agent dashboard.**

### Session Ended Event

This event is published when the stream connector service is notified by the CCaaS that the call or session has ended. Note that this event is published on the same topic that the transcription events are published on.

- Topic: **agent-assist/'session id'**
- Event:
    ```
    {
      'type': 'session_ended'
    }
    ```

## Important Notes
1. If you are deploying this solution to IBM Code Engine be aware that there is a maximim 10 minute timeout for any websocket connection. That means if you want to run demos beyond 10 minutes you will need to deploy the containers to a dedicated Kubernetes environment that will allow you configure a longer timeout. There is a new **reconnect** message coming to the Genesys AudioHook API that may provide a workaround for this issue. When available we will try to update the code to support it so that IBM Code Engine can be used for production environments.

## License

Apache 2.0

## Developers

- Brian Pulito (brian_pulito@us.ibm.com)
- Kyle Sava (savky@ibm.com)

pm2 link 7b2vat2pyvftkn3 9petwh2t2w5d0hf

pm2 stop 0

pm2 start app.js