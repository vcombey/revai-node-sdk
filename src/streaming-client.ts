import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { Duplex, PassThrough } from 'stream';
import { w3cwebsocket, connection, Message, ICloseEvent } from 'websocket';

import { AudioConfig } from './models/streaming/AudioConfig';
import { BufferedDuplex } from './models/streaming/BufferedDuplex';
import { SessionConfig } from './models/streaming/SessionConfig';
import {
    StreamingConnected,
    StreamingHypothesis,
    StreamingResponse
} from './models/streaming/StreamingResponses';

// tslint:disable-next-line
const sdkVersion = require('../package.json').version;

/**
 * Client which handles a streaming connection to the Rev AI API.
 * @event httpResponse emitted when the client fails to start a websocket connection and
 *      receives an http response. Event contains the http status code of the response.
 * @event connectFailed emitted when the client fails to begin a websocket connection and
 *      received a websocket error. Event contains the received error.
 * @event connect emitted when the client receives a connected message from the API. Contains
 *      the StreamingConnected returned from the API.
 * @event close emitted when the connection is properly closed by the server. Contains the
 *      close code and reason.
 * @event error emitted when an error occurs in the connection to the server. Contains the
 *      thrown error.
 */
export class RevAiStreamingClient extends EventEmitter {
    baseUrl: string;
    client: w3cwebsocket;
    private streamsClosed: boolean;
    private accessToken: string;
    private config: AudioConfig;
    private requests: PassThrough;
    private responses: PassThrough;
    private protocol: Duplex;

    /**
     * @param accessToken Access token associated with the user's account
     * @param config Configuration of the audio the user will send from this client
     * @param version (optional) Version of the Rev AI API the user wants to use
     */
    constructor(accessToken: string, config: AudioConfig, version = 'v1', sessionConfig?: SessionConfig) {
        super();
        this.streamsClosed = false;
        this.accessToken = accessToken;
        this.config = config;
        this.baseUrl = `wss://api.rev.ai/speechtotext/${version}/stream`;
        this.requests = new PassThrough({ objectMode: true });
        this.responses = new PassThrough({ objectMode: true });
        this.protocol = new BufferedDuplex(this.requests, this.responses, {
            readableObjectMode: true,
            writableObjectMode: true
        });
        this.setupWebsocket(sessionConfig)
        this.setUpHttpResponseHandler();
        this.setUpConnectionFailureHandler();
        this.setUpConnectedHandlers();
    }

    public setupWebsocket(config?: SessionConfig) {
        let url = this.baseUrl +
            `?access_token=${this.accessToken}` +
            `&content_type=${this.config.getContentTypeString()}` +
            `&user_agent=${encodeURIComponent(`RevAi-NodeSDK/${sdkVersion}`)}`;
        if (config) {
            if (config.metadata) {
                url += `&metadata=${encodeURIComponent(config.metadata)}`;
            }
            if (config.customVocabularyID) {
                url += `&custom_vocabulary_id=${encodeURIComponent(config.customVocabularyID)}`;
            }
            if (config.filterProfanity) {
                url += '&filter_profanity=true';
            }
            if (config.removeDisfluencies) {
                url += '&remove_disfluencies=true';
            }
            if (config.deleteAfterSeconds !== null && config.deleteAfterSeconds !== undefined) {
                url += `&delete_after_seconds=${encodeURIComponent(config.deleteAfterSeconds.toString())}`;
            }
            if (config.detailedPartials) {
                url += '&detailed_partials=true';
            }
            if (config.startTs !== null && config.startTs !== undefined) {
                url += `&start_ts=${encodeURIComponent(config.startTs.toString())}`;
            }
            if (config.transcriber) {
                url += `&transcriber=${encodeURIComponent(config.transcriber)}`;
            }
            if (config.language) {
                url += `&language=${encodeURIComponent(config.language)}`;
            }
        }
        this.client = new w3cwebsocket(url, undefined, undefined, undefined,
            {
                // @ts-ignore
                keepalive: true,
                keepaliveInterval: 30000
            }, undefined
        );

    }
    /**
     * Begins a streaming connection. Returns a duplex
     * from which the user can read responses from the api and to which the user
     * should write their audio data
     * @param config (Optional) Optional configuration for the streaming session
     *
     * @returns BufferedDuplex. Data written to this buffer will be sent to the api
     * Data received from the api can be read from this duplex
     */
    public start(): Duplex {
        return this.protocol;
    }

