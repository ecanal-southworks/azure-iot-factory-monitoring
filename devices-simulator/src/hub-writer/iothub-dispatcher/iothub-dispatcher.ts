import { Measurement } from '../meas-types';
import { IDispatcher } from './dispatcher';
import { AzIoTHubClient } from './iot-hub-client';

export class IoTHubDispatcher implements IDispatcher {
    private readonly client: AzIoTHubClient;

    public constructor(connectionString: string) {
        this.client = new AzIoTHubClient(connectionString);
    }

    public setUp(): void {
        return this.client.setUp();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async sendMeasurements(meas: Measurement[]): Promise<void> {
        this.client.sendTelemetry(JSON.stringify(meas.map(m => m.contents)), meas[0].properties);
    }
}
