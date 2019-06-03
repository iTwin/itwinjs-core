/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { UnitProps, UnitsProvider, UnitConversion } from "../../src/Interfaces";
import { BasicUnit, BadUnit } from "../../src/Unit";

interface ConversionDef {
  numerator: number;
  denominator: number;
  offset: number;
}

interface UnitDefinition {
  readonly name: string;
  readonly unitFamily: string;
  readonly displayLabel: string;
  readonly alternateLabels: string[];
  readonly conversion: ConversionDef;
}

// cSpell:ignore MILLIINCH, MICROINCH, MILLIFOOT
const unitData: UnitDefinition[] = [
  // Angles ( base unit radian )
  { name: "Units.RAD", unitFamily: "Units.ANGLE", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "rad", alternateLabels: ["radian"] },
  // 1 rad = 180.0/PI °
  { name: "Units.ARC_DEG", unitFamily: "Units.ANGLE", conversion: { numerator: 180.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "°", alternateLabels: ["deg", "^"] },
  { name: "Units.ARC_MINUTE", unitFamily: "Units.ANGLE", conversion: { numerator: 10800.0, denominator: 3.14159265358979323846264338327950, offset: 0.0 }, displayLabel: "'", alternateLabels: ["min"] },
  { name: "Units.ARC_SECOND", unitFamily: "Units.ANGLE", conversion: { numerator: 648000.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: '"', alternateLabels: ["sec"] },
  { name: "Units.GRAD", unitFamily: "Units.ANGLE", conversion: { numerator: 200, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "grad", alternateLabels: ["gd"] },
  // Time ( base unit second )
  { name: "Units.S", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "s", alternateLabels: ["sec"] },
  { name: "Units.MIN", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 60.0, offset: 0.0 }, displayLabel: "min", alternateLabels: [] },
  { name: "Units.HR", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 3600.0, offset: 0.0 }, displayLabel: "h", alternateLabels: ["hr"] },
  { name: "Units.DAY", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 86400.0, offset: 0.0 }, displayLabel: "days", alternateLabels: ["day"] },
  { name: "Units.WEEK", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 604800.0, offset: 0.0 }, displayLabel: "weeks", alternateLabels: ["week"] },
  // 1 sec = 1/31536000.0 yr
  { name: "Units.YR", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 31536000.0, offset: 0.0 }, displayLabel: "years", alternateLabels: ["year"] },
  // Length( base unit length )
  { name: "Units.M", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m", alternateLabels: ["meter"] },
  { name: "Units.MM", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "mm", alternateLabels: ["MM"] },
  { name: "Units.CM", unitFamily: "Units.LENGTH", conversion: { numerator: 100.0, denominator: 1.0, offset: 0.0 }, displayLabel: "cm", alternateLabels: ["CM"] },
  { name: "Units.DM", unitFamily: "Units.LENGTH", conversion: { numerator: 10.0, denominator: 1.0, offset: 0.0 }, displayLabel: "dm", alternateLabels: ["DM"] },
  { name: "Units.KM", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1000.0, offset: 0.0 }, displayLabel: "km", alternateLabels: ["KM"] },
  { name: "Units.UM", unitFamily: "Units.LENGTH", conversion: { numerator: 1000000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "µm", alternateLabels: [] },
  { name: "Units.MILLIINCH", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "mil", alternateLabels: [] },
  { name: "Units.MICROINCH", unitFamily: "Units.LENGTH", conversion: { numerator: 1000000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "µin", alternateLabels: [] },
  { name: "Units.MILLIFOOT", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "mft", alternateLabels: [] },
  // 1 m = 1/0.0254 "
  { name: "Units.IN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "in", alternateLabels: ["IN", "\""] },
  { name: "Units.FT", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "ft", alternateLabels: ["F", "FT", "'"] },
  { name: "Units.YRD", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.9144, offset: 0.0 }, displayLabel: "yd", alternateLabels: ["YRD", "yrd"] },
  { name: "Units.MILE", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1609.344, offset: 0.0 }, displayLabel: "mi", alternateLabels: ["mile", "Miles", "Mile"] },
  { name: "Units.BOGUS.IN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.025 }, displayLabel: "bi", alternateLabels: [] },
];

export class ConversionData implements UnitConversion {
  public factor: number = 1.0;
  public offset: number = 0.0;
}

export class TestUnitsProvider implements UnitsProvider {
  public findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps> {
    for (const entry of unitData) {
      if (unitFamily) {
        if (entry.unitFamily !== unitFamily)
          continue;
      }
      if (entry.displayLabel === unitLabel || entry.name === unitLabel) {
        const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.alternateLabels);
        return Promise.resolve(unitProps);
      }

      if (entry.alternateLabels && entry.alternateLabels.length > 0) {
        if (entry.alternateLabels.findIndex((ref) => ref === unitLabel) !== -1) {
          const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.alternateLabels);
          return Promise.resolve(unitProps);
        }
      }
    }

    return Promise.resolve(new BadUnit());
  }

  public async getUnitsByFamily(unitFamily: string): Promise<UnitProps[]> {
    const units: UnitProps[] = [];
    for (const entry of unitData) {
      if (unitFamily) {
        if (entry.unitFamily !== unitFamily)
          continue;
      }
      units.push(new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.alternateLabels));
    }
    return Promise.resolve(units);
  }

  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const unitDataEntry = this.findUnitDefinition(unitName);
    if (unitDataEntry) {
      return Promise.resolve(new BasicUnit(unitDataEntry.name, unitDataEntry.displayLabel, unitDataEntry.unitFamily, unitDataEntry.alternateLabels));
    }
    return Promise.resolve(new BadUnit());
  }

  private findUnitDefinition(name: string): UnitDefinition | undefined {
    for (const entry of unitData) {
      if (entry.name === name)
        return entry;
    }

    return undefined;
  }

  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion> {
    const fromUnitData = this.findUnitDefinition(fromUnit.name);
    const toUnitData = this.findUnitDefinition(toUnit.name);

    if (fromUnitData && toUnitData) {
      const deltaOffset = toUnitData.conversion.offset - fromUnitData.conversion.offset;
      const deltaNumerator = toUnitData.conversion.numerator * fromUnitData.conversion.denominator;
      const deltaDenominator = toUnitData.conversion.denominator * fromUnitData.conversion.numerator;

      const conversion = new ConversionData();
      conversion.factor = deltaNumerator / deltaDenominator;
      conversion.offset = deltaOffset;
      return Promise.resolve(conversion);
    }

    return Promise.resolve(new ConversionData());
  }
}
