import { Message, RetryPolicy } from 'azure-iot-common';
import { Client } from 'azure-iot-device';
import { Mqtt as Protocol } from 'azure-iot-device-mqtt';

// const MESSAGE_EXPIRATION_TIME_MS = 60 * 1000; // 1 minute
const DEFAULT_RETRY_AFTER_MS = 20 * 1000; // 20 seconds
const RETRY_AFTER_MS_BASE = 10 * 1000; // 10 seconds
const BACKOFF_FACTOR = 1.2;

export class AzIoTHubClient {
    private readonly client: Client;

    private readonly TELEMETRY_DEBUG: boolean = false;

    public constructor(connectionString: string) {
        this.client = Client.fromConnectionString(connectionString, Protocol);

        const retryPolicy = {
            shouldRetry: (error: Error) => {
                // Decide depending on the error if you would like to retry or not - should return true or false.
                console.error(error);

                return true;
            },
            nextRetryTimeout: (retryCount, throttled) =>
                // Returns an integer that is the number of ms to wait before the next retry
                // based on the current count of retries (retryCount)
                // and if the IoT Hub is asking clients to throttle their calls (throttled, boolean)
                throttled
                    ? Math.round(RETRY_AFTER_MS_BASE * (BACKOFF_FACTOR ** (retryCount || 1)))
                    : DEFAULT_RETRY_AFTER_MS,

        } as RetryPolicy;

        // Custom retry policy
        this.client.setRetryPolicy(retryPolicy);
    }

    public setUp(): void {
        this.client.open(() => {
            // Set up error handler
            this.client.on('error', error => {
                console.error('IoT Hub client produced an error: ', error);
            });

            // Set up disconnect handler
            this.client.on('disconnect', () => {
                console.error('Client was disconnected');
            });
        });
    }

    // Send a telemetry package with the requested payload and properties
    public sendTelemetry(payload: string, properties: Record<string, string>): void {
        if (this.TELEMETRY_DEBUG) console.log('Sending telemetry package: ', payload, properties);

        const telemetryMessage = new Message(payload);

        // Adding the custom properties to the telemetry package
        for (const [key, value] of Object.entries(properties)) {
            telemetryMessage.properties.add(key, value);
        }

        // Send a sample telemetry event
        this.client.sendEvent(telemetryMessage, error => {
            if (error) console.error('Encountered an error when sending the telemetry package: ', error);
            else if(this.TELEMETRY_DEBUG) console.log('Message sent: ', JSON.stringify(telemetryMessage, undefined, 4));
        });
    }
}
