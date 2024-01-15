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
dakotac@solarmonpi:~ $ sudo cat NodeRenogy/relayOnOff.js 
const mqtt = require('mqtt');
const relayControl = require('./relayControl');

const mqttBroker = 'mqtt://homeassistant.local:1883';
const mqttUser = 'user';
const mqttPass = 'password';
const mqttTopic = 'home/battery/relay';

const mqttClient = mqtt.connect(mqttBroker, {
  username: mqttUser,
  password: mqttPass
});

mqttClient.subscribe(mqttTopic);

mqttClient.on('message', (topic, message) => {
  if (topic === mqttTopic) {
    const command = message.toString().toLowerCase();

    if (command === 'on') {
      relayControl.turnOnRelay();
    } else if (command === 'off') {
      relayControl.turnOffRelay();
    }
  }
});

module.exports = mqttClient;