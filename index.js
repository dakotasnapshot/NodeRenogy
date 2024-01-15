#!/usr/bin/env node
const cli = require('./cli');
const mqtt = require('./mqtt');
const renogy = require('./renogy');
const logger = require('./logger');

async function main() {
    logger.info('Starting NodeRenogy...');

    try {
        const args = cli.args;
        logger.trace(args, 'With arguments...');
        await renogy.begin();

        const controllerInfo = await renogy.getControllerInfo();
        logger.trace(controllerInfo, 'Controller Info...');

        if (args.mqttbroker) {
            await mqtt.publish(controllerInfo, 'device');
        }

        setInterval(async () => {
            try {
                const result = await renogy.getData();

                if (args.mqttbroker) {
                    await mqtt.publish(result, 'state');
                } else {
                    logger.trace('No MQTT broker specified!');
                    console.log(result);
                }
            } catch (error) {
                logger.error('Error in data polling:', error);
                // Add more context or details if needed
            }
        }, args.pollinginterval * 1000);
    } catch (error) {
        logger.error('Error in main:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, you can throw the error or handle it here.
});

main();
