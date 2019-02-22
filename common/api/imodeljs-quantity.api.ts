// @alpha
class BadUnit implements UnitProps {
  // (undocumented)
  isValid: boolean;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
  // (undocumented)
  unitFamily: string;
}

// @alpha (undocumented)
enum DecimalPrecision {
  // (undocumented)
  Eight = 8,
  // (undocumented)
  Eleven = 11,
  // (undocumented)
  Five = 5,
  // (undocumented)
  Four = 4,
  // (undocumented)
  Nine = 9,
  // (undocumented)
  One = 1,
  // (undocumented)
  Seven = 7,
  // (undocumented)
  Six = 6,
  // (undocumented)
  Ten = 10,
  // (undocumented)
  Three = 3,
  // (undocumented)
  Twelve = 12,
  // (undocumented)
  Two = 2,
  // (undocumented)
  Zero = 0
}

// @alpha
class Format implements FormatProps {
  constructor(name: string);
  // (undocumented)
  protected _decimalSeparator: string;
  // (undocumented)
  protected _formatTraits: FormatTraits;
  // (undocumented)
  protected _includeZero: boolean;
  // (undocumented)
  protected _minWidth?: number;
  // (undocumented)
  protected _precision: number;
  // (undocumented)
  protected _roundFactor: number;
  // (undocumented)
  protected _scientificType?: ScientificType;
  // (undocumented)
  protected _showSignOption: ShowSignOption;
  // (undocumented)
  protected _spacer: string;
  // (undocumented)
  protected _stationOffsetSize?: number;
  // (undocumented)
  protected _stationSeparator: string;
  // (undocumented)
  protected _thousandSeparator: string;
  // (undocumented)
  protected _type: FormatType;
  // (undocumented)
  protected _units?: Array<[UnitProps, string | undefined]>;
  // (undocumented)
  protected _uomSeparator: string;
  // (undocumented)
  readonly decimalSeparator: string;
  // (undocumented)
  readonly formatTraits: FormatTraits;
  static formatTraitsToArray(currentFormatTrait: FormatTraits): string[];
  static formatTypeToString(type: FormatType): string;
  fromJson(unitsProvider: UnitsProvider, jsonObj: any): Promise<void>;
  hasFormatTraitSet(formatTrait: FormatTraits): boolean;
  // (undocumented)
  readonly hasUnits: boolean;
  // (undocumented)
  readonly includeZero: boolean | undefined;
  // (undocumented)
  readonly minWidth: number | undefined;
  // (undocumented)
  readonly name: string;
  static parseDecimalPrecision(jsonObjPrecision: number): DecimalPrecision;
  static parseFormatTrait(stringToCheck: string, currentFormatTrait: number): FormatTraits;
  static parseFormatType(jsonObjType: string, formatName: string): FormatType;
  static parseFractionalPrecision(jsonObjPrecision: number, formatName: string): FractionalPrecision;
  static parsePrecision(precision: number, formatName: string, type: FormatType): DecimalPrecision | FractionalPrecision;
  static parseScientificType(scientificType: string, formatName: string): ScientificType;
  static parseShowSignOption(showSignOption: string, formatName: string): ShowSignOption;
  // (undocumented)
  readonly precision: DecimalPrecision | FractionalPrecision;
  // (undocumented)
  readonly roundFactor: number;
  // (undocumented)
  readonly scientificType: ScientificType | undefined;
  // (undocumented)
  static scientificTypeToString(scientificType: ScientificType): string;
  // (undocumented)
  readonly showSignOption: ShowSignOption;
  static showSignOptionToString(showSign: ShowSignOption): string;
  // (undocumented)
  readonly spacer: string | undefined;
  // (undocumented)
  readonly stationOffsetSize: number | undefined;
  // (undocumented)
  readonly stationSeparator: string;
  // (undocumented)
  readonly thousandSeparator: string;
  toJson: {
    [value: string]: any;
  }
  // (undocumented)
  readonly type: FormatType;
  // (undocumented)
  readonly units: Array<[UnitProps, string | undefined]> | undefined;
  // (undocumented)
  readonly uomSeparator: string;
}

// @alpha
interface FormatProps {
  // (undocumented)
  readonly decimalSeparator: string;
  // (undocumented)
  readonly formatTraits: FormatTraits;
  // (undocumented)
  readonly includeZero?: boolean;
  // (undocumented)
  readonly minWidth: number | undefined;
  // (undocumented)
  readonly name: string;
  // (undocumented)
  readonly precision: DecimalPrecision | FractionalPrecision;
  // (undocumented)
  readonly roundFactor: number;
  // (undocumented)
  readonly scientificType?: ScientificType;
  // (undocumented)
  readonly showSignOption: ShowSignOption;
  // (undocumented)
  readonly spacer?: string;
  // (undocumented)
  readonly stationOffsetSize?: number;
  // (undocumented)
  readonly stationSeparator?: string;
  // (undocumented)
  readonly thousandSeparator: string;
  // (undocumented)
  readonly type: FormatType;
  // (undocumented)
  readonly units?: Array<[UnitProps, string | undefined]>;
  // (undocumented)
  readonly uomSeparator: string;
}

