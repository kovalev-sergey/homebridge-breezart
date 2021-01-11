import { PlatformConfig } from 'homebridge';


export interface BreezartPlatformConfig extends PlatformConfig {
  devices?: Array<BreezartDeviceConfig>;
}

export type BreezartDeviceConfig = {
  name: string;
  host: string;
  port: number;
  password: number;
};
