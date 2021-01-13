/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { BreezartHomebridgePlatform } from './platform';

import BreezartClient from 'breezart-client';

/**
 * Device polling interval in mc
 */
const POLLS_INTERVAL = 1000;

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
      .setCharacteristic(this.platform.Characteristic.Model, 'TPD-283U-H')
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

    
    // Link all services to Fan
    this.service.addLinkedService(this.hQService);
    this.service.addLinkedService(this.fService);

    // Connect to Brizart device and start the polling
    this.initBreezartClient(accessory.context.device);
  }

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
      // Update accessory information
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.FirmwareRevision, `${String(this.breezart.HiVerTPD)}.${String(this.breezart.LoVerTPD)}`)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, String(this.breezart.Firmware_Ver));
      // Set props for heater/cooler
      this.hQService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
        .setProps({
          minValue: this.breezart.TempMin,
          maxValue: this.breezart.TempMax,
          minStep: 1,
        });
      // Set props for fan
      this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .setProps({
          /* The minimum value is not set because the fan must be able to turned off. */
          maxValue: this.breezart.TempMax * 10,
          minStep: 10,
        });

      this.startPolls(POLLS_INTERVAL);
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
  startPolls(interval) {
    setInterval(() => {
      if (!this.breezart.connected) {
        return;
      }
      this.breezart.getCurrentStatus(() => {
        this.setDeviceStates();
      });
    }, interval);
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

