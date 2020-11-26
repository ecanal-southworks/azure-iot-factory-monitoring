import { DeviceConfig } from "hub-writer/meas-types";

export type Environment = {
    DEVICES: DeviceConfig[];
    MEAS_INPUT_DEFAULTS: MeasParams;
    SENSORS_CONFIG_DEFAULTS: SensorConfig[];
};

export type MeasParams = {
    DEFAULT_PERIOD_MS: number;
    DEFAULT_MAX_SAMPLES: number;
    DEFAULT_MAX_BYTES: number;
};

export type SensorConfig = {
    TYPE: string;
    STATE: Record<SensorState, SensorStateConfig>;
};

export type SensorState = 'STABLE' | 'ALARM';

export type SensorParameter =
    'MEAN_VALUE'
    | 'STEP_MEAN_FACTOR'
    | 'STEP_STD'
    | 'MAX_STEP'
    | 'STATE_DURATION_MEAN'
    | 'STATE_DURATION_STD';

export type SensorStateConfig = Record<SensorParameter, number>;