// @alpha
class Formatter {
  static formatQuantity(magnitude: number, spec: FormatterSpec): string;
}

// @public
class FormatterSpec {
  constructor(name: string, format: Format, conversions?: UnitConversionSpec[]);
  static create(name: string, format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<FormatterSpec>;
  // (undocumented)
  readonly format: Format;
  // (undocumented)
  readonly name: string;
  readonly unitConversions: UnitConversionSpec[];
}

// @alpha (undocumented)
enum FormatTraits {
  // (undocumented)
  ApplyRounding = 16,
  // (undocumented)
  ExponentOnlyNegative = 512,
  // (undocumented)
  FractionDash = 32,
  // (undocumented)
  KeepDecimalPoint = 8,
  // (undocumented)
  KeepSingleZero = 2,
  // (undocumented)
  PrependUnitLabel = 128,
  // (undocumented)
  ShowUnitLabel = 64,
  // (undocumented)
  TrailZeroes = 1,
  // (undocumented)
  Use1000Separator = 256,
  // (undocumented)
  ZeroEmpty = 4
}

// @alpha (undocumented)
enum FormatType {
  // (undocumented)
  Decimal = 0,
  // (undocumented)
  Fractional = 1,
  // (undocumented)
  Scientific = 2,
  // (undocumented)
  Station = 3
}

// @alpha (undocumented)
enum FractionalPrecision {
  // (undocumented)
  Eight = 8,
  // (undocumented)
  Four = 4,
  // (undocumented)
  One = 1,
  // (undocumented)
  OneHundredTwentyEight = 128,
  // (undocumented)
  Sixteen = 16,
  // (undocumented)
  SixtyFour = 64,
  // (undocumented)
  ThirtyTwo = 32,
  // (undocumented)
  Two = 2,
  // (undocumented)
  TwoHundredFiftySix = 256
}

// @alpha
class Parser {
  static parseIntoQuantity(inString: string, format: Format, unitsProvider: UnitsProvider): Promise<QuantityProps>;
  // WARNING: The type "ParseToken" needs to be exported by the package (e.g. added to index.ts)
  static parseQuantitySpecification(quantitySpecification: string, format: Format): ParseToken[];
}

// @alpha
class Quantity implements QuantityProps {
  constructor(unit?: UnitProps, magnitude?: number);
  // (undocumented)
  protected _isValid: boolean;
  // (undocumented)
  protected _magnitude: number;
  // (undocumented)
  protected _unit: UnitProps;
  convertTo(toUnit: UnitProps, conversion: UnitConversion): Quantity | undefined;
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  readonly magnitude: number;
  // (undocumented)
  readonly unit: UnitProps;
}

// @alpha
class QuantityError extends BentleyError {
  constructor(errorNumber: number, message?: string);
  // (undocumented)
  readonly errorNumber: number;
}

// @alpha
interface QuantityProps {
  // (undocumented)
  readonly isValid: boolean;
  // (undocumented)
  readonly magnitude: number;
  // (undocumented)
  readonly unit: UnitProps;
}

// @alpha
enum QuantityStatus {
  // (undocumented)
  InvalidCompositeFormat = 35041,
  // (undocumented)
  InvalidJson = 35040,
  // (undocumented)
  QUANTITY_ERROR_BASE = 35039,
  // (undocumented)
  Success = 0
}

// @alpha (undocumented)
enum ScientificType {
  // (undocumented)
  Normalized = 0,
  // (undocumented)
  ZeroNormalized = 1
}

// @alpha (undocumented)
enum ShowSignOption {
  // (undocumented)
  NegativeParentheses = 3,
  // (undocumented)
  NoSign = 0,
  // (undocumented)
  OnlyNegative = 1,
  // (undocumented)
  SignAlways = 2
}

// @alpha
interface UnitConversion {
  // (undocumented)
  factor: number;
  // (undocumented)
  offset: number;
}

// @public
interface UnitConversionSpec {
  // (undocumented)
  conversion: UnitConversion;
  // (undocumented)
  label: string;
  // (undocumented)
  name: string;
}

// @alpha
interface UnitProps {
  readonly isValid: boolean;
  readonly label: string;
  readonly name: string;
  readonly unitFamily: string;
}

// @alpha
interface UnitsProvider {
  // (undocumented)
  findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps>;
  // (undocumented)
  findUnitByName(unitName: string): Promise<UnitProps>;
  // (undocumented)
  getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion>;
}

// (No @packagedocumentation comment for this package)
