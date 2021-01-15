
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge Plugin for Breezart Vents

homebridge-breezart is a plugin for homebridge which allows you to control your [Breezart Vents](http://breezart.ru/) from your Home app. It should work with all Breezart Vents that has controllers like **JL204С5M**, **JL205**, **JL206** and a remote **TPD-283U-H**.

For remote control using this module you must be able to connect the Breezart remote **TPD-283U-H** to LAN, activate the remote control in it and set the password.

## Features
* View vents status
* View vents rotation speed
* View vents work mode
* View heater temerature
* Fan speed control

> **Disclaimer**\
> Work in progress\
> Management features coming soon

## Installation
If you are new to homebridge, please first read the homebridge [documentation](https://www.npmjs.com/package/homebridge).

### Install homebridge
```
npm install -g homebridge
```
### Install homebridge-breezart
```
npm install -g homebridge-breezart
```

## Configuration
Add the breezart platform in config.json inside `~/.homebridge`.

Add your Breezart Vent or multiply vents in the devices or `devices` array.

Example configuration:
```json
{
  "bridge": {
    "name": "Homebridge",
    "username": "CC:22:3D:E3:CE:44",
    "manufacturer": "homebridge.io",
    "model": "homebridge",
    "port": 51853,
    "pin": "022-74-141"
  },
  "platforms": [
    {
      "platform": "Breezart",
      "devices": [
        {
          "name": "Breezart Home",
          "host": "192.168.0.20",
          "port": 1560,
          "password": 12345
        }
      ]
    }
  ],
  "accessories": []
}
```
Also you must be able to connect the Breezart remote **TPD-283U-H** to LAN, activate the remote control in it and set the password.

