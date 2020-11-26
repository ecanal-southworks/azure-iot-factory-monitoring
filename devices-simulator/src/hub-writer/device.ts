import { filter, loop, map, periodic, runEffects, tap } from '@most/core';
import { newDefaultScheduler } from '@most/scheduler';
import { Stream } from '@most/types';
import { SensorConfig, SensorParameter, SensorState } from 'env-type';
import { Sensor } from '../device/sensor';
import { Measurement, DeviceConfig, MeasurementConfig } from './meas-types';

import { IoTHubDispatcher } from './iothub-dispatcher/iothub-dispatcher';
import { IDispatcher } from './iothub-dispatcher/dispatcher';

type BufferStatus = {
    seed: Measurement[];
    value: Measurement[] | undefined;
};

export class Device {
    private readonly dispatcher: IDispatcher;
    private readonly device: DeviceConfig;
    private readonly WRITER_DEBUG: boolean = true;
    private readonly sensorsConfig: SensorConfig[];
    private readonly measInput: MeasurementConfig;

    public constructor(deviceConfig: DeviceConfig, defaultSensorConfig: SensorConfig[], measurementInputDefaults: MeasurementConfig) {
        this.device = deviceConfig;
        this.sensorsConfig = this.setSensorsConfig(deviceConfig, defaultSensorConfig);
        this.measInput = measurementInputDefaults;

        // eslint-disable-next-line max-len
        const connectionString = `HostName=${this.device.IOT_HUB_NAME}.azure-devices.net;DeviceId=${this.device.DEVICE_ID};SharedAccessKey=${this.device.DEVICE_KEY}`;

        this.dispatcher = new IoTHubDispatcher(connectionString);
    }

    public setUp(): void {
        this.dispatcher.setUp();
    }

    public async startMeasStream(): Promise<void[]> {
        const streamPromises = [];

        for (const sensorConfig of this.sensorsConfig) {
            // Create a stream with periodic undefined events
            // u-u-u-u->
            const per = periodic(this.measInput.DEFAULT_PERIOD_MS);

            // Add a random measurement to the periodic events
            // p1-p2-p3-p4->
            const measurement = new Sensor(sensorConfig);

            const sampleStream = map(() => measurement.genRandomMeasurement(this.device), per);

            // Accumulate the measurements in arrays
            // u-u-[p1,p2]-u-u-[p3,p4]->
            const accumulatedSamples = loop(
                (seed: Measurement[], value: Measurement) =>
                    this.bufferSamples(seed, value, this.measInput.DEFAULT_MAX_SAMPLES, this.measInput.DEFAULT_MAX_BYTES),
                [],
                sampleStream);

            // Filter out the undefined events
            // [p1,p2]-[p3,p4]->
            const filteredAccumulatedStream: Stream<Measurement[]> = filter(element => !!element, accumulatedSamples);

            // Send each batch of samples to the IoT Hub
            streamPromises.push(runEffects(
                tap(async sampleArray =>
                    this.handleSampleArray(this.device.DEVICE_ID, sampleArray, sensorConfig.TYPE), filteredAccumulatedStream
                ),
                newDefaultScheduler(),
            ));
        }

        return Promise.all(streamPromises);
    }

    private setSensorsConfig(device: DeviceConfig, sensorConfig: SensorConfig[]): SensorConfig[] {
        let sensors = sensorConfig;

        // Checks if the device has any override sensor configuration, if it does then updates the default sensor configuration
        if (device.OVERRIDE_SENSOR_CONFIG.length > 0) {
            const sensorsWithoutOverriden: SensorConfig[] = sensors.filter(sensor =>
                !device.OVERRIDE_SENSOR_CONFIG.find(overrideSensor => overrideSensor.TYPE === sensor.TYPE)
            );
            sensors = [...sensorsWithoutOverriden, ...device.OVERRIDE_SENSOR_CONFIG];
        }

        // Check if the device has any variability factors configured, if so, apply the variation for each sensor's value
        if (!isNaN(device.VARIABILITY_FACTOR) && device.VARIABILITY_FACTOR !== 0) {
            sensors = sensors.reduce((sensorConfigArray: SensorConfig[], config: SensorConfig) => {
                Object.keys(config.STATE).map(state => {
                    const sensorState = config.STATE[state as SensorState];

                    // Modify the parameters of each sensor using the variability factor
                    Object.keys(sensorState).map(parameter => {
                        sensorState[parameter as SensorParameter] = sensorState[parameter as SensorParameter] * device.VARIABILITY_FACTOR;
                    });
                });

                /* eslint-disable-next-line no-param-reassign */
                return sensorConfigArray = [...sensorConfigArray, config];
            }, []);
        }

        return sensors;
    }

    // Receive a stream of events and return a stream with batches of measurements to send
    // Until the batch is ready to be sent, undefined events are sent instead
    private bufferSamples(batch: Measurement[], newSample: Measurement, maxSamples: number, maxBytes: number): BufferStatus {
        // If adding this sample would surpass the byte limit or the sample corresponds to the next
        // minute we send the array as-is and leave this sample for the next batch
        if (JSON.stringify(batch.concat(newSample)).length > maxBytes) {
            return { seed: [newSample], value: batch };
        }

        batch.push(newSample);

        // If we have reached the maximum amount of samples in the batch, we send it and reset the batch status
        // Otherwise we update the array and send undefined events while the batch is growing
        if (batch.length >= maxSamples) {
            return { seed: [], value: batch };
        } else {
            return { seed: batch, value: undefined };
        }
    }

    // Send a batch of measurements using the dispatcher
    private async handleSampleArray(deviceId: string, batch: Measurement[], measType: string): Promise<void> {
        if (!batch) return;

        if (this.WRITER_DEBUG) console.log(`[device: ${deviceId}] ${measType} - Sending ${batch.length} samples`);

        await this.dispatcher.sendMeasurements(batch);
    }
}