    /**
     * Signals to the api that you have finished sending data.
     */
    public end(): void {
        this.protocol.end('EOS', 'utf8');
    }

    /**
     * Immediately kills the streaming connection, no more results will be returned from the API
     * after this is called.
     */
    public unsafeEnd(): void {
        this.client.close();
        this.closeStreams();
    }

    private setUpHttpResponseHandler(): void {
        // this.client.on('httpResponse', (response: IncomingMessage) => {
        //     this.emit('httpResponse', response.statusCode);
        //     this.closeStreams();
        // });
    }

    private setUpConnectionFailureHandler(): void {
        // this.client.on('connectFailed', (error: Error) => {
        //     this.emit('connectFailed', error);
        //     this.closeStreams();
        // });
    }

    private setUpConnectedHandlers(): void {
        this.client.onopen = function() {
            console.log('WebSocket Client Connected');
            this.doSendLoop();
        };

        this.client.onmessage = function(e) {
            if (this.streamsClosed) {
                return;
            }
            if (typeof e.data === 'string') {
                console.log("Received: '" + e.data + "'");
                const message = JSON.parse(e.data)
                if (message.type === 'utf8') {
                    let response = JSON.parse(message.utf8Data);
                    if ((response as StreamingResponse).type === 'connected') {
                        this.emit('connect', response as StreamingConnected);
                    } else if (this.responses.writable) {
                        this.responses.write(response as StreamingHypothesis);
                    }
                }
            }
        };
        // this.client.onclose((c: ICloseEvent) => {
        //     this.emit('close', c.code, c.reason);
        //     this.closeStreams();
        // })

        // this.doSendLoop(conn);
        // this.client.onopen = function() {
        //     console.log('WebSocket Client Connected');

        //     function sendNumber() {
        //         if (client.readyState === client.OPEN) {
        //             var number = Math.round(Math.random() * 0xFFFFFF);
        //             client.send(number.toString());
        //             setTimeout(sendNumber, 1000);
        //         }
        //     }
        //     sendNumber();
        // };


        // this.client.on('connect', (conn: connection) => {
        //     conn.on('error', (error: Error) => {
        //         this.emit('error', error);
        //         this.closeStreams();
        //     });
        //     conn.on('close', (code: number, reason: string) => {
        //         this.emit('close', code, reason);
        //         this.closeStreams();
        //     });
        //     conn.on('message', (message: Message) => {
        //         if (this.streamsClosed) {
        //             return;
        //         }
        //         if (message.type === 'utf8') {
        //             let response = JSON.parse(message.utf8Data);
        //             if ((response as StreamingResponse).type === 'connected') {
        //                 this.emit('connect', response as StreamingConnected);
        //             } else if (this.responses.writable) {
        //                 this.responses.write(response as StreamingHypothesis);
        //             }
        //         }
        //     });
        //     this.doSendLoop(conn);
        // });
    }

    private doSendLoop(): void {
        if (this.client.readyState === this.client.OPEN) {
            const value = this.requests.read();
            if (value !== null) {
                this.client.send(value);
            }
            setTimeout(() => this.doSendLoop(), 100);
        }
    }

    private closeStreams(): void {
        if (!this.streamsClosed) {
            this.streamsClosed = true;
            this.protocol.end();
            this.requests.end();
            this.responses.push(null);
        }
    }
}
