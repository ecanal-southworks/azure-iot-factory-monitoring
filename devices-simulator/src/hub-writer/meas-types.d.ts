import { SensorConfig } from 'env-type';

export type Properties = {
    measType: string;
    factoryArea: string;
    machineType: string;
};

export type Contents = {
    value: number;
    timestamp: string;
};

export type Measurement = {
    contents: Contents;
    properties: Properties;
};

export type MeasurementConfig = {
    DEFAULT_PERIOD_MS: number;
    DEFAULT_MAX_SAMPLES: number;
    DEFAULT_MAX_BYTES: number;
};

export type DeviceConfig = {
    DEVICE_ID: string;
    DEVICE_KEY: string;
    IOT_HUB_NAME: string;
    VARIABILITY_FACTOR: number;
    OVERRIDE_SENSOR_CONFIG: SensorConfig[];
    FACTORY_AREA: string;
    MACHINE_TYPE: string;
};
