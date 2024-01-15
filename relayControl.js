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
dakotac@solarmonpi:~ $ sudo cat NodeRenogy/relayControl.js 
const Gpio = require('onoff').Gpio;

class RelayControl {
  constructor(relayPin) {
    // Define the GPIO pin for the relay
    this.relayPin = relayPin;
    
    // Initialize the relay as an output
    this.relay = new Gpio(relayPin, 'out');
  }

  // Function to turn on the relay
  turnOnRelay() {
    this.relay.writeSync(0); // Set GPIO high to turn on the relay
    console.log('Relay turned on');
  }

  // Function to turn off the relay
  turnOffRelay() {
    this.relay.writeSync(1); // Set GPIO low to turn off the relay
    console.log('Relay turned off');
  }
}

// Export an instance of the RelayControl class
module.exports = new RelayControl(17); // Replace 17 with the actual GPIO pin you are using