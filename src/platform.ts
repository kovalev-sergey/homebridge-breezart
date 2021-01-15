import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { BreezartPlatformAccessory } from './platformAccessory';
import { BreezartPlatformConfig } from './configTypes';
import { BreezartDeviceConfig } from 'breezart-client';


/**
 * BreezartHomebridgePlatform
 * This class is the main constructor for Breezart plugin, this is where we
 * parse the user config and discover/register accessories with Homebridge.
 */
export class BreezartHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  // this is configs of the devices by uuid
  public readonly deviceConfigs: Map<string, BreezartDeviceConfig> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: BreezartPlatformConfig,
    public readonly api: API,
  ) {

    this.log.debug('Finished initializing platform:', PLATFORM_NAME);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    // loop over the configured devices and register each one if it has not already been registered
    if (this.config.devices) {
      for (const device of this.config.devices) {
        if (!device.name) {
          this.log.error('One of your Breezart devices has no name configured. This device will be skipped.');
          continue;
        }
        if (!device.host) {
          this.log.error('One of your Breezart devices has no host configured. This device will be skipped.');
          continue;
        }
        if (!device.password) {
          this.log.error('One of your Breezart devices has no password configured. This device will be skipped.');
          continue;
        }
        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        const uuid = this.api.hap.uuid.generate(device.host + String(device.port));

        // check the name for uniqueness and add a config of the device to config map
        if (this.deviceConfigs.has(uuid)) {
          this.log.warn('Multiple devices are configured with same host and port. Duplicates will be skipped.', device.host, device.port);
          continue;
        } else {
          this.deviceConfigs.set(uuid, device);
        }
        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // the accessory already exists
          if (device) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

            // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
            // existingAccessory.context.device = device;
            // this.api.updatePlatformAccessories([existingAccessory]);

            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            new BreezartPlatformAccessory(this, existingAccessory);
            
            // update accessory cache with any changes to the accessory details and information
            this.api.updatePlatformAccessories([existingAccessory]);
          } else if (!device) {
            // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
            // remove platform accessories when no longer present
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
            this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
          }
        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', device.name);

          // create a new accessory
          const accessory = new this.api.platformAccessory(device.name, uuid);

          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;

          // create the accessory handler for the newly create accessory
          new BreezartPlatformAccessory(this, accessory);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    }
  }
}
