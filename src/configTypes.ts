import { PlatformConfig } from 'homebridge';
import { BreezartDeviceConfig } from 'breezart-client';

export interface BreezartPlatformConfig extends PlatformConfig {
  devices?: Array<BreezartDeviceConfig>;
}
