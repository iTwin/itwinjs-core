## API Report File for "@itwin/core-quantity"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { BeEvent } from '@itwin/core-bentley';
import { BentleyError } from '@itwin/core-bentley';

// @internal
export function almostEqual(a: number, b: number, tolerance?: number): boolean;

// @internal
export function almostZero(value: number): boolean;

// @beta
export interface AlternateUnitLabelsProvider {
    // (undocumented)
    getAlternateUnitLabels: (unit: UnitProps) => string[] | undefined;
}

// @internal
export function applyConversion(value: number, props: UnitConversionProps): number;

// @beta
export class BadUnit implements UnitProps {
    // (undocumented)
    isValid: boolean;
    // (undocumented)
    label: string;
    // (undocumented)
    name: string;
    // (undocumented)
    phenomenon: string;
    // (undocumented)
    system: string;
}

// @beta
export class BaseFormat {
    constructor(name: string);
    // (undocumented)
    get allowMathematicOperations(): boolean;
    set allowMathematicOperations(allowMathematicOperations: boolean);
    // (undocumented)
    protected _allowMathematicOperations: boolean;
    // (undocumented)
    get azimuthBase(): number | undefined;
    set azimuthBase(azimuthBase: number | undefined);
    // (undocumented)
    protected _azimuthBase?: number;
    // (undocumented)
    get azimuthBaseUnit(): UnitProps | undefined;
    set azimuthBaseUnit(azimuthBaseUnit: UnitProps | undefined);
    // (undocumented)
    protected _azimuthBaseUnit?: UnitProps;
    // (undocumented)
    get azimuthClockwiseOrDefault(): boolean;
    // (undocumented)
    get azimuthCounterClockwise(): boolean | undefined;
    set azimuthCounterClockwise(azimuthCounterClockwise: boolean | undefined);
    // (undocumented)
    protected _azimuthCounterClockwise?: boolean;
    // (undocumented)
    get decimalSeparator(): string;
    set decimalSeparator(decimalSeparator: string);
    // (undocumented)
    protected _decimalSeparator: string;
    // (undocumented)
    get formatTraits(): FormatTraits;
    set formatTraits(formatTraits: FormatTraits);
    // (undocumented)
    protected _formatTraits: FormatTraits;
    hasFormatTraitSet(formatTrait: FormatTraits): boolean;
    // (undocumented)
    get includeZero(): boolean | undefined;
    set includeZero(includeZero: boolean | undefined);
    // (undocumented)
    protected _includeZero: boolean;
    // (undocumented)
    loadFormatProperties(formatProps: FormatProps): void;
    // (undocumented)
    get minWidth(): number | undefined;
    set minWidth(minWidth: number | undefined);
    // (undocumented)
    protected _minWidth?: number;
    // (undocumented)
    get name(): string;
    parseFormatTraits(formatTraitsFromJson: string | string[]): void;
    // (undocumented)
    get precision(): DecimalPrecision | FractionalPrecision;
    set precision(precision: DecimalPrecision | FractionalPrecision);
    // (undocumented)
    protected _precision: number;
    // (undocumented)
    get ratioType(): RatioType | undefined;
    set ratioType(ratioType: RatioType | undefined);
    // (undocumented)
    protected _ratioType?: RatioType;
    // (undocumented)
    get revolutionUnit(): UnitProps | undefined;
    set revolutionUnit(revolutionUnit: UnitProps | undefined);
    // (undocumented)
    protected _revolutionUnit?: UnitProps;
    // (undocumented)
    get roundFactor(): number;
    set roundFactor(roundFactor: number);
    // (undocumented)
    protected _roundFactor: number;
    // (undocumented)
    get scientificType(): ScientificType | undefined;
    set scientificType(scientificType: ScientificType | undefined);
    // (undocumented)
    protected _scientificType?: ScientificType;
    // (undocumented)
    get showSignOption(): ShowSignOption;
    set showSignOption(showSignOption: ShowSignOption);
    // (undocumented)
    protected _showSignOption: ShowSignOption;
    // (undocumented)
    get spacer(): string | undefined;
    set spacer(spacer: string | undefined);
    // (undocumented)
    protected _spacer: string;
    // (undocumented)
    get spacerOrDefault(): string;
    // (undocumented)
    get stationOffsetSize(): number | undefined;
    set stationOffsetSize(stationOffsetSize: number | undefined);
    // (undocumented)
    protected _stationOffsetSize?: number;
    // (undocumented)
    get stationSeparator(): string;
    set stationSeparator(stationSeparator: string);
    // (undocumented)
    protected _stationSeparator: string;
    // (undocumented)
    get thousandSeparator(): string;
    set thousandSeparator(thousandSeparator: string);
    // (undocumented)
    protected _thousandSeparator: string;
    // (undocumented)
    get type(): FormatType;
    set type(formatType: FormatType);
    // (undocumented)
    protected _type: FormatType;
    // (undocumented)
    get uomSeparator(): string;
    set uomSeparator(uomSeparator: string);
    // (undocumented)
    protected _uomSeparator: string;
}

