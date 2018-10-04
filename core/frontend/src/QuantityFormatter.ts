/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { UnitProps, Format, Formatter, UnitsProvider, FormatterSpec, UnitConversion, BadUnit } from "@bentley/imodeljs-quantity";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";

/** Class that implements the minimum UnitConversion interface to provide information needed to convert unit values. */
export class ConversionData implements UnitConversion {
  public factor: number = 1.0;
  public offset: number = 0.0;
}

/** Class that implements the UnitProps interface so that it can be used by the UnitProvider to retrieve unit information. */
export class Unit implements UnitProps {
  public name = "";
  public label = "";
  public unitFamily = "";
  public isValid = false;

  constructor(name: string, label: string, unitFamily: string) {
    if (name && name.length > 0 && label && label.length > 0 && unitFamily && unitFamily.length > 0) {
      this.name = name;
      this.label = label;
      this.unitFamily = unitFamily;
      this.isValid = true;
    }
  }
}

// interface use to define unit conversions to a base used for a unitFamily
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
}

// cSpell:ignore MILLIINCH, MICROINCH, MILLIFOOT
// Set of supported units - this information will come from Schema-based units once the EC package is ready to provide this information.
const unitData: UnitDefinition[] = [
  // Angles ( base unit radian )
  { name: "Units.RAD", unitFamily: "Units.ANGLE", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "rad", altDisplayLabels: ["radian"] },
  // 1 rad = 180.0/PI °
  { name: "Units.ARC_DEG", unitFamily: "Units.ANGLE", conversion: { numerator: 180.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "°", altDisplayLabels: ["deg"] },
  { name: "Units.ARC_MINUTE", unitFamily: "Units.ANGLE", conversion: { numerator: 10800.0, denominator: 3.14159265358979323846264338327950, offset: 0.0 }, displayLabel: "'", altDisplayLabels: ["min"] },
  { name: "Units.ARC_SECOND", unitFamily: "Units.ANGLE", conversion: { numerator: 648000.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: '"', altDisplayLabels: ["sec"] },
  { name: "Units.GRAD", unitFamily: "Units.ANGLE", conversion: { numerator: 200, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "grad", altDisplayLabels: ["gd"] },
  // Time ( base unit second )
  { name: "Units.S", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "s", altDisplayLabels: ["sec"] },
  { name: "Units.MIN", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 60.0, offset: 0.0 }, displayLabel: "min", altDisplayLabels: [] },
  { name: "Units.HR", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 3600.0, offset: 0.0 }, displayLabel: "h", altDisplayLabels: ["hr"] },
  { name: "Units.DAY", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 86400.0, offset: 0.0 }, displayLabel: "days", altDisplayLabels: ["day"] },
  { name: "Units.WEEK", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 604800.0, offset: 0.0 }, displayLabel: "weeks", altDisplayLabels: ["week"] },
  // 1 sec = 1/31536000.0 yr
  { name: "Units.YR", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 31536000.0, offset: 0.0 }, displayLabel: "years", altDisplayLabels: ["year"] },
  // Length( base unit length )
  { name: "Units.M", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m", altDisplayLabels: ["meter"] },
  { name: "Units.MM", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "mm", altDisplayLabels: ["MM"] },
  { name: "Units.CM", unitFamily: "Units.LENGTH", conversion: { numerator: 100.0, denominator: 1.0, offset: 0.0 }, displayLabel: "cm", altDisplayLabels: ["CM"] },
  { name: "Units.DM", unitFamily: "Units.LENGTH", conversion: { numerator: 10.0, denominator: 1.0, offset: 0.0 }, displayLabel: "dm", altDisplayLabels: ["DM"] },
  { name: "Units.KM", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1000.0, offset: 0.0 }, displayLabel: "km", altDisplayLabels: ["KM"] },
  { name: "Units.UM", unitFamily: "Units.LENGTH", conversion: { numerator: 1000000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "µm", altDisplayLabels: [] },
  { name: "Units.MILLIINCH", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "mil", altDisplayLabels: [] },
  { name: "Units.MICROINCH", unitFamily: "Units.LENGTH", conversion: { numerator: 1000000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "µin", altDisplayLabels: [] },
  { name: "Units.MILLIFOOT", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "mft", altDisplayLabels: [] },
  // 1 m = 1/0.0254 "
  { name: "Units.IN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "in", altDisplayLabels: ["IN", "\""] },
  { name: "Units.FT", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "ft", altDisplayLabels: ["F", "FT", "'"] },
  { name: "Units.YRD", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.9144, offset: 0.0 }, displayLabel: "yd", altDisplayLabels: ["YRD", "yrd"] },
  { name: "Units.MILE", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1609.344, offset: 0.0 }, displayLabel: "mi", altDisplayLabels: ["mile", "Miles", "Mile"] },

  { name: "Units.SQ_FT", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: .09290304, offset: 0.0 }, displayLabel: "ft²", altDisplayLabels: ["sf"] },
  { name: "Units.SQ_M", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m²", altDisplayLabels: [] },

  { name: "Units.CUB_FT", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: 0.028316847, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_M", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m³", altDisplayLabels: [] },
];

