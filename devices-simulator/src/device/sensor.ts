import { DeviceConfig, Measurement } from 'hub-writer/meas-types';
import { SensorConfig, SensorState } from '../env-type';

export class Sensor {
    private readonly sensorConfig: SensorConfig;

    private readonly MEAS_GENERATION_DEBUG: boolean = false;

    // Last generated measurement value.
    private currentValue: number;

    // Current status (STABLE_STATE or ALARM_STATE) and amount of samples it will last.
    // The sensor is initialized in ALARM_STATE with duration 0 so it swaps to STABLE_STATE on the first iteration.
    private currentState: SensorState = 'STABLE';
    private currentStateDuration: number = 0;

    // Amount of samples generated in the current state, used to calculate when we should switch to the other state.
    private numSamplesGeneratedInCurrentState: number = 0;

    public constructor(config: SensorConfig) {
        this.sensorConfig = config;

        this.swapState('STABLE');

        const sensor = this.sensorConfig.STATE[this.currentState];

        this.currentValue = this.genNormalRandomNumber(sensor.MEAN_VALUE, sensor.STEP_STD);
    }

    public genRandomMeasurement(device: DeviceConfig): Measurement {
        // Increase the amount of samples generated in current state and swap if we reached the state duration.
        this.numSamplesGeneratedInCurrentState++;

        if (this.numSamplesGeneratedInCurrentState >= this.currentStateDuration) {
            this.swapState();
            // eslint-disable-next-line max-len
            if (this.MEAS_GENERATION_DEBUG) console.log(`[device: ${device.DEVICE_ID}] ${this.sensorConfig.TYPE} - Swapped state to ${this.currentState}!`);
        }

        this.currentValue = Math.floor(this.currentValue + this.getStepSize());

        if (this.MEAS_GENERATION_DEBUG) {
            // eslint-disable-next-line max-len
            console.log(`[device: ${device.DEVICE_ID}] ${this.sensorConfig.TYPE} - ${this.currentState} - ${this.numSamplesGeneratedInCurrentState}/${this.currentStateDuration} - ${this.currentValue}`);
        }

        return {
            contents: {
                value: this.currentValue,
                timestamp: new Date().toISOString(),
            },
            properties: {
                measType: this.sensorConfig.TYPE,
                factoryArea: device.FACTORY_AREA,
                machineType: device.MACHINE_TYPE,
            },
        };
    }

    private getStepSize(): number {
        // To generate each sample the sensor uses the previous sample and adds a normally-distributed
        // random step with mean 0.2 * (MEAN_VALUE – PREVIOUS_VALUE) and a predefined standard deviation
        // so the samples are relatively continuous and tend to spread around the state MEAN_VALUE.
        const sensor = this.sensorConfig.STATE[this.currentState];
        const stepMean = sensor.STEP_MEAN_FACTOR * (sensor.MEAN_VALUE - this.currentValue);
        const stepStd = sensor.STEP_STD;

        let stepSize = this.genNormalRandomNumber(stepMean, stepStd);

        stepSize = Math.min(stepSize, sensor.MAX_STEP);
        stepSize = Math.max(stepSize, -sensor.MAX_STEP);

        return stepSize;
    }

    private swapState(targetState?: SensorState) {
        this.currentState = targetState || (this.currentState === 'STABLE' ? 'ALARM' : 'STABLE');
        const sensor = this.sensorConfig.STATE[this.currentState];

        this.numSamplesGeneratedInCurrentState = 0;

        const randomNumber: number = this.genNormalRandomNumber(sensor.STATE_DURATION_MEAN, sensor.STATE_DURATION_STD);
        this.currentStateDuration = Math.floor(randomNumber);
    }

    // Using Box-Muller transform to get a normally-distributed random variable from a uniform-distributed random variable.
    // https://mathworld.wolfram.com/Box-MullerTransformation.html
    private genNormalRandomNumber(mean: number, std: number): number {
        let u = 0;
        let v = 0;

        // We need the variables to be in the range (0, 1) instead of [0, 1).
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();

        return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}
