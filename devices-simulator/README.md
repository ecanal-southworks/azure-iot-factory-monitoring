# Device Simulator

This NodeJS project simulates several devices (engines) and connects them to an IoT Hub. It generates random measurements from two sensors (temperature and power consumption) and sends them to the IoT Hub.

Execute the following steps to initialize the simulator:

1. Install dependencies with: `npm install`
2. Create `src/env.ts` using the `src/env.ts.template` as a base; this template specifies the parameters to use the IoT Hub, as well as some default values for the simulation of measurements.

    *Example configuration:*

    ```Typescript
    export const env: Environment = {
        DEVICES: [
            // Area A
            {
                DEVICE_ID: 'Area-A-PickAndPlaceArmEngine',
                DEVICE_KEY: '[DEVICE-SYMETRIC-KEY-FROM-IOT-HUB]',
                IOT_HUB_NAME: 'sw-factory-iot',
                FACTORY_AREA: 'A',
                MACHINE_TYPE: 'PickAndPlaceArmEngie',
                VARIABILITY_FACTOR: 0,
                OVERRIDE_SENSOR_CONFIG: [ ],
            },
            {
                DEVICE_ID: 'Area-A-ConveyorBeltEngine',
                DEVICE_KEY: '[DEVICE-SYMETRIC-KEY-FROM-IOT-HUB]',
                IOT_HUB_NAME: 'sw-factory-iot',
                FACTORY_AREA: 'A',
                MACHINE_TYPE: 'ConveyorBeltEngine',
                VARIABILITY_FACTOR: 0,
                OVERRIDE_SENSOR_CONFIG: [ ],
            },
            // Area B
            {
                DEVICE_ID: 'Area-B-PickAndPlaceArmEngine',
                DEVICE_KEY: '[DEVICE-SYMETRIC-KEY-FROM-IOT-HUB]',
                IOT_HUB_NAME: 'sw-factory-iot',
                FACTORY_AREA: 'B',
                MACHINE_TYPE: 'PickAndPlaceArmEngie',
                VARIABILITY_FACTOR: 0,
                OVERRIDE_SENSOR_CONFIG: [ ],
            },
            {
                DEVICE_ID: 'Area-B-ConveyorBeltEngine',
                DEVICE_KEY: '[DEVICE-SYMETRIC-KEY-FROM-IOT-HUB]',
                IOT_HUB_NAME: 'sw-factory-iot',
                FACTORY_AREA: 'B',
                MACHINE_TYPE: 'ConveyorBeltEngine',
                VARIABILITY_FACTOR: 0,
                OVERRIDE_SENSOR_CONFIG: [ ],
            },
        ],
        ...
    };
    ```

3. Start the application in development mode with `npm run dev`.
