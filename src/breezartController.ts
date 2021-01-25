// import { BreezartDeviceConfig } from './configTypes';
import { BreezartClient, BreezartDeviceConfig, BreezartCallback } from 'breezart-client';


/**
 * Time that does not update the property after setting it via the setter
 */
const UPDATE_TIMEOUT = 3000;

export class BreezartController extends BreezartClient {

  private _active: boolean;
  private _rotationSpeed: number;
  private _currentTemperature: number | null;
  private _mode: number; // mode = 4 - heating/cooling is off
  private _currentHeaterCoolerState: number;
  private _heatingThresholdTemperature: number;
  private _filterChange: number; // 0|1
  private _filterLifeLevel: number; // 4%
  private _error: Error | null; // the last error from a device
  private _totalPwr: number; // 4%
  private _resetTotalPwr: number; // Set to seconds from 1.1.2001 upon Reset of total consumption in Eve.app

  private _times: Map<string, Date>;

  constructor(options: BreezartDeviceConfig) {
    super(options);
    this._times = new Map();

    this._active = false;
    this._rotationSpeed = 40;
    this._currentTemperature = 24.4;
    this._mode = 1;
    this._currentHeaterCoolerState = 0;
    this._heatingThresholdTemperature = 24;
    this._filterChange = 0;
    this._filterLifeLevel = 4;
    this._error = null;
    this._totalPwr = 0;
    this._resetTotalPwr = 0;

  }

  public get active() {
    return this._active;
  }

  public set active(value: boolean) {
    this._active = value;
    this._times['active'] = Date.now();
  }

  public get rotationSpeed() {
    return this._rotationSpeed;
  }

  public set rotationSpeed(value: number) {
    this._rotationSpeed = value;
    this._times['rotationSpeed'] = Date.now();
  }

  public get currentTemperature() {
    return this._currentTemperature;
  }

  public get mode() {
    return this._mode;
  }

  public set mode(value: number) {
    this._mode = value;
    this._times['mode'] = Date.now();
  }

  public get currentHeaterCoolerState() {
    return this._currentHeaterCoolerState;
  }

  public get heatingThresholdTemperature() {
    return this._heatingThresholdTemperature;
  }

  public set heatingThresholdTemperature(value: number) {
    this._heatingThresholdTemperature = value;
    this._times['heatingThresholdTemperature'] = Date.now();
  }

  public get filterChange() {
    return this._filterChange;
  }

  public get filterLifeLevel() {
    return this._filterLifeLevel;
  }

  public get error() {
    return this._error;
  }

  public set error(value: Error | null) {
    this._error = value;
  }

  public get totalPwr() {
    return this._totalPwr;
  }

  public set totalPwr(value: number) {
    this._totalPwr = value;
  }

  public get resetTotalPwr() {
    return this._resetTotalPwr;
  }

  public set resetTotalPwr(value: number) {
    this._resetTotalPwr = value;
  }

  PullStatus (callback: BreezartCallback) {
    this.getCurrentStatus((error) => {
      if (error) {
        callback(error);
      } else {
        // reset error, if status was received
        this._error = null;
        const expired = Date.now() - UPDATE_TIMEOUT;

        if (!('active' in this._times) || expired > this._times['active']) {
          this._active = !!this.PwrBtnState;
        }
        if (!('rotationSpeed' in this._times) || expired > this._times['rotationSpeed']) {
          this._rotationSpeed = this.SpeedTarget;
        }
        if (!('heatingThresholdTemperature' in this._times) || expired > this._times['heatingThresholdTemperature']) {
          this._heatingThresholdTemperature = this.TemperTarget;
        }
        if (!('mode' in this._times) || expired > this._times['mode']) {
          this._mode = this.ModeSet;
        }

        this._currentTemperature = this.TInf;
        this._currentHeaterCoolerState = this.Mode;
        this._filterChange = this.ChangeFilter;
        this._filterLifeLevel = this.FilterDust;

        callback();
      }
    });
  }

}
