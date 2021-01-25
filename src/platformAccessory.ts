/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { BreezartHomebridgePlatform } from './platform';
import { BreezartDeviceConfig, BreezartEventTypes } from 'breezart-client';
import { BreezartController } from './breezartController';
import { CurrentPowerConsumption, TotalPowerConsumption, ResetTotalPowerConsumption } from './customCharacteristics';

import { uuid } from 'hap-nodejs';

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

  private breezart: BreezartController;
  private loggingService;

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
    // add Power Consumption characteristics for the history service
    this.hQService.getCharacteristic(CurrentPowerConsumption)
      .on('get', this.getCurrentPowerConsumption.bind(this));
    this.hQService.getCharacteristic(TotalPowerConsumption)
      .on('get', this.getTotalPowerConsumption.bind(this));
    this.hQService.getCharacteristic(ResetTotalPowerConsumption)
      .on('set', this.setResetTotalPowerConsumption.bind(this))
      .on('get', this.getResetTotalPowerConsumption.bind(this));
    
    // Register Filter Maintaince service
    this.fService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
      this.accessory.addService(this.platform.Service.FilterMaintenance, accessory.context.device.name + ' Filter');
    this.fService.getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
      .on('get', this.getFilterChangeIndication.bind(this));
    this.fService.getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
      .on('get', this.getFilterLifeLevel.bind(this));
    // TODO: Reset filter indications https://developers.homebridge.io/#/characteristic/ResetFilterIndication
    
    // Register Elgato Eve history service
    this.loggingService = new this.platform.FakeGatoHistoryService('custom', accessory, {
      storage: 'fs',
      filename: `AccessoryHistory.${uuid.toShortForm(accessory.UUID)}.json`,
      disableRepeatLastData: true,
      minutes: 1,
      log: this.platform.log,
    });

    // Link all services to Fan
    this.service.addLinkedService(this.hQService);
    this.service.addLinkedService(this.fService);

    const connectionOptions = {
      host: accessory.context.device.host as string,
      port: accessory.context.device.port as number,
      password: accessory.context.device.password as number,
    };

    this.breezart = new BreezartController(connectionOptions as BreezartDeviceConfig);
    // Connect to Brizart device and start the polling
    this.initBreezartClient(accessory.context.device);
  }

  getActive(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	1
    const isActive = this.breezart.active;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic Active ->', isActive);
    callback(error, isActive);
  }

  setActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const targetPowerState = value as boolean;
    this.breezart.active = targetPowerState;
    this.platform.log.debug('Set Characteristic Active ->', value);

    this.breezart.setPowerOn(targetPowerState, callback);
  }

  getRotationSpeed(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	100
    // Min Step	1
    const rotationSpeed = this.breezart.rotationSpeed;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic RotationSpeed ->', rotationSpeed);
    callback(error, rotationSpeed);
  }

  setRotationSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback) {
  
    const targetSpeed = value as number < this.breezart.SpeedMin ? this.breezart.SpeedMin : value as number;
    this.breezart.rotationSpeed = targetSpeed;

    this.platform.log.debug('Set Characteristic RotationSpeed ->', value);

    this.breezart.setFanSpeed(targetSpeed, callback);
  }

  getCurrentTemperature(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	100
    // Min Step	0.1
    const currentTemperature = this.breezart.currentTemperature;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic CurrentTemperature ->', currentTemperature);
    callback(error, currentTemperature);
  }

  getModeActive(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	1
    let modeActive = this.platform.Characteristic.Active.ACTIVE;
    if (this.breezart.mode === 4) {
      modeActive = this.platform.Characteristic.Active.INACTIVE;
    }

    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic modeActive ->', modeActive);
    callback(error, modeActive);
  }

  setModeActive(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    if (value !== this.breezart.mode) {
      if (value === this.platform.Characteristic.Active.INACTIVE) {
        this.breezart.mode = 4;
        this.platform.log.debug('Set Characteristic modeActive ->', this.breezart.mode);
      }
    }
    const error = this.breezart.error;
    callback(error);
  }

  getCurrentHeaterCoolerState(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	3
    let currentHeaterCoolerState;
    switch (this.breezart.currentHeaterCoolerState) {
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
    const error = this.breezart.error;
    callback(error, currentHeaterCoolerState);
  }

  getTargetHeaterCoolerState(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	2
    const mode = this.breezart.mode;
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
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic targetHeaterCoolerState ->', targetHeaterCoolerState);
    callback(error, targetHeaterCoolerState);
  }

  setTargetHeaterCoolerState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    switch (value as number) {
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        this.breezart.mode = 1;
        break;
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        this.breezart.mode = 2;
        break;
      default:
        this.breezart.mode = 3;
        break;
    }
    const error = this.breezart.error;
    this.platform.log.debug('Set Characteristic targetHeaterCoolerState ->', value);
    callback(error);
  }
  
  getHeatingThresholdTemperature(callback: CharacteristicGetCallback) {
    // Min Value	0
    // Max Value	25
    // Min Step	0.1
    const targetTemperature = this.breezart.heatingThresholdTemperature;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic heatingThresholdTemperature ->', targetTemperature);
    callback(error, targetTemperature);
  }
  
  setHeatingThresholdTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const targetTemp = Math.round(value as number);
    this.breezart.heatingThresholdTemperature = targetTemp;
    this.platform.log.debug('Set Characteristic heatingThresholdTemperature ->', value);
    this.breezart.setTemperature(targetTemp, callback);
  }
  
  getCurrentPowerConsumption(callback: CharacteristicGetCallback) {
    const currentPowerConsumption = this.breezart.Pwr;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic CurrentPowerConsumption ->', currentPowerConsumption);
    callback(error, currentPowerConsumption);
  }
  
  getTotalPowerConsumption(callback: CharacteristicGetCallback) {
    const totalPowerConsumption = this.breezart.totalPwr;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic TotalPowerConsumption ->', totalPowerConsumption);
    callback(error, totalPowerConsumption);
  }
  
  getResetTotalPowerConsumption(callback: CharacteristicGetCallback) {
    const resetTotalPowerConsumption = this.breezart.resetTotalPwr;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic ResetTotalPowerConsumption ->', resetTotalPowerConsumption);
    callback(error, resetTotalPowerConsumption);
  }

  setResetTotalPowerConsumption(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const resetTotalPowerConsumption = value as number;
    this.breezart.resetTotalPwr = resetTotalPowerConsumption;
    this.breezart.totalPwr = 0;
    const error = this.breezart.error;
    this.setExtraPersistedData();
    this.platform.log.debug('Set Characteristic resetTotalPowerConsumption ->', value);
    callback(error, resetTotalPowerConsumption);
  }
  
  getFilterChangeIndication(callback: CharacteristicGetCallback) {
    const filterChange = this.breezart.filterChange;
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic filterChange ->', filterChange);
    callback(error, filterChange);
  }

  getFilterLifeLevel(callback: CharacteristicGetCallback) {
    let filterLifeLevel;
    if (this.breezart.filterLifeLevel === 255 || this.breezart.filterLifeLevel === null) {
      // it's like undefined
      filterLifeLevel = 0;
    } else {
      filterLifeLevel = this.breezart.filterLifeLevel > 100 ? 100 : this.breezart.filterLifeLevel;
    }
    const error = this.breezart.error;
    this.platform.log.debug('Get Characteristic filterChange ->', filterLifeLevel);
    callback(error, filterLifeLevel);
  }

  /**
   * Connet to Breezart device and init polling
   */
  initBreezartClient(options: BreezartDeviceConfig) {
    this.platform.log.debug('initBreezartClient');

    // then Breezart was connected 
    this.breezart.on(BreezartEventTypes.CONNECT, () => {
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
          maxValue: this.breezart.SpeedMax,
          minValue: this.breezart.SpeedMin - 1,
          minStep: 1,
        });

      this.startPolls(POLLS_INTERVAL);
    });
    // if device disconnected - reconnect after 5 sec
    this.breezart.on(BreezartEventTypes.DISCONNECT, () => {
      this.platform.log.debug('Device disconnected', options.name);
      if (!this.breezart.connected) {
        setTimeout(() => {
          this.breezart.connect();
        }, 5000);
      }
    });
    // handle errors
    this.breezart.on(BreezartEventTypes.ERROR, (err: Error) => {
      // if from device was received an error, set it to device state
      this.breezart.error = err;
      this.platform.log.error(err.message);
    });

    this.breezart.connect();
  }

  /**
   * Start periodical polls of the device for reading characteristics
   */
  startPolls(interval: number) {
    setInterval(() => {
      if (!this.breezart.connected) {
        return;
      }
      this.breezart.PullStatus((error) => {
        if (error) {
          return;
        }
        this.setDeviceStates();
      });
    }, interval);
  }

  setDeviceStates() {
    // active (like the Power On)
    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.breezart.active);
    // fan rotation speed
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.breezart.rotationSpeed);
    // current temperature
    if (this.breezart.currentTemperature) {
      this.hQService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.breezart.currentTemperature);
    }
    // mode
    const modeActive = this.breezart.mode === 4 ? 0 : 1;
    this.hQService.updateCharacteristic(this.platform.Characteristic.Active, modeActive);
    const mode = this.breezart.mode;
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

    // current heater coolerState
    let currentHeaterCoolerState;
    switch (this.breezart.currentHeaterCoolerState) {
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

    // heatingThresholdTemperature
    this.hQService.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.breezart.heatingThresholdTemperature);

    // Pwr
    this.hQService.updateCharacteristic(CurrentPowerConsumption, this.breezart.Pwr ? this.breezart.Pwr : 0);

    // filterChange
    this.fService.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, this.breezart.filterChange);

    // filterLifeLevel
    let filterLifeLevel;
    if (this.breezart.filterLifeLevel === 255 || this.breezart.filterLifeLevel === null) {
      // it's like undefined
      filterLifeLevel = 0;
    } else {
      filterLifeLevel = this.breezart.filterLifeLevel > 100 ? 100 : this.breezart.filterLifeLevel;
    }
    this.fService.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, filterLifeLevel);


    // Calculate the Total Power Consumption metric
    const deltaTotalPower = (this.breezart.Pwr ? this.breezart.Pwr : 0) * (POLLS_INTERVAL / 1000) / 3600 / 1000;
    let persistedTotalPower = 0;
    let resetTotalPowerConsumption = 0;
    if (this.loggingService.isHistoryLoaded()) {
      const extraPersistedData = this.loggingService.getExtraPersistedData();
      persistedTotalPower = extraPersistedData?.totalPower || 0;
      resetTotalPowerConsumption = extraPersistedData?.resetPower || 0;
    }
    const totalPower = persistedTotalPower + deltaTotalPower;
    this.breezart.totalPwr = totalPower;
    this.breezart.resetTotalPwr = resetTotalPowerConsumption;
    this.setExtraPersistedData();

    // TotalPowerConsumption
    this.hQService.updateCharacteristic(TotalPowerConsumption, Math.round((this.breezart.totalPwr + Number.EPSILON) * 100) / 100);
    // resetTotalPowerConsumption
    this.hQService.updateCharacteristic(ResetTotalPowerConsumption, resetTotalPowerConsumption);

    // add history
    const moment = Math.round(new Date().valueOf() / 1000);
    const entryPwr = {
      time: moment,
      power: this.breezart.Pwr,
    };
    this.loggingService.addEntry(entryPwr);
    const entryTmp = {
      time: moment,
      temp: this.breezart.currentTemperature,
    };
    this.loggingService.addEntry(entryTmp);

  }

  setExtraPersistedData() {
    this.loggingService.setExtraPersistedData({
      totalPower: this.breezart.totalPwr,
      resetPower: this.breezart.resetTotalPwr,
    });
  }

}

