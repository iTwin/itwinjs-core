/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import {
  BadUnit, BasicUnit, UnitConversion, UnitProps, UnitsProvider,
} from "@bentley/imodeljs-quantity";

// cSpell:ignore ussurvey USCUSTOM

/** Units provider that provides a limited number of UnitDefinitions that are needed to support basic tools.
 * @internal
 */
export class BasicUnitsProvider implements UnitsProvider {
  /** Find a unit given the unitLabel. */
  public async findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps> {
    for (const entry of UNIT_DATA) {
      if (unitFamily) {
        if (entry.unitFamily !== unitFamily)
          continue;
      }
      if (entry.displayLabel === unitLabel || entry.name === unitLabel) {
        const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels, entry.system);
        return unitProps;
      }

      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref) => ref === unitLabel) !== -1) {
          const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels, entry.system);
          return unitProps;
        }
      }
    }

    return new BadUnit();
  }

  /** find all units given unitFamily */
  public async getUnitsByFamily(unitFamily: string): Promise<UnitProps[]> {
    const units: UnitProps[] = [];
    for (const entry of UNIT_DATA) {
      if (entry.unitFamily !== unitFamily)
        continue;
      units.push(new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels, entry.system));
    }
    return units;
  }

  protected findUnitDefinition(name: string): UnitDefinition | undefined {
    for (const entry of UNIT_DATA) {
      if (entry.name === name)
        return entry;
    }

    return undefined;
  }

  /** Find a unit given the unit's unique name. */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const unitDataEntry = this.findUnitDefinition(unitName);
    if (unitDataEntry) {
      return new BasicUnit(unitDataEntry.name, unitDataEntry.displayLabel, unitDataEntry.unitFamily, unitDataEntry.altDisplayLabels, unitDataEntry.system);
    }
    return new BadUnit();
  }

  /** Return the information needed to convert a value between two different units.  The units should be from the same unitFamily. */
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
      return conversion;
    }

    return new ConversionData();
  }
}

/** Class that implements the minimum UnitConversion interface to provide information needed to convert unit values.
 * @alpha
 */
class ConversionData implements UnitConversion {
  public factor: number = 1.0;
  public offset: number = 0.0;
}

/** interface use to define unit conversions to a base used for a unitFamily */
interface ConversionDef {
  numerator: number;
  denominator: number;
  offset: number;
}

// Temporary interface use to define structure of the unit definitions in this example.
interface UnitDefinition {
  readonly name: string;
  readonly unitFamily: string;
  readonly displayLabel: string;
  readonly altDisplayLabels: string[];
  readonly conversion: ConversionDef;
  readonly system: string;
}