/** Defines standard format types for tools that need to display measurements to user. */
export enum QuantityType { Length = 1, Angle = 2, Area = 3, Volume = 4 }

// The following provide default formats for different the QuantityTypes. It is important to note that these default should reference
// units that are available in schemas within the active iModel.
const defaultsFormats = {
  metric: [{
    type: 1/*Length*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 2/*Angle*/, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 3/*Area*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m²",
            name: "Units.SQ_M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 4/*Volume*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m³",
            name: "Units.CUB_M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  ],
  imperial: [{
    type: 1/*Length*/, format: {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    },
  }, {
    type: 2/*Angle*/, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 3/*Area*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft²",
            name: "Units.SQ_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 4/*Volume*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft³",
            name: "Units.CUB_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  ],
};

/**
 * Formats quantity values into strings.
 */
export class QuantityFormatter implements UnitsProvider {
  protected _activeSystemIsImperial = true;
  protected _formatSpecsByKoq = new Map<string, FormatterSpec[]>();
  protected _imperialFormatsByType = new Map<QuantityType, Format>();
  protected _metricFormatsByType = new Map<QuantityType, Format>();
  protected _imperialFormatSpecsByType = new Map<QuantityType, FormatterSpec>();
  protected _metricFormatSpecsByType = new Map<QuantityType, FormatterSpec>();

  /** Find a unit given the unitLabel. */
  public async findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps> {
    for (const entry of unitData) {
      if (unitFamily) {
        if (entry.unitFamily !== unitFamily)
          continue;
      }
      if (entry.displayLabel === unitLabel || entry.name === unitLabel) {
        const unitProps = new Unit(entry.name, entry.displayLabel, entry.unitFamily);
        return Promise.resolve(unitProps);
      }

      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref) => ref === unitLabel) !== -1) {
          const unitProps = new Unit(entry.name, entry.displayLabel, entry.unitFamily);
          return Promise.resolve(unitProps);
        }
      }
    }

    return Promise.resolve(new BadUnit());
  }

  protected findUnitDefinition(name: string): UnitDefinition | undefined {
    for (const entry of unitData) {
      if (entry.name === name)
        return entry;
    }

    return undefined;
  }

  /** Find a unit given the unit's unique name. */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const unitDataEntry = this.findUnitDefinition(unitName);
    if (unitDataEntry) {
      return Promise.resolve(new Unit(unitDataEntry.name, unitDataEntry.displayLabel, unitDataEntry.unitFamily));
    }
    return Promise.resolve(new BadUnit());
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
      return Promise.resolve(conversion);
    }

    return Promise.resolve(new ConversionData());
  }

  /** method used to load format for KOQ into cache */
  protected async loadKoqFormatSpecs(koq: string): Promise<void> {
    if (koq.length === 0)
      return Promise.reject(new Error("bad koq specification"));

    if (!this._formatSpecsByKoq.has(koq)) {
      // get koq and get formats from it
    }

    return Promise.reject(new Error("not yet implemented"));
  }

  /** Async method to return the array of presentation formats for the specified KOQ */
  protected async getKoqFormatterSpecsAsync(koq: string, useImperial: boolean): Promise<FormatterSpec[] | undefined> {
    if (koq.length === 0 && useImperial)
      return Promise.reject(new Error("bad koq specification"));

    return Promise.resolve(this._formatSpecsByKoq.get(koq));
  }

  /** Async method to return the 'active' FormatSpec for the specified KOQ */
  protected async getKoqFormatterSpecAsync(koq: string, useImperial: boolean): Promise<FormatterSpec | undefined> {
    if (koq.length === 0 && useImperial)
      return Promise.reject(new Error("bad koq specification"));

    const formatterSpecArray = await Promise.resolve(this._formatSpecsByKoq.get(koq));
    if (formatterSpecArray && formatterSpecArray.length > 0) {
      const activeFormatIndex = 0; // TODO - get active format based on user selected format or default format
      return Promise.resolve(formatterSpecArray[activeFormatIndex]);
    }

    return Promise.reject(new Error("not yet implemented"));
  }

  /** Method used to get cached FormatterSpec or undefined if FormatterSpec is unavailable */
  protected getKoqFormatterSpec(koq: string, useImperial: boolean): FormatterSpec | undefined {
    if (koq.length === 0 && useImperial)
      return undefined;

    throw new Error("not yet implemented");
  }

  /** Async call to generate a formatted string for a specific KOQ given its magnitude. This method is
   * used during async processing that extract formatted values from DgnElements.
   */
  protected async formatKindOfQuantityAsync(magnitude: number, koq: string): Promise<string> {
    const formatSpec = await this.getKoqFormatterSpecAsync(koq, this._activeSystemIsImperial);
    if (formatSpec === undefined)
      return Promise.resolve("");

    return Promise.resolve(Formatter.formatQuantity(magnitude, formatSpec));
  }

  protected async loadStdFormat(type: QuantityType, imperial: boolean): Promise<Format> {
    let formatData: any;

    const formatArray = imperial ? defaultsFormats.imperial : defaultsFormats.metric;
    for (const entry of formatArray) {
      if (entry.type === type as number) {
        formatData = entry.format;
        const format = new Format("stdFormat");
        await format.fromJson(this, formatData);
        return Promise.resolve(format);
      }
    }
    throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class to provide formats for tools");
  }

  protected async getFormatByQuantityType(type: QuantityType, imperial: boolean): Promise<Format> {
    const activeMap = imperial ? this._imperialFormatsByType : this._metricFormatsByType;

    let format = activeMap.get(type);
    if (format)
      return Promise.resolve(format);

    format = await this.loadStdFormat(type, imperial);
    if (format) {
      activeMap.set(type, format);
      return Promise.resolve(format);
    }

    throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class to provide formats for tools");
  }

  /** Async request to get the 'persistence' unit from the UnitsProvider. For a tool this 'persistence' unit is the unit being used by the tool internally. */
  protected async getUnitByQuantityType(type: QuantityType): Promise<UnitProps> {
    switch (type) {
      case QuantityType.Angle:
        return this.findUnitByName("Units.RAD");
      case QuantityType.Area:
        return this.findUnitByName("Units.SQ_M");
      case QuantityType.Volume:
        return this.findUnitByName("Units.M");
      case QuantityType.Length:
      default:
        return this.findUnitByName("Units.M");
    }
  }

  /** Call to get a FormatterSpec of a QuantityType. If the FormatterSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatSpecsForQuantityTypes.
   */
  protected getFormatterSpecByQuantityType(type: QuantityType, imperial: boolean): FormatterSpec | undefined {
    const activeMap = imperial ? this._imperialFormatSpecsByType : this._metricFormatSpecsByType;
    if (activeMap.size === 0) {
      // trigger a load so it will become available
      this.loadFormatSpecsForQuantityTypes(imperial);
      return undefined;
    }

    return activeMap.get(type);
  }

  /** Async call to loadFormatSpecsForQuantityTypes */
  public async loadFormatSpecsForQuantityTypes(useImperial: boolean): Promise<void> {
    const typeArray: QuantityType[] = [QuantityType.Length, QuantityType.Angle, QuantityType.Area, QuantityType.Volume];
    const activeMap = useImperial ? this._imperialFormatSpecsByType : this._metricFormatSpecsByType;
    activeMap.clear();

    for (const quantityType of typeArray) {
      const formatPromise = this.getFormatByQuantityType(quantityType, useImperial);
      const unitPromise = this.getUnitByQuantityType(quantityType);
      const [format, unit] = await Promise.all([formatPromise, unitPromise]);
      const spec = await FormatterSpec.create(format.name, format, this, unit);
      activeMap.set(quantityType, spec);
    }
    return Promise.resolve();
  }

  /** Generates a formatted string for a specific KOQ given its magnitude.
   * @param magnitude       The magnitude of the quantity.
   * @param koq            Unique name of KOQ.
   * @return the formatted string or undefined if no FormatterSpec has been registered for this KOQ.
   */
  public formatKindOfQuantity(magnitude: number, koq: string): string | undefined {
    const formatSpec = this.getKoqFormatterSpec(koq, this._activeSystemIsImperial);
    if (formatSpec === undefined)
      return undefined;

    return Formatter.formatQuantity(magnitude, formatSpec);
  }

  /** Generates a formatted string for a quantity given its magnitude and quantity type..
   * @param magnitude       The magnitude of the quantity.
   * @param type            One of the standard QuantityTypes.
   * @return the formatted string or undefined if no FormatterSpec has been registered for the QuantityType.
   */
  public formatQuantity(magnitude: number, type: QuantityType): string | undefined {
    const formatSpec = this.getFormatterSpecByQuantityType(type, this._activeSystemIsImperial);
    if (formatSpec === undefined)
      return undefined;

    return Formatter.formatQuantity(magnitude, formatSpec);
  }

  /** Set the flag to return either metric or imperial formats. This call also makes an async request to refresh the cached formats. */
  public set useImperialFormats(useImperial: boolean) {
    this._activeSystemIsImperial = useImperial;
    this.loadFormatSpecsForQuantityTypes(useImperial);
  }

  public get useImperialFormats(): boolean { return this._activeSystemIsImperial; }
}
