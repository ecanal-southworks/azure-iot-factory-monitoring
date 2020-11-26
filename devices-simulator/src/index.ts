import { DeviceConfig, MeasurementConfig } from 'hub-writer/meas-types';
import { SensorConfig } from 'env-type';
import { Device } from './hub-writer/device';
import { env } from './env';

void (async () => {
    const measurementInputDefaults: MeasurementConfig = env.MEAS_INPUT_DEFAULTS;
    const devicesConfig: DeviceConfig[] = env.DEVICES;
    const defaultSensorConfig: SensorConfig[] = env.SENSORS_CONFIG_DEFAULTS;
    const measurementPromises = [];

    for(const deviceConfig of devicesConfig) {

        const device = new Device(deviceConfig, defaultSensorConfig, measurementInputDefaults);

        device.setUp();

        measurementPromises.push(device.startMeasStream());
    }

    await Promise.all(measurementPromises);
})();
