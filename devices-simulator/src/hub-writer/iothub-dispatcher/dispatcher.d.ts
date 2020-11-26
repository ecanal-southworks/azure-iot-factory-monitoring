import { Measurement } from '../meas-types';

export interface IDispatcher {
    setUp(): void;
    sendMeasurements(meas: Measurement[]): Promise<void>;
}
