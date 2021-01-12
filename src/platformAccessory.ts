/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { BreezartHomebridgePlatform } from './platform';

import BreezartClient from 'breezart-client';

/**
 * Breezart Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class BreezartPlatformAccessory {
  private service: Service;
  private hQService: Service;
  private fService: Service;

  private breezart: BreezartClient;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private deviceStates = {
    active: 1,
    rotationSpeed: 60,
    currentTemperature: 24.4,
    mode: 1, // mode = 4 - heating/cooling is off
    currentHeaterCoolerState: 0,
    heatingThresholdTemperature: 24.0,
    filterChange: 0, // 0/1
    filterLifeLevel: 4, // 4%
  };

  constructor(
    private readonly platform: BreezartHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Breezart')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');
    
    // get the Fanv2 service if it exists, otherwise create a new Fanv2 service
    this.service = this.accessory.getService(this.platform.Service.Fanv2) ||
      this.accessory.addService(this.platform.Service.Fanv2);
    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
    // register handlers for the Active state
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setActive.bind(this))
      .on('get', this.getActive.bind(this));
    // register handlers for the Rotation Speed
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .on('set', this.setRotationSpeed.bind(this))
      .on('get', this.getRotationSpeed.bind(this));

    // Register Heater Cooler service
    // register the Current Temperature
    this.hQService = this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler, accessory.context.device.name + ' Mode');
    // register handlers for the Active state (Breezart Mode)
    this.hQService.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setModeActive.bind(this))
      .on('get', this.getModeActive.bind(this));
    this.hQService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));
    this.hQService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .on('get', this.getCurrentHeaterCoolerState.bind(this));
    this.hQService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .on('set', this.setTargetHeaterCoolerState.bind(this))
      .on('get', this.getTargetHeaterCoolerState.bind(this));
    this.hQService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .on('set', this.setHeatingThresholdTemperature.bind(this))
      .on('get', this.getHeatingThresholdTemperature.bind(this));
    
    // Register Filter Maintaince service
    this.fService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
      this.accessory.addService(this.platform.Service.FilterMaintenance, accessory.context.device.name + ' Filter');
    this.fService.getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
      .on('get', this.getFilterChangeIndication.bind(this));
    this.fService.getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
      .on('get', this.getFilterLifeLevel.bind(this));
    // TODO: Reset filter indications https://developers.homebridge.io/#/characteristic/ResetFilterIndication
      
    
    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    // this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    // this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.On)
    //   .on('set', this.setOn.bind(this))                // SET - bind to the `setOn` method below
    //   .on('get', this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.Brightness)
    //   .on('set', this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below


    /**
     * Creating multiple services of the same type.
     * 
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     * 
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    /**
     * Updating characteristics values asynchronously.
     * 
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     * 
     */
    this.initBreezartClient(accessory.context.device);


    // let motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
    //   this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 100000);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  // setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

  //   // implement your own code to turn your device on/off
  //   this.deviceStates.On = value as boolean;

  //   this.platform.log.debug('Set Characteristic On ->', value);

  //   // you must call the callback function
  //   callback(null);
  // }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  // getOn(callback: CharacteristicGetCallback) {

  //   // implement your own code to check if the device is on
  //   const isOn = this.deviceStates.On;

  //   this.platform.log.debug('Get Characteristic On ->', isOn);

  //   // you must call the callback function
  //   // the first argument should be null if there were no errors
  //   // the second argument should be the value to return
  //   callback(null, isOn);
  // }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  // setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

  //   // implement your own code to set the brightness
  //   this.deviceStates.Brightness = value as number;

  //   this.platform.log.debug('Set Characteristic Brightness -> ', value);

  //   // you must call the callback function
  //   callback(null);
  // }

  getActive(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	1
    const isActive = this.deviceStates.active;
    this.platform.log.debug('Get Characteristic Active ->', isActive);
    callback(null, isActive);
  }

  setActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.deviceStates.active = value as number;
    this.platform.log.debug('Set Characteristic Active ->', value);
    callback(null);
  }

  getRotationSpeed(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	100
    // Min Step	1
    const rotationSpeed = this.deviceStates.rotationSpeed * 10;
    this.platform.log.debug('Get Characteristic RotationSpeed ->', rotationSpeed);
    callback(null, rotationSpeed);
  }

  setRotationSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    
    this.deviceStates.rotationSpeed = Math.round(value as number / 10);
    this.platform.log.debug('Set Characteristic RotationSpeed ->', value);
    callback(null);
  }

  getCurrentTemperature(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	100
    // Min Step	0.1
    const currentTemperature = this.deviceStates.currentTemperature;
    this.platform.log.debug('Get Characteristic CurrentTemperature ->', currentTemperature);
    callback(null, currentTemperature);
  }

  getModeActive(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	1
    let modeActive = this.platform.Characteristic.Active.ACTIVE;
    if (this.deviceStates.mode === 4) {
      modeActive = this.platform.Characteristic.Active.INACTIVE;
    }

    this.platform.log.debug('Get Characteristic modeActive ->', modeActive);
    callback(null, modeActive);
  }

  setModeActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    if (value !== this.deviceStates.mode) {
      if (value === this.platform.Characteristic.Active.INACTIVE) {
        this.deviceStates.mode = 4;
        this.platform.log.debug('Set Characteristic modeActive ->', this.deviceStates.mode);
      }
    }
    callback(null);
  }

  getCurrentHeaterCoolerState(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	3
    let currentHeaterCoolerState;
    switch (this.deviceStates.currentHeaterCoolerState) {
      case 0:
        currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        break;
      case 1:
        currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        break;
      case 2:
        currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        break;
      case 3:
        currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        break;
      case 4:
        currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        break;
      default:
        currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        break;
    }
    this.platform.log.debug('Get Characteristic currentHeaterCoolerState ->', currentHeaterCoolerState);
    callback(null, currentHeaterCoolerState);
  }

  getTargetHeaterCoolerState(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	2
    const mode = this.deviceStates.mode;
    let targetHeaterCoolerState;
    switch (mode) {
      case 1:
        targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        break;
      case 2:
        targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
        break;
      default:
        targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        break;
    }
    this.platform.log.debug('Get Characteristic targetHeaterCoolerState ->', targetHeaterCoolerState);
    callback(null, targetHeaterCoolerState);
  }

  setTargetHeaterCoolerState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    switch (value as number) {
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        this.deviceStates.mode = 1;
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        this.deviceStates.mode = 2;
        break;
      default:
        this.deviceStates.mode = 3;
        break;
    }
    this.platform.log.debug('Set Characteristic targetHeaterCoolerState ->', value);
    callback(null);
  }
  
  getHeatingThresholdTemperature(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	25
    // Min Step	0.1
    const targetTemperature = this.deviceStates.heatingThresholdTemperature;
    this.platform.log.debug('Get Characteristic heatingThresholdTemperature ->', targetTemperature);
    callback(null, targetTemperature);
  }
  
  setHeatingThresholdTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const temp = Math.round(value as number);
    this.deviceStates.heatingThresholdTemperature = temp;
    this.platform.log.debug('Set Characteristic heatingThresholdTemperature ->', value);
    callback(null);
  }
  
  getFilterChangeIndication(callback: CharacteristicGetCallback) {
    const filterChange = this.deviceStates.filterChange;
    this.platform.log.debug('Get Characteristic filterChange ->', filterChange);
    callback(null, filterChange);
  }

  getFilterLifeLevel(callback: CharacteristicGetCallback) {
    let filterLifeLevel;
    if (this.deviceStates.filterLifeLevel === 255 || this.deviceStates.filterLifeLevel === null) {
      // it's like undefined
      filterLifeLevel = 0;
    } else {
      filterLifeLevel = this.deviceStates.filterLifeLevel > 100 ? 100 : this.deviceStates.filterLifeLevel;
    }
    this.platform.log.debug('Get Characteristic filterChange ->', filterLifeLevel);
    callback(null, filterLifeLevel);
  }

  /**
   * Connet to Breezart device and init polling
   */
  initBreezartClient(options) {
    this.platform.log.debug('initBreezartClient');
    const connectionOptions = {
      host: options.host as string,
      port: options.port as number,
      password: options.password as number,
    };

    this.breezart = new BreezartClient(connectionOptions);

    // then Breezart was connected 
    this.breezart.on('connect', () => {
      this.platform.log.debug('Connection established', options.name);
      this.startPolls();
    });
    // if device disconnected - reconnect after 5 sec
    this.breezart.on('disconnect', () => {
      this.platform.log.debug('Device disconnected', options.name);
      if (!this.breezart.connected) {
        setTimeout(() => {
          this.breezart.connect();
        }, 5000);
      }
    });
    // handle errors
    this.breezart.on('error', (err: { message: string }) => {
      this.platform.log.error(err.message);
    });

    this.breezart.connect();
  }

  /**
   * Start periodical polls of the device for reading characteristics
   */
  startPolls() {
    setInterval(() => {
      if (!this.breezart.connected) {
        return;
      }
      this.breezart.getCurrentStatus(() => {
        this.setDeviceStates();
      });
    }, 1000);
  }

  setDeviceStates() {
    // active (like the Power On)
    if (this.deviceStates.active !== this.breezart.PwrBtnState) {
      this.deviceStates.active = this.breezart.PwrBtnState;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, this.deviceStates.active);
    }
    // fan rotation speed
    if (this.deviceStates.rotationSpeed !== this.breezart.SpeedTarget) {
      this.deviceStates.rotationSpeed = this.breezart.SpeedTarget;
      this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.deviceStates.rotationSpeed * 10);
    }
    // current temperature
    if (this.deviceStates.currentTemperature !== this.breezart.TInf) {
      this.deviceStates.currentTemperature = this.breezart.TInf;
      this.hQService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.deviceStates.currentTemperature);
    }
    // mode
    if (this.deviceStates.mode !== this.breezart.ModeSet) {
      this.deviceStates.mode = this.breezart.ModeSet;
      const modeActive = this.deviceStates.mode === 4 ? 0 : 1;
      this.hQService.updateCharacteristic(this.platform.Characteristic.Active, modeActive);
      const mode = this.deviceStates.mode;
      let targetHeaterCoolerState;
      switch (mode) {
        case 1:
          targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
          break;
        case 2:
          targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
          break;
        default:
          targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
          break;
      }
      this.hQService.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, targetHeaterCoolerState);

    }
    // current heater coolerState
    if (this.deviceStates.currentHeaterCoolerState !== this.breezart.Mode) {
      this.deviceStates.currentHeaterCoolerState = this.breezart.Mode;
      let currentHeaterCoolerState;
      switch (this.deviceStates.currentHeaterCoolerState) {
        case 0:
          currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
          break;
        case 1:
          currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
          break;
        case 2:
          currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
          break;
        case 3:
          currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
          break;
        case 4:
          currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
          break;
        default:
          currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
          break;
      }
      this.hQService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, currentHeaterCoolerState);
    }

    // heatingThresholdTemperature
    if (this.deviceStates.heatingThresholdTemperature !== this.breezart.TemperTarget) {
      this.deviceStates.heatingThresholdTemperature = this.breezart.TemperTarget;
      this.hQService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.deviceStates.heatingThresholdTemperature);
    }

    // filterChange
    if (this.deviceStates.filterChange !== this.breezart.ChangeFilter) {
      this.deviceStates.filterChange = this.breezart.ChangeFilter;
      this.fService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.deviceStates.filterChange);
    }

    // filterLifeLevel
    if (this.deviceStates.filterLifeLevel !== this.breezart.FilterDust) {
      this.deviceStates.filterLifeLevel = this.breezart.FilterDust;
      let filterLifeLevel;
      if (this.deviceStates.filterLifeLevel === 255 || this.deviceStates.filterLifeLevel === null) {
        // it's like undefined
        filterLifeLevel = 0;
      } else {
        filterLifeLevel = this.deviceStates.filterLifeLevel > 100 ? 100 : this.deviceStates.filterLifeLevel;
      }
      this.fService.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, filterLifeLevel);
    }
  }

}

