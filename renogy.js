const cli = require('./cli');
const logger = require('./logger');
const ModbusRTU = require("modbus-serial");
const mqtt = require('mqtt');
const relayControl = require('./relayControl');
const relayOnOff = require('./relayOnOff');

const modbusClient = new ModbusRTU();
const mqttClient = mqtt.connect(`mqtt://${process.env.NODERENOGY_MQTTBROKER}`, {
    username: process.env.NODERENOGY_MQTTUSER,
    password: process.env.NODERENOGY_MQTTPASS
});

const dataStartRegister = 0x100;
const numDataRegisters = 30;
const infoStartRegister = 0x00A;
const numInfomRegisters = 17;

const args = cli.args;

const renogyBattValues = {
    setData: function(rawData) {
        if (!rawData || rawData.length !== numDataRegisters) {
            logger.error('Invalid or incomplete data received from the controller.');
            return;
        }

        this.battCap = rawData[0];
        this.battV = (rawData[1] * 0.1).toFixed(2);
        this.battC = (rawData[2] * 0.01).toFixed(2);

        // Add the following lines to include additional properties in the payload
        this.battT = rawData[3];
        this.controlT = rawData[4];
        this.loadV = (rawData[5] * 0.1).toFixed(2);
        this.loadC = (rawData[6] * 0.01).toFixed(2);
        this.loadP = rawData[7];
        this.solarV = (rawData[8] * 0.1).toFixed(2);
        this.solarC = (rawData[9] * 0.01).toFixed(2);
        this.solarP = rawData[10];
        this.battVMinToday = (rawData[11] * 0.1).toFixed(2);
        this.battVMaxToday = (rawData[12] * 0.1).toFixed(2);
        this.chgCMaxToday = (rawData[13] * 0.01).toFixed(2);
        this.dischgCMaxToday = (rawData[14] * 0.1).toFixed(2);
        this.chgPMaxToday = (rawData[15]).toFixed(2);
        this.dischgPMaxToday = (rawData[16]).toFixed(2);
        this.chgAHToday = (rawData[17]).toFixed(2);
        this.dischgAHToday = (rawData[18]).toFixed(2);
        this.chgWHToday = (rawData[19]).toFixed(2);
        this.dischgWHToday = (rawData[20]).toFixed(2);
        this.uptime = rawData[21];
        this.totalBattOvercharge = rawData[22];
        this.totalBattFullCharges = rawData[23];

        this.checkBatteryLevel();
    },
    checkBatteryLevel: function() {
        const newStatus = this.battCap < 30 ? 'off' : 'on';
        mqttClient.publish(process.env.NODERENOGY_BATTCAP_TOPIC, newStatus);
        mqttClient.publish(process.env.NODERENOGY_RELAY_STATUS_TOPIC, newStatus);
    }
};

const controllerInfo = {
    setData: function(rawData) {
        if (!rawData || rawData.length !== numInfomRegisters) {
            logger.error('Invalid or incomplete information received from the controller.');
            return;
        }

        const x0a = Buffer.alloc(2);
        x0a.writeInt16BE(rawData[0]);
        this.controllerV = x0a[0];
        this.controllerC = x0a[1];

        const x0b = Buffer.alloc(2);
        x0b.writeInt16BE(rawData[1]);
        this.controllerDischgC = x0b[0];
        this.controllerType = x0b[1] == 0 ? 'Controller' : 'Inverter';

        let modelString = '';
        for (let i = 0; i <= 7; i++) {
            rawData[i + 2].toString(16).match(/.{1,2}/g).forEach(x => {
                modelString += String.fromCharCode(parseInt(x, 16));
            });
        }
        this.controllerModel = modelString.replace(' ', '');

        const x14 = Buffer.alloc(4);
        x14.writeInt16BE(rawData[10]);
        x14.writeInt16BE(rawData[11], 2);
        this.softwareVersion = `V${x14[1]}.${x14[2]}.${x14[3]}`;

        const x16 = Buffer.alloc(4);
        x16.writeInt16BE(rawData[12]);
        x16.writeInt16BE(rawData[13], 2);
        this.hardwareVersion = `V${x16[1]}.${x16[2]}.${x16[3]}`;

        let serialHex = rawData[14].toString(16);
        serialHex += rawData[15].toString(16);
        this.serialNumber = parseInt(serialHex, 16);

        this.controllerAddress = rawData[16];
    }
};

async function readController(startRegister, numRegisters) {
    try {
        if (!modbusClient.isOpen) {
            await module.exports.begin();
        }

        if (modbusClient.isOpen) {
            logger.trace('Reading Modbus registers...');
            let data = await modbusClient.readHoldingRegisters(startRegister, numRegisters);
            logger.trace(data, 'Full Modbus response:');

            if (data && data.data) {
                logger.trace(data.data, 'Raw data from controller:');
                return data.data;
            } else {
                logger.error('Invalid or empty Modbus response:', data);
                return [];
            }
        } else {
            logger.error('Modbus client is not open.');
            return [];
        }
    } catch (e) {
        logger.error('Error in data polling:', e);
        return [];
    }
}

module.exports = {
    begin: async function() {
        logger.trace('Connecting to controller...');
        try {
            modbusClient.setTimeout(1500);
            await modbusClient.connectRTUBuffered(args.serialport, { baudRate: args.baudrate });
            logger.info('Connected to controller!');
        } catch (e) {
            logger.error(e);
            throw e;
        }
    },
    getData: async function() {
        logger.trace('Getting data from controller...');
        try {
            const rawData = await readController(dataStartRegister, numDataRegisters);
            if (rawData.length > 0) {
                renogyBattValues.setData(rawData);
            }
            return renogyBattValues;
        } catch (error) {
            logger.error('Error in data polling:', error);
            return renogyBattValues;
        }
    },

    getControllerInfo: async function() {
        logger.trace('Getting information about controller...');
        try {
            const rawData = await readController(infoStartRegister, numInfomRegisters);
            if (rawData.length > 0) {
                controllerInfo.setData(rawData);
            }
            return controllerInfo;
        } catch (error) {
            logger.error('Error in information polling:', error);
            return controllerInfo;
        }
    },
    relayOnOff: relayOnOff
};