// ========================================================================================================================================
// Minimum set of UNITs to be removed when official UnitsProvider is available
// ========================================================================================================================================
// cSpell:ignore MILLIINCH, MICROINCH, MILLIFOOT
// Set of supported units - this information will come from Schema-based units once the EC package is ready to provide this information.
const UNIT_DATA: UnitDefinition[] = [
  // Angles ( base unit radian )
  { name: "Units.RAD", unitFamily: "Units.ANGLE", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "rad", altDisplayLabels: ["radian"] },
  // 1 rad = 180.0/PI °
  { name: "Units.ARC_DEG", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 180.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "°", altDisplayLabels: ["deg", "^"] },
  { name: "Units.ARC_MINUTE", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 10800.0, denominator: 3.14159265358979323846264338327950, offset: 0.0 }, displayLabel: "'", altDisplayLabels: ["min"] },
  { name: "Units.ARC_SECOND", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 648000.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: '"', altDisplayLabels: ["sec"] },
  { name: "Units.GRAD", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 200, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "grad", altDisplayLabels: ["gd"] },
  // Time ( base unit second )
  { name: "Units.S", unitFamily: "Units.TIME", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "s", altDisplayLabels: ["sec"] },
  { name: "Units.MIN", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 60.0, offset: 0.0 }, displayLabel: "min", altDisplayLabels: [] },
  { name: "Units.HR", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 3600.0, offset: 0.0 }, displayLabel: "h", altDisplayLabels: ["hr"] },
  { name: "Units.DAY", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 86400.0, offset: 0.0 }, displayLabel: "days", altDisplayLabels: ["day"] },
  { name: "Units.WEEK", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 604800.0, offset: 0.0 }, displayLabel: "weeks", altDisplayLabels: ["week"] },
  // 1 sec = 1/31536000.0 yr
  { name: "Units.YR", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 31536000.0, offset: 0.0 }, displayLabel: "years", altDisplayLabels: ["year"] },
  // conversion => specified unit to base unit of m
  { name: "Units.M", unitFamily: "Units.LENGTH", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m", altDisplayLabels: ["meter"] },
  { name: "Units.MM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 1000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "mm", altDisplayLabels: ["MM"] },
  { name: "Units.CM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 100.0, denominator: 1.0, offset: 0.0 }, displayLabel: "cm", altDisplayLabels: ["CM"] },
  { name: "Units.DM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 10.0, denominator: 1.0, offset: 0.0 }, displayLabel: "dm", altDisplayLabels: ["DM"] },
  { name: "Units.KM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 1000.0, offset: 0.0 }, displayLabel: "km", altDisplayLabels: ["KM"] },
  { name: "Units.UM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 1000000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "µm", altDisplayLabels: [] },
  { name: "Units.MILLIINCH", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "mil", altDisplayLabels: [] },
  { name: "Units.MICROINCH", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1000000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "µin", altDisplayLabels: [] },
  { name: "Units.MILLIFOOT", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1000.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "mft", altDisplayLabels: [] },
  { name: "Units.IN", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "in", altDisplayLabels: ["IN", "\""] },
  { name: "Units.FT", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "ft", altDisplayLabels: ["F", "FT", "'"] },
  { name: "Units.CHAIN", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 66.0 * 0.3048, offset: 0.0 }, displayLabel: "chain", altDisplayLabels: ["CHAIN"] },
  { name: "Units.YRD", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.9144, offset: 0.0 }, displayLabel: "yd", altDisplayLabels: ["YRD", "yrd"] },
  { name: "Units.MILE", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 1609.344, offset: 0.0 }, displayLabel: "mi", altDisplayLabels: ["mile", "Miles", "Mile"] },
  { name: "Units.US_SURVEY_FT", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 1200.0, offset: 0.0 }, displayLabel: "ft (US Survey)", altDisplayLabels: ["ft", "SF", "USF", "ft (US Survey)"] },
  { name: "Units.US_SURVEY_YRD", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 3.0 * 1200.0, offset: 0.0 }, displayLabel: "yrd (US Survey)", altDisplayLabels: ["USY", "yards (US Survey)"] },
  { name: "Units.US_SURVEY_IN", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 100.0, offset: 0.0 }, displayLabel: "in (US Survey)", altDisplayLabels: ["USI", "inches (US Survey)"] },
  { name: "Units.US_SURVEY_MILE", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 5280.0 * 1200.0, offset: 0.0 }, displayLabel: "mi (US Survey)", altDisplayLabels: ["miles (US Survey)", "mile (US Survey)", "USM"] },
  { name: "Units.US_SURVEY_CHAIN", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 1.0, denominator: 20.11684, offset: 0.0 }, displayLabel: "chain (US Survey)", altDisplayLabels: ["chains (US Survey)"] },
  // conversion => specified unit to base unit of m²
  { name: "Units.SQ_FT", unitFamily: "Units.AREA", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: .09290304, offset: 0.0 }, displayLabel: "ft²", altDisplayLabels: ["sf"] },
  { name: "Units.SQ_US_SURVEY_FT", unitFamily: "Units.AREA", system: "Units.USCUSTOM", conversion: { numerator: 15499969.0, denominator: 1440000, offset: 0.0 }, displayLabel: "ft² (US Survey)", altDisplayLabels: ["sussf"] },
  { name: "Units.SQ_M", unitFamily: "Units.AREA", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m²", altDisplayLabels: ["sm"] },
  // conversion => specified unit to base unit m³
  { name: "Units.CUB_FT", unitFamily: "Units.VOLUME", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.028316847, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_US_SURVEY_FT", unitFamily: "Units.VOLUME", system: "Units.USSURVEY", conversion: { numerator: 1, denominator: 0.0283170164937591, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_YD", unitFamily: "Units.VOLUME", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.76455486, offset: 0.0 }, displayLabel: "yd³", altDisplayLabels: ["cy"] },
  { name: "Units.CUB_M", unitFamily: "Units.VOLUME", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m³", altDisplayLabels: ["cm"] },
];
