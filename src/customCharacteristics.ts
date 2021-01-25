import { Characteristic, Formats, Perms } from 'hap-nodejs';

export class CurrentPowerConsumption extends Characteristic {
  static readonly UUID: string = 'E863F10D-079E-48FF-8F27-9C2605A29F52'; // Eve Consumption

  constructor () {
    super('Consumption', CurrentPowerConsumption.UUID, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: custom unit
      unit: 'W',
      minStep: 0.1,
      format: Formats.FLOAT,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY],
    });
  }
}

export class TotalPowerConsumption extends Characteristic {
  static readonly UUID: string = 'E863F10C-079E-48FF-8F27-9C2605A29F52'; // Eve Total Consumption

  constructor () {
    super('Total Consumption', TotalPowerConsumption.UUID, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: custom unit
      unit: 'kWh',
      minStep: 0.01,
      format: Formats.FLOAT,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY],
    });
  }
}

export class ResetTotalPowerConsumption extends Characteristic {
  static readonly UUID: string = 'E863F112-079E-48FF-8F27-9C2605A29F52'; // Eve Reset Total Consumption

  constructor () {
    super('Reset Total Consumption', ResetTotalPowerConsumption.UUID, {
      format: Formats.UINT32,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY, Perms.PAIRED_WRITE],
    });
  }
}