// @beta
export class BasicUnit implements UnitProps {
    constructor(name: string, label: string, phenomenon: string, system?: string);
    // (undocumented)
    isValid: boolean;
    // (undocumented)
    label: string;
    // (undocumented)
    name: string;
    // (undocumented)
    phenomenon: string;
    // (undocumented)
    system: string;
}

// @beta
export interface CloneOptions {
    precision?: DecimalPrecision | FractionalPrecision;
    primaryUnit?: CloneUnit;
    showOnlyPrimaryUnit?: boolean;
    traits?: FormatTraits;
    type?: FormatType;
}

// @beta
export interface CloneUnit {
    // (undocumented)
    label?: string;
    // (undocumented)
    unit?: UnitProps;
}

// @beta
export interface CustomFormatProps extends FormatProps {
    // (undocumented)
    readonly custom: any;
}

// @beta
export enum DecimalPrecision {
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

// @beta
export class Format extends BaseFormat {
    constructor(name: string);
    clone(options?: CloneOptions): Format;
    static createFromJSON(name: string, unitsProvider: UnitsProvider, formatProps: FormatProps): Promise<Format>;
    // (undocumented)
    get customProps(): any;
    // (undocumented)
    protected _customProps?: any;
    fromJSON(unitsProvider: UnitsProvider, jsonObj: FormatProps): Promise<void>;
    // (undocumented)
    get hasUnits(): boolean;
    // (undocumented)
    static isFormatTraitSetInProps(formatProps: FormatProps, trait: FormatTraits): boolean;
    toJSON(): FormatProps;
    // (undocumented)
    get units(): Array<[UnitProps, string | undefined]> | undefined;
    // (undocumented)
    protected _units?: Array<[UnitProps, string | undefined]>;
}

// @beta
export interface FormatDefinition extends FormatProps {
    // (undocumented)
    readonly description?: string;
    // (undocumented)
    readonly label?: string;
    // (undocumented)
    readonly name?: string;
}

// @beta
export interface FormatProps {
    // (undocumented)
    readonly allowMathematicOperations?: boolean;
    readonly azimuthBase?: number;
    readonly azimuthBaseUnit?: string;
    readonly azimuthCounterClockwise?: boolean;
    // (undocumented)
    readonly composite?: {
        readonly spacer?: string;
        readonly includeZero?: boolean;
        readonly units: Array<{
            readonly name: string;
            readonly label?: string;
        }>;
    };
    // (undocumented)
    readonly decimalSeparator?: string;
    // (undocumented)
    readonly formatTraits?: string | string[];
    // (undocumented)
    readonly minWidth?: number;
    // (undocumented)
    readonly precision?: number;
    readonly ratioType?: string;
    readonly revolutionUnit?: string;
    // (undocumented)
    readonly roundFactor?: number;
    readonly scientificType?: string;
    // (undocumented)
    readonly showSignOption?: string;
    readonly stationOffsetSize?: number;
    // (undocumented)
    readonly stationSeparator?: string;
    // (undocumented)
    readonly thousandSeparator?: string;
    // (undocumented)
    readonly type: string;
    // (undocumented)
    readonly uomSeparator?: string;
}

// @beta
export interface FormatsChangedArgs {
    formatsChanged: "all" | string[];
}

// @beta
export interface FormatsProvider {
    // (undocumented)
    getFormat(name: string): Promise<FormatDefinition | undefined>;
    // (undocumented)
    onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void>;
}

// @internal
export const formatStringRgx: RegExp;

// @beta
export class Formatter {
    static formatQuantity(magnitude: number, spec: FormatterSpec): string;
}

// @beta
export class FormatterSpec {
    constructor(name: string, format: Format, conversions?: UnitConversionSpec[], persistenceUnit?: UnitProps, azimuthBaseConversion?: UnitConversionProps, revolutionConversion?: UnitConversionProps);
    applyFormatting(magnitude: number): string;
    // (undocumented)
    get azimuthBaseConversion(): UnitConversionProps | undefined;
    // (undocumented)
    protected _azimuthBaseConversion?: UnitConversionProps;
    // (undocumented)
    protected _conversions: UnitConversionSpec[];
    static create(name: string, format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<FormatterSpec>;
    // (undocumented)
    get format(): Format;
    // (undocumented)
    protected _format: Format;
    static getUnitConversions(format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<UnitConversionSpec[]>;
    // (undocumented)
    get name(): string;
    // (undocumented)
    protected _name: string;
    // (undocumented)
    get persistenceUnit(): UnitProps;
    // (undocumented)
    protected _persistenceUnit: UnitProps;
    // (undocumented)
    get revolutionConversion(): UnitConversionProps | undefined;
    // (undocumented)
    protected _revolutionConversion?: UnitConversionProps;
    get unitConversions(): UnitConversionSpec[];
}

// @beta (undocumented)
export enum FormatTraits {
    ApplyRounding = 16,
    ExponentOnlyNegative = 512,
    FractionDash = 32,
    KeepDecimalPoint = 8,
    KeepSingleZero = 2,
    PrependUnitLabel = 128,
    ShowUnitLabel = 64,
    TrailZeroes = 1,
    // (undocumented)
    Uninitialized = 0,
    Use1000Separator = 256,
    ZeroEmpty = 4
}

// @beta (undocumented)
export function formatTraitsToArray(currentFormatTrait: FormatTraits): string[];

// @beta
export enum FormatType {
    Azimuth = "Azimuth",
    Bearing = "Bearing",
    Decimal = "Decimal",
    Fractional = "Fractional",
    Ratio = "Ratio",
    Scientific = "Scientific",
    Station = "Station"
}

// @beta @deprecated (undocumented)
export function formatTypeToString(type: FormatType): string;

// @beta
export enum FractionalPrecision {
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

// @internal (undocumented)
export function getItemNamesFromFormatString(formatString: string): Iterable<string>;

// @beta (undocumented)
export function getTraitString(trait: FormatTraits): "trailZeroes" | "keepSingleZero" | "zeroEmpty" | "keepDecimalPoint" | "applyRounding" | "fractionDash" | "showUnitLabel" | "prependUnitLabel" | "use1000Separator" | "exponentOnlyNegative";

// @beta
export const isCustomFormatProps: (item: FormatProps) => item is CustomFormatProps;

// @beta
export interface MutableFormatsProvider extends FormatsProvider {
    // (undocumented)
    addFormat(name: string, format: FormatDefinition): Promise<void>;
    // (undocumented)
    removeFormat(name: string): Promise<void>;
}

// @beta (undocumented)
export function parseDecimalPrecision(jsonObjPrecision: number, formatName: string): DecimalPrecision;

// @beta
export interface ParsedQuantity {
    ok: true;
    value: number;
}

// @beta
export enum ParseError {
    // (undocumented)
    BearingAngleOutOfRange = 9,
    // (undocumented)
    BearingPrefixOrSuffixMissing = 7,
    // (undocumented)
    InvalidParserSpec = 6,
    // (undocumented)
    MathematicOperationFoundButIsNotAllowed = 8,
    // (undocumented)
    NoValueOrUnitFoundInString = 2,
    // (undocumented)
    UnableToConvertParseTokensToQuantity = 5,
    // (undocumented)
    UnableToGenerateParseTokens = 1,
    // (undocumented)
    UnitLabelSuppliedButNotMatched = 3,
    // (undocumented)
    UnknownUnit = 4
}

// @beta (undocumented)
export function parseFormatTrait(formatTraitsString: string, formatName: string): FormatTraits;

// @beta (undocumented)
export function parseFormatType(jsonObjType: string, formatName: string): FormatType;

// @beta
export function parseFractionalPrecision(jsonObjPrecision: number, formatName: string): FractionalPrecision;

// @beta
export function parsePrecision(precision: number, type: FormatType, formatName: string): DecimalPrecision | FractionalPrecision;

// @beta
export interface ParseQuantityError {
    error: ParseError;
    ok: false;
}

// @beta
export class Parser {
    static createUnitConversionSpecs(unitsProvider: UnitsProvider, outUnitName: string, potentialParseUnits: PotentialParseUnit[], altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<UnitConversionSpec[]>;
    static createUnitConversionSpecsForUnit(unitsProvider: UnitsProvider, outUnit: UnitProps, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<UnitConversionSpec[]>;
    // (undocumented)
    static isParsedQuantity(item: QuantityParseResult): item is ParsedQuantity;
    // (undocumented)
    static isParseError(item: QuantityParseResult): item is ParseQuantityError;
    static parseIntoQuantity(inString: string, format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<QuantityProps>;
    static parseQuantitySpecification(quantitySpecification: string, format: Format): ParseToken[];
    static parseQuantityString(inString: string, parserSpec: ParserSpec): QuantityParseResult;
    // @deprecated
    static parseToQuantityValue(inString: string, format: Format, unitsConversions: UnitConversionSpec[]): QuantityParseResult;
}

// @beta (undocumented)
export function parseRatioType(ratioType: string, formatName: string): RatioType;

// @beta
export class ParserSpec {
    constructor(outUnit: UnitProps, format: Format, conversions: UnitConversionSpec[]);
    // (undocumented)
    get azimuthBaseConversion(): UnitConversionProps | undefined;
    // (undocumented)
    protected _azimuthBaseConversion?: UnitConversionProps;
    static create(format: Format, unitsProvider: UnitsProvider, outUnit: UnitProps, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<ParserSpec>;
    // (undocumented)
    get format(): Format;
    // (undocumented)
    get outUnit(): UnitProps;
    parseToQuantityValue(inString: string): QuantityParseResult;
    // (undocumented)
    get revolutionConversion(): UnitConversionProps | undefined;
    // (undocumented)
    protected _revolutionConversion?: UnitConversionProps;
    get unitConversions(): UnitConversionSpec[];
}

// @beta (undocumented)
export function parseScientificType(scientificType: string, formatName: string): ScientificType;

// @beta (undocumented)
export function parseShowSignOption(showSignOption: string, formatName: string): ShowSignOption;

// @beta
export interface PotentialParseUnit {
    // (undocumented)
    altLabels?: string[];
    // (undocumented)
    unitName: string;
}

// @beta
export class Quantity implements QuantityProps {
    constructor(unit?: UnitProps, magnitude?: number);
    convertTo(toUnit: UnitProps, conversion: UnitConversionProps): Quantity | undefined;
    // (undocumented)
    get isValid(): boolean;
    // (undocumented)
    protected _isValid: boolean;
    // (undocumented)
    get magnitude(): number;
    // (undocumented)
    protected _magnitude: number;
    // (undocumented)
    get unit(): UnitProps;
    // (undocumented)
    protected _unit: UnitProps;
}

// @internal
export class QuantityConstants {
    // (undocumented)
    static readonly CHAR_COMMA = 44;
    // (undocumented)
    static readonly CHAR_DIGIT_NINE = 57;
    // (undocumented)
    static readonly CHAR_DIGIT_ZERO = 48;
    // (undocumented)
    static readonly CHAR_DIVISION_SLASH = 8725;
    // (undocumented)
    static readonly CHAR_FRACTION_SLASH = 8260;
    // (undocumented)
    static readonly CHAR_LOWER_E = 101;
    // (undocumented)
    static readonly CHAR_MINUS = 45;
    // (undocumented)
    static readonly CHAR_NUMBER = 35;
    // (undocumented)
    static readonly CHAR_ONE_HALF = 189;
    // (undocumented)
    static readonly CHAR_ONE_QUARTER = 188;
    // (undocumented)
    static readonly CHAR_PERIOD = 46;
    // (undocumented)
    static readonly CHAR_PLUS = 43;
    // (undocumented)
    static readonly CHAR_SLASH = 47;
    // (undocumented)
    static readonly CHAR_SPACE = 32;
    // (undocumented)
    static readonly CHAR_THREE_QUARTER = 190;
    // (undocumented)
    static readonly CHAR_UPPER_E = 69;
    static get LocaleSpecificDecimalSeparator(): string;
    static get LocaleSpecificThousandSeparator(): string;
}

// @beta
export class QuantityError extends BentleyError {
    constructor(errorNumber: number, message?: string);
    // (undocumented)
    readonly errorNumber: number;
}

// @beta
export type QuantityParseResult = ParsedQuantity | ParseQuantityError;

// @beta
export interface QuantityProps {
    // (undocumented)
    readonly isValid: boolean;
    // (undocumented)
    readonly magnitude: number;
    // (undocumented)
    readonly unit: UnitProps;
}

// @beta
export enum QuantityStatus {
    // (undocumented)
    InvalidCompositeFormat = 35041,
    // (undocumented)
    InvalidJson = 35040,
    // (undocumented)
    InvertingZero = 35049,
    // (undocumented)
    MissingRequiredProperty = 35048,
    // (undocumented)
    NoValueOrUnitFoundInString = 35043,
    // (undocumented)
    QUANTITY_ERROR_BASE = 35039,
    // (undocumented)
    Success = 0,
    // (undocumented)
    UnableToConvertParseTokensToQuantity = 35046,
    // (undocumented)
    UnableToGenerateParseTokens = 35042,
    // (undocumented)
    UnitLabelSuppliedButNotMatched = 35044,
    // (undocumented)
    UnknownUnit = 35045,
    // (undocumented)
    UnsupportedUnit = 35047
}

// @beta
export enum RatioType {
    NToOne = "NToOne",
    OneToN = "OneToN",
    UseGreatestCommonDivisor = "UseGreatestCommonDivisor",
    ValueBased = "ValueBased"
}

// @beta
export enum ScientificType {
    Normalized = "Normalized",
    ZeroNormalized = "ZeroNormalized"
}

// @beta @deprecated (undocumented)
export function scientificTypeToString(scientificType: ScientificType): string;

// @beta
export enum ShowSignOption {
    NegativeParentheses = "NegativeParentheses",
    NoSign = "NoSign",
    OnlyNegative = "OnlyNegative",
    SignAlways = "SignAlways"
}

// @beta @deprecated (undocumented)
export function showSignOptionToString(showSign: ShowSignOption): string;

// @beta
export enum UnitConversionInvert {
    InvertPostConversion = "InvertPostConversion",
    InvertPreConversion = "InvertPreConversion"
}

// @beta
export interface UnitConversionProps {
    factor: number;
    inversion?: UnitConversionInvert;
    offset: number;
}

// @beta
export interface UnitConversionSpec {
    conversion: UnitConversionProps;
    label: string;
    name: string;
    parseLabels?: string[];
    system: string;
}

// @alpha
export interface UnitExtraData {
    // (undocumented)
    readonly altDisplayLabels: string[];
    // (undocumented)
    readonly name: string;
}

// @beta
export interface UnitProps {
    readonly isValid: boolean;
    readonly label: string;
    readonly name: string;
    readonly phenomenon: string;
    readonly system: string;
}

// @beta
export interface UnitsProvider {
    // (undocumented)
    findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps>;
    // (undocumented)
    findUnitByName(unitName: string): Promise<UnitProps>;
    // (undocumented)
    getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps>;
    // (undocumented)
    getUnitsByFamily(phenomenon: string): Promise<UnitProps[]>;
}

// @beta
export type UnitSystemKey = "metric" | "imperial" | "usCustomary" | "usSurvey";

// (No @packageDocumentation comment for this package)

```
