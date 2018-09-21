/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
export interface UnitProps {
  readonly name: string;
  readonly label: string;
  readonly unitGroup: string;
  readonly isValid: boolean;
}

export interface QuantityProps {
  readonly magnitude: number;
  readonly unit: UnitProps;
  readonly isValid: boolean;
}
export interface UnitConversion {
  factor: number;
  offset: number;
}

// UnitLook-Up services.
export interface UnitLookUpService {
  // findUnit an UnitProps that is used convert and format quantities.
  findUnit(unitLabel: string, unitGroup?: string): Promise<UnitProps>;
  findUnitByName(unitName: string): Promise<UnitProps>;
  getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion>;
}

export abstract class UnitsProvider implements UnitLookUpService {
  public abstract findUnit(unitLabel: string, unitGroup?: string): Promise<UnitProps>;
  public abstract findUnitByName(unitName: string): Promise<UnitProps>;
  public abstract getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion>;
}

export class BadUnit implements UnitProps {
  public name: string = "";
  public label: string = "";
  public unitGroup: string = "";
  public isValid: boolean = false;
}
