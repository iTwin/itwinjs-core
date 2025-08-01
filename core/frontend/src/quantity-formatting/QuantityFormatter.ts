/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormatting
 */

import { BeEvent, BentleyError, BeUiEvent, Logger } from "@itwin/core-bentley";
import {
  AlternateUnitLabelsProvider, Format, FormatDefinition, FormatProps, FormatsChangedArgs, FormatsProvider, FormatterSpec, ParseError, ParserSpec, QuantityParseResult,
  UnitConversionProps, UnitProps, UnitsProvider, UnitSystemKey,
} from "@itwin/core-quantity";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { BasicUnitsProvider, getDefaultAlternateUnitLabels } from "./BasicUnitsProvider";
import { CustomFormatPropEditorSpec } from "./QuantityTypesEditorSpecs";

// cSpell:ignore FORMATPROPS FORMATKEY ussurvey uscustomary USCUSTOM

/**
 * Defines standard format types for tools that need to display measurements to user.
 * @public
 */
export enum QuantityType {
  /** Length which is stored in meters. Typically formatted to display in meters or feet-inches based on active unit system. */
  Length = 1,
  /** Angular value which is stored in radians. Typically formatted to display degrees or Degrees-Minute-Seconds based on active unit system. */
  Angle = 2,
  /** Area value store in meters squared. Typically formatted to display in meters squared or feet squared based on active unit system. */
  Area = 3,
  /** Volume value which is stored in meters cubed. Typically formatted to display in meters cubed or feet cubed based on active unit system. */
  Volume = 4,
  /** LatLong is an angular value which is stored in radians. Typically formatted to display degrees or Degrees-Minute-Seconds based on active unit system. */
  LatLong = 5,
  /** Coordinate/Location value which is stored in meters. Typically formatted to display in meters or feet based on active unit system. */
  Coordinate = 6,
  /** Stationing is a distance value stored in meters. Typically formatted to display `xxx+xx` or `xx+xxx` based on active unit system. */
  Stationing = 7,
  /** LengthSurvey is a distance value stored in meters. Typically formatted to display in meters or US Survey Feet based on active unit system.. */
  LengthSurvey = 8,
  /** LengthEngineering is a distance value stored in meters. Typically formatted to display either meters or feet based on active unit system. */
  LengthEngineering = 9
}

/**
 * Used to uniquely identify the type or quantity. [[QuantityType]] are built-in types and `string` are used for custom quantity types.
 * @public
 */
export type QuantityTypeArg = QuantityType | string;

/** String used to uniquely identify a QuantityType in the quantity registry. See function [[QuantityType.getQuantityTypeKey]].
 * @public
 */
export type QuantityTypeKey = string;

/** String used to uniquely identify a UnitProp.
 * @public
 */
export type UnitNameKey = string;

/**
 * Interface for the properties required to create a FormatterSpec or ParserSpec.
 * @beta
 */
export interface CreateFormattingSpecProps {
  /** The name of the persistence unit. */
  persistenceUnitName: string;
  /** The format properties to use for the spec. */
  formatProps: FormatProps;
  /** Optional name for the format. */
  formatName?: string;
}

/**
 * Class that contains alternate Unit Labels. These labels are used when parsing strings to quantities.
 * One use case is to allow a "^", which is easily input, to be used to specify "°".
 * @internal
 */
export class AlternateUnitLabelsRegistry implements AlternateUnitLabelsProvider {
  private _alternateLabelRegistry = new Map<UnitNameKey, Set<string>>();

  public addAlternateLabels(key: UnitNameKey, ...labels: string[]) {
    [...labels].forEach((value) => this._alternateLabelRegistry.get(key)?.add(value));
  }

  constructor(defaultAlternates?: Map<UnitNameKey, Set<string>>) {
    if (defaultAlternates) {
      this._alternateLabelRegistry = defaultAlternates;
    }
  }

  public getAlternateUnitLabels(unit: UnitProps): string[] | undefined {
    const key: UnitNameKey = unit.name;
    const labels = this._alternateLabelRegistry.get(key);
    if (labels)
      return [...labels.values()];

    return undefined;
  }
}

/**
 * Function to return a QuantityTypeKey given either a QuantityType enum value or a string. This allows caching and
 * retrieving standard and custom quantity types.
 * @public
 */
export function getQuantityTypeKey(type: QuantityTypeArg): QuantityTypeKey {
  // For QuantityType enum values, build a string that shouldn't collide with anything a user may come up with
  if (typeof type === "number")
    return `QuantityTypeEnumValue-${type.toString()}`;
  return type;
}

/**
 * This interface supplies the definition of a `standard` quantity type that is registered with the QuantityFormatter.
 * A `standard` quantity type could be one of the nine delivered QuantityTypes or a CustomQuantityTypeDefinition.
 * @public
 */
export interface QuantityTypeDefinition {
  /** String used as a key to look up the quantity type. If defining a [[CustomQuantityTypeDefinition]] the QuantityTypeKey
   * should match the QuantityTypeArg. */
  readonly key: QuantityTypeKey;
  /** The type value which can be one of the standard QuantityType enum values or a unique string if defining a custom type. */
  readonly type: QuantityTypeArg;
  /** The unit that the magnitude of the quantity is stored ie. (Meter for Length and Radian for Angle). The persistence unit is
   * also used during formatting if the FormatProps does not define one or more composite units.  */
  readonly persistenceUnit: UnitProps;
  /** Localized label to display in UI */
  label: string;
  /** Localized description that may be used to provide detailed description for the Quantity type. */
  description: string;
  /* Provide a default FormatProps for a unit system. */
  getDefaultFormatPropsBySystem: (requestedSystem: UnitSystemKey) => FormatProps;
  /** Async function to generate a [FormatterSpec]$(core-quantity) that will be called to format values.*/
  generateFormatterSpec: (formatProps: FormatProps, unitsProvider: UnitsProvider) => Promise<FormatterSpec>;
  /** Async function to generate a [ParserSpec]$(core-quantity) that will be called to parse a string into a quantity value.*/
  generateParserSpec: (formatProps: FormatProps, unitsProvider: UnitsProvider, alternateUnitLabelsProvider?: AlternateUnitLabelsProvider) => Promise<ParserSpec>;
}

/** CustomQuantityTypeDefinition interface is used to define a Custom quantity type that can be registered with the [[QuantityFormatter]].
 * A custom quantity formatter must be able to generate a FormatterSpec and ParserSpec that will be called to format and parse values.
 * Optionally it can provide specification of custom properties that it will use to define any formatting options. CustomQuantityTypeDefinitions
 * must be registered with the [[QuantityFormatter]] using the method `IModelApp.quantityFormatter.registerQuantityType`.
 * @public
 */
export interface CustomQuantityTypeDefinition extends QuantityTypeDefinition {
  /** Return true if the FormatProps have the necessary `custom` property definition */
  isCompatibleFormatProps: (formatProps: FormatProps) => boolean;
  /** An array of specifications that are used to generate a label and editor in the UI used to display and edit the FormatProps.
   * UI items defined as primary will be shown higher in the list of UI components. */
  primaryPropEditorSpecs?: CustomFormatPropEditorSpec[];
  /** An array of specifications that are used to generate a label and editor in the UI used to display and edit the FormatProps.
   * UI items defined as secondary will be shown below other UI components that edit FormatProps. */
  secondaryPropEditorSpecs?: CustomFormatPropEditorSpec[];
}

/** CustomQuantityTypeDefinition type guard.
 * @public
*/
export function isCustomQuantityTypeDefinition(item: QuantityTypeDefinition): item is CustomQuantityTypeDefinition {
  return !!(item as CustomQuantityTypeDefinition).isCompatibleFormatProps;
}

/** private class to hold standard quantity definitions as defined by QuantityType enum and implement QuantityTypeDefinition interface */
class StandardQuantityTypeDefinition implements QuantityTypeDefinition {
  private _label: string | undefined;
  private _description: string | undefined;
  private _key: string;

  constructor(public type: QuantityType, public persistenceUnit: UnitProps, private _labelKey: string, private _descriptionKey: string) {
    this._key = getQuantityTypeKey(type);
  }

  public get key(): string { return this._key; }

  public get label(): string {
    if (!this._label) {
      this._label = IModelApp.localization.getLocalizedString(this._labelKey);
    }
    return this._label ?? "";
  }

  public get description(): string {
    if (!this._description) {
      this._description = IModelApp.localization.getLocalizedString(this._descriptionKey);
    }
    return this._description ?? this.label;
  }

  /** Get a default format to show quantity in persistence unit with precision or 6 decimal places.  */
  public getDefaultFormatPropsBySystem(requestedSystem: UnitSystemKey): FormatProps {
    // Fallback same as Format "DefaultRealU" in Formats ecschema
    const fallbackProps: FormatProps = {
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 6,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: ".",
    };

    const defaultUnitSystemData = DEFAULT_FORMATKEY_BY_UNIT_SYSTEM.find((value) => value.system === requestedSystem);
    if (defaultUnitSystemData) {
      const defaultFormatEntry = defaultUnitSystemData.entries.find((value) => value.type === this.key);
      if (defaultFormatEntry) {
        const defaultFormatPropsEntry = DEFAULT_FORMATPROPS.find((props) => props.key === defaultFormatEntry.formatKey);
        if (defaultFormatPropsEntry)
          return defaultFormatPropsEntry.format;
      }
    }

    return fallbackProps;
  }

  public async generateFormatterSpec(formatProps: FormatProps, unitsProvider: UnitsProvider): Promise<FormatterSpec> {
    const format = await Format.createFromJSON(this.key, unitsProvider, formatProps);
    return FormatterSpec.create(format.name, format, unitsProvider, this.persistenceUnit);
  }

  public async generateParserSpec(formatProps: FormatProps, unitsProvider: UnitsProvider, alternateUnitLabelsProvider?: AlternateUnitLabelsProvider) {
    const format = await Format.createFromJSON(this.key, unitsProvider, formatProps);
    return ParserSpec.create(format, unitsProvider, this.persistenceUnit, alternateUnitLabelsProvider);
  }
}

/** Override format entries can define formats for any of the different unit systems.
 * @public
 */
export interface OverrideFormatEntry {
  /** Override format for "imperial" unit system */
  imperial?: FormatProps;
  /** Override format for "metric" unit system */
  metric?: FormatProps;
  /** Override format for "usCustomary" unit system */
  usCustomary?: FormatProps;
  /** Override format for "usSurvey" unit system */
  usSurvey?: FormatProps;
}

/**
 * Entries returned when looking up specs from the [[QuantityFormatter._formatSpecsRegistry]]
 * @beta
 */
export interface FormattingSpecEntry {
  formatterSpec: FormatterSpec;
  parserSpec: ParserSpec;
}
/** Interface that defines the functions required to be implemented to provide custom formatting and parsing of a custom quantity type.
 * @public
 */
export interface FormatterParserSpecsProvider {
  /** Custom quantity id */
  quantityType: QuantityTypeArg;
  /** Async function to return FormatterSpec for a custom quantity type */
  createFormatterSpec: (unitSystem: UnitSystemKey) => Promise<FormatterSpec>;
  /** Async function to return ParserSpec for a custom quantity type */
  createParserSpec: (unitSystem: UnitSystemKey) => Promise<ParserSpec>;
}

/** Arguments sent to FormattingUnitSystemChanged event listeners.
 * @public
 */
export interface FormattingUnitSystemChangedArgs {
  /** string that defines unit system activated. */
  readonly system: UnitSystemKey;
}

/** Arguments sent to QuantityFormatsChanged event listeners.
 * @public
 */
export interface QuantityFormatsChangedArgs {
  /** string that represents the QuantityType that has been overriden or the overrides cleared. */
  readonly quantityType: string;
}

/** Arguments sent to [[UnitFormattingSettingsProvider]] when overrides are changed.
 * @public
 */
export interface QuantityFormatOverridesChangedArgs {
  /** string that represents the QuantityType that has been overriden or the overrides cleared. */
  readonly typeKey: QuantityTypeKey;
  /** overrideEntry will be undefined when clearing overrides */
  readonly overrideEntry?: OverrideFormatEntry;
  /** used only when change applies to a single unit system */
  readonly unitSystem?: UnitSystemKey;
}

/**
 * The UnitFormattingSettingsProvider interface is used to store and retrieve override FormatProps and Presentation Unit System
 * for use by the QuantityFormatter. If no UnitFormattingSettingsProvider is supplied to the QuantityFormatter then any overrides
 * set are lost when the session is closed. The `ui-test-app` has and example implementation that uses browser local storage via the
 * class [[LocalUnitFormatProvider]] [here](https://github.com/iTwin/itwinjs-core/blob/d341e030d4c1427effd80ea54b3d57fec8ad1bc1/test-apps/ui-test-app/src/frontend/index.tsx#L315).
 *  @public
 */
export interface UnitFormattingSettingsProvider {
  /** serializes JSON object containing format overrides for a specific quantity type. */
  store(quantityTypeKey: QuantityTypeKey, overrideProps: OverrideFormatEntry): Promise<boolean>;
  /** retrieves serialized JSON object containing format overrides for a specific quantity type. */
  retrieve(quantityTypeKey: QuantityTypeKey): Promise<OverrideFormatEntry | undefined>;
  /** removes the override formats for a specific quantity type. */
  remove(quantityTypeKey: QuantityTypeKey): Promise<boolean>;
  /** retrieves the active unit system typically based on the "active" iModelConnection */
  retrieveUnitSystem(defaultKey: UnitSystemKey): Promise<UnitSystemKey>;
  /** store the active unit system typically for the "active" iModelConnection */
  storeUnitSystemKey(unitSystemKey: UnitSystemKey): Promise<boolean>;
  /** Function to load overrides for a specific IModelConnection. Typically this is not called often since typical
   * implementations monitor for IModelConnection changes and call this method internally. */
  loadOverrides(imodel: IModelConnection | undefined): Promise<void>;
  /** function called to save changes to Presentation Unit System */
  storeUnitSystemSetting(args: FormattingUnitSystemChangedArgs): Promise<void>;
  /** function called to save format overrides */
  storeFormatOverrides(args: QuantityFormatOverridesChangedArgs): Promise<void>;
  /** property that is set by the implementation to inform the BaseUnitFormattingSettingsProvider if the provider
   *  should trigger reloading of the overrides when the "active" imodel changes. */
  readonly maintainOverridesPerIModel: boolean;
}

/**
 * A default formatsProvider, that provides a limited set of [[FormatDefinition]], associated to a few [[KindOfQuantity]].
 * Maps each KindOfQuantity to a [[QuantityType]].
 * When retrieving a valid [[KindOfQuantity]], returns the [[FormatProps]] for the associated [[QuantityType]].
 * @internal
 */
export class QuantityTypeFormatsProvider implements FormatsProvider {
  public onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();

  public constructor() {
    IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(() => {
      this.onFormatsChanged.raiseEvent({ formatsChanged: "all" });
    });
  }
  private _kindOfQuantityMap = new Map<string, QuantityType>([
    ["AecUnits.LENGTH", QuantityType.Length],
    ["AecUnits.ANGLE", QuantityType.Angle],
    ["AecUnits.AREA", QuantityType.Area],
    ["AecUnits.VOLUME", QuantityType.Volume],
    ["RoadRailUnits.STATION", QuantityType.Stationing],
    ["RoadRailUnits.LENGTH", QuantityType.LengthSurvey],
  ]);

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    const quantityType = this._kindOfQuantityMap.get(name);
    if (!quantityType) return undefined;

    return IModelApp.quantityFormatter.getFormatPropsByQuantityType(quantityType);
  }
}

/**
 * An implementation of the [[FormatsProvider]] interface that forwards calls to getFormats to the underlying FormatsProvider.
 * Also fires the onFormatsChanged event when the underlying FormatsProvider fires its own onFormatsChanged event.
 * @internal
 */
export class FormatsProviderManager implements FormatsProvider {
  public onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();

  constructor(private _formatsProvider: FormatsProvider) {
    this._formatsProvider.onFormatsChanged.addListener((args: FormatsChangedArgs) => {
      this.onFormatsChanged.raiseEvent(args);
    });
  }

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    return this._formatsProvider.getFormat(name);
  }

  public get formatsProvider(): FormatsProvider { return this; }

  public set formatsProvider(formatsProvider: FormatsProvider) {
    this._formatsProvider = formatsProvider;
    this._formatsProvider.onFormatsChanged.addListener((args: FormatsChangedArgs) => {
      this.onFormatsChanged.raiseEvent(args);
    });
    this.onFormatsChanged.raiseEvent({ formatsChanged: "all" });
  }
}
/** Class that supports formatting quantity values into strings and parsing strings into quantity values. This class also maintains
 * the "active" unit system and caches FormatterSpecs and ParserSpecs for the "active" unit system to allow synchronous access to
 * parsing and formatting values. The support unit systems are defined by [[UnitSystemKey]] and is kept in synch with the unit systems
 * provided by the Presentation Manager on the backend. The QuantityFormatter contains a registry of quantity type definitions. These definitions implement
 * the [[QuantityTypeDefinition]] interface, which among other things, provide default [[FormatProps]], and provide methods
 * to generate both a [[FormatterSpec]] and a [[ParserSpec]]. There are built-in quantity types that are
 * identified by the [[QuantityType]] enum. [[CustomQuantityTypeDefinition]] can be registered to extend the available quantity types available
 * by frontend tools. The QuantityFormatter also allows the default formats to be overriden.
 *
 * @public
 */
export class QuantityFormatter implements UnitsProvider {
  private _unitsProvider: UnitsProvider = new BasicUnitsProvider();
  private _alternateUnitLabelsRegistry = new AlternateUnitLabelsRegistry(getDefaultAlternateUnitLabels());
  /** Registry containing available quantity type definitions. */
  protected _quantityTypeRegistry: Map<QuantityTypeKey, QuantityTypeDefinition> = new Map<QuantityTypeKey, QuantityTypeDefinition>();
  /** Registry containing available FormatterSpec and ParserSpec, mapped by keys.
   * @beta
   */
  protected _formatSpecsRegistry: Map<string, FormattingSpecEntry> = new Map<string, FormattingSpecEntry>();

  /** Active UnitSystem key - must be one of "imperial", "metric", "usCustomary", or "usSurvey". */
  protected _activeUnitSystem: UnitSystemKey = "imperial";
  /** Map of FormatSpecs for all available QuantityTypes and the active Unit System */
  protected _activeFormatSpecsByType = new Map<QuantityTypeKey, FormatterSpec>();
  /** Map of ParserSpecs for all available QuantityTypes and the active Unit System */
  protected _activeParserSpecsByType = new Map<QuantityTypeKey, ParserSpec>();
  /** Map of FormatSpecs that have been overriden from the default. */
  protected _overrideFormatPropsByUnitSystem = new Map<UnitSystemKey, Map<QuantityTypeKey, FormatProps>>();
  /** Optional object that gets called to store and retrieve format overrides. */
  protected _unitFormattingSettingsProvider: UnitFormattingSettingsProvider | undefined;

  /** Set the settings provider and if not iModel specific initialize setting for user. */
  public async setUnitFormattingSettingsProvider(provider: UnitFormattingSettingsProvider) {
    this._unitFormattingSettingsProvider = provider;
    if (!provider.maintainOverridesPerIModel)
      await provider.loadOverrides(undefined);
  }

  /** Called after the active unit system is changed.
  * The system will report the UnitSystemKey/name of the the system that was activated.
  */
  public readonly onActiveFormattingUnitSystemChanged = new BeUiEvent<FormattingUnitSystemChangedArgs>();

  /** Called when the format of a QuantityType is overriden or the override is cleared. The string returned will
   * be a QuantityTypeKey generated by method `getQuantityTypeKey`.
   */
  public readonly onQuantityFormatsChanged = new BeUiEvent<QuantityFormatsChangedArgs>();

  /** Fired when the active UnitsProvider is updated. This will allow cached Formatter and Parser specs to be updated if necessary. */
  public readonly onUnitsProviderChanged = new BeUiEvent<void>();

  private _removeFormatsProviderListener?: () => void;
  /**
   * constructor
   * @param showMetricOrUnitSystem - Pass in `true` to show Metric formatted quantity values. Defaults to Imperial. To explicitly
   * set it to a specific unit system pass a UnitSystemKey.
   */
  constructor(showMetricOrUnitSystem?: boolean | UnitSystemKey) {
    if (undefined !== showMetricOrUnitSystem) {
      if (typeof showMetricOrUnitSystem === "boolean")
        this._activeUnitSystem = showMetricOrUnitSystem ? "metric" : "imperial";
      else
        this._activeUnitSystem = showMetricOrUnitSystem;
    }
  }

  public [Symbol.dispose](): void {
    if (this._removeFormatsProviderListener) {
      this._removeFormatsProviderListener();
      this._removeFormatsProviderListener = undefined;
    }
  }

  private getOverrideFormatPropsByQuantityType(quantityTypeKey: QuantityTypeKey, unitSystem?: UnitSystemKey): FormatProps | undefined {
    const requestedUnitSystem = unitSystem ?? this.activeUnitSystem;
    const overrideMap = this._overrideFormatPropsByUnitSystem.get(requestedUnitSystem);
    if (!overrideMap)
      return undefined;

    return overrideMap.get(quantityTypeKey);
  }

  /** Method used to register all QuantityTypes defined in QuantityType enum. */
  protected async initializeQuantityTypesRegistry() {
    // QuantityType.Length
    const lengthUnit = await this.findUnitByName("Units.M");
    const lengthDefinition = new StandardQuantityTypeDefinition(QuantityType.Length, lengthUnit,
      "iModelJs:QuantityType.Length.label", "iModelJs:QuantityType.Length.description");
    this._quantityTypeRegistry.set(lengthDefinition.key, lengthDefinition);

    // QuantityType.LengthEngineering
    const lengthEngineeringDefinition = new StandardQuantityTypeDefinition(QuantityType.LengthEngineering, lengthUnit,
      "iModelJs:QuantityType.LengthEngineering.label", "iModelJs:QuantityType.LengthEngineering.description");
    this._quantityTypeRegistry.set(lengthEngineeringDefinition.key, lengthEngineeringDefinition);

    // QuantityType.Coordinate
    const coordinateDefinition = new StandardQuantityTypeDefinition(QuantityType.Coordinate, lengthUnit,
      "iModelJs:QuantityType.Coordinate.label", "iModelJs:QuantityType.Coordinate.description");
    this._quantityTypeRegistry.set(coordinateDefinition.key, coordinateDefinition);

    // QuantityType.Stationing
    const stationingDefinition = new StandardQuantityTypeDefinition(QuantityType.Stationing, lengthUnit,
      "iModelJs:QuantityType.Stationing.label", "iModelJs:QuantityType.Stationing.description");
    this._quantityTypeRegistry.set(stationingDefinition.key, stationingDefinition);

    // QuantityType.LengthSurvey
    const lengthSurveyDefinition = new StandardQuantityTypeDefinition(QuantityType.LengthSurvey, lengthUnit,
      "iModelJs:QuantityType.LengthSurvey.label", "iModelJs:QuantityType.LengthSurvey.description");
    this._quantityTypeRegistry.set(lengthSurveyDefinition.key, lengthSurveyDefinition);

    // QuantityType.Angle
    const radUnit = await this.findUnitByName("Units.RAD");
    const angleDefinition = new StandardQuantityTypeDefinition(QuantityType.Angle, radUnit,
      "iModelJs:QuantityType.Angle.label", "iModelJs:QuantityType.Angle.description");
    this._quantityTypeRegistry.set(angleDefinition.key, angleDefinition);

    // QuantityType.LatLong
    const latLongDefinition = new StandardQuantityTypeDefinition(QuantityType.LatLong, radUnit,
      "iModelJs:QuantityType.LatLong.label", "iModelJs:QuantityType.LatLong.description");
    this._quantityTypeRegistry.set(latLongDefinition.key, latLongDefinition);

    // QuantityType.Area
    const sqMetersUnit = await this.findUnitByName("Units.SQ_M");
    const areaDefinition = new StandardQuantityTypeDefinition(QuantityType.Area, sqMetersUnit,
      "iModelJs:QuantityType.Area.label", "iModelJs:QuantityType.Area.description");
    this._quantityTypeRegistry.set(areaDefinition.key, areaDefinition);

    // QuantityType.Volume
    const cubicMetersUnit = await this.findUnitByName("Units.CUB_M");
    const volumeDefinition = new StandardQuantityTypeDefinition(QuantityType.Volume, cubicMetersUnit,
      "iModelJs:QuantityType.Volume.label", "iModelJs:QuantityType.Volume.description");
    this._quantityTypeRegistry.set(volumeDefinition.key, volumeDefinition);
  }

  /** Asynchronous call to load Formatting and ParsingSpecs for a unit system. This method ends up caching FormatterSpecs and ParserSpecs
   *  so they can be quickly accessed.
   * @internal public for unit test usage
   */
  protected async loadFormatAndParsingMapsForSystem(systemType?: UnitSystemKey): Promise<void> {
    const systemKey = (undefined !== systemType) ? systemType : this._activeUnitSystem;
    const formatPropsByType = new Map<QuantityTypeDefinition, FormatProps>();

    // load cache for every registered QuantityType
    [...this.quantityTypesRegistry.keys()].forEach((key) => {
      const entry = this.quantityTypesRegistry.get(key)!;
      formatPropsByType.set(entry, this.getFormatPropsByQuantityTypeEntryAndSystem(entry, systemKey));
    });

    for (const [entry, formatProps] of formatPropsByType) {
      await this.loadFormatAndParserSpec(entry, formatProps);
    }
  }

  private getFormatPropsByQuantityTypeEntryAndSystem(quantityEntry: QuantityTypeDefinition, requestedSystem: UnitSystemKey, ignoreOverrides?: boolean): FormatProps {
    if (!ignoreOverrides) {
      const overrideProps = this.getOverrideFormatPropsByQuantityType(quantityEntry.key, requestedSystem);
      if (overrideProps)
        return overrideProps;
    }

    return quantityEntry.getDefaultFormatPropsBySystem(requestedSystem);
  }

  private async loadFormatAndParserSpec(quantityTypeDefinition: QuantityTypeDefinition, formatProps: FormatProps) {
    const formatterSpec = await quantityTypeDefinition.generateFormatterSpec(formatProps, this.unitsProvider);
    const parserSpec = await quantityTypeDefinition.generateParserSpec(formatProps, this.unitsProvider, this.alternateUnitLabelsProvider);
    this._activeFormatSpecsByType.set(quantityTypeDefinition.key, formatterSpec);
    this._activeParserSpecsByType.set(quantityTypeDefinition.key, parserSpec);
  }

  // repopulate formatSpec and parserSpec entries using only default format
  private async loadDefaultFormatAndParserSpecForQuantity(typeKey: QuantityTypeKey) {
    const quantityTypeDefinition = this.quantityTypesRegistry.get(typeKey);
    if (!quantityTypeDefinition)
      throw new Error(`Unable to locate QuantityType by key ${typeKey}`);

    const defaultFormat = quantityTypeDefinition.getDefaultFormatPropsBySystem(this.activeUnitSystem);
    await this.loadFormatAndParserSpec(quantityTypeDefinition, defaultFormat);
  }

  private async setOverrideFormatsByQuantityTypeKey(typeKey: QuantityTypeKey, overrideEntry: OverrideFormatEntry) {
    // extract overrides and insert into appropriate override map entry
    Object.keys(overrideEntry).forEach((systemKey) => {
      const unitSystemKey = systemKey as UnitSystemKey;
      const props = overrideEntry[unitSystemKey];
      if (props) {
        if (this._overrideFormatPropsByUnitSystem.has(unitSystemKey)) {
          this._overrideFormatPropsByUnitSystem.get(unitSystemKey)!.set(typeKey, props);
        } else {
          const newMap = new Map<string, FormatProps>();
          newMap.set(typeKey, props);
          this._overrideFormatPropsByUnitSystem.set(unitSystemKey, newMap);
        }
      }
    });

    await this._unitFormattingSettingsProvider?.storeFormatOverrides({ typeKey, overrideEntry });

    const formatProps = this.getOverrideFormatPropsByQuantityType(typeKey, this.activeUnitSystem);
    if (formatProps) {
      const typeEntry = this.quantityTypesRegistry.get(typeKey);
      if (typeEntry) {
        await this.loadFormatAndParserSpec(typeEntry, formatProps);
        // trigger a message to let callers know the format has changed.
        this.onQuantityFormatsChanged.emit({ quantityType: typeKey });
      }
    }
  }

  /** Method called to clear override and restore defaults formatter and parser spec */
  private async clearOverrideFormatsByQuantityTypeKey(type: QuantityTypeKey) {
    const unitSystem = this.activeUnitSystem;
    if (this.getOverrideFormatPropsByQuantityType(type, unitSystem)) {
      const overrideMap = this._overrideFormatPropsByUnitSystem.get(unitSystem);
      if (overrideMap && overrideMap.has(type)) {
        overrideMap.delete(type);
        await this._unitFormattingSettingsProvider?.storeFormatOverrides({ typeKey: type, unitSystem });

        await this.loadDefaultFormatAndParserSpecForQuantity(type);
        // trigger a message to let callers know the format has changed.
        this.onQuantityFormatsChanged.emit({ quantityType: type });
      }
    }
  }

  /** This method is called during IModelApp initialization to load the standard quantity types into the registry and to initialize the cache.
   * @internal
   */
  public async onInitialized() {
    await this.initializeQuantityTypesRegistry();

    const initialKoQs = [["AecUnits.LENGTH", "Units.M"], ["AecUnits.ANGLE", "Units.RAD"], ["AecUnits.AREA", "Units.SQ_M"], ["AecUnits.VOLUME", "Units.CUB_M"], ["RoadRailUnits.STATION", "Units.M"], ["RoadRailUnits.LENGTH", "Units.M"]];
    for (const entry of initialKoQs) {
      try {
        await this.addFormattingSpecsToRegistry(entry[0], entry[1]);
      } catch (err: any) {
        Logger.logWarning(`${FrontendLoggerCategory.Package}.QuantityFormatter`, err.toString());
      }
    }
    this._removeFormatsProviderListener = IModelApp.formatsProvider.onFormatsChanged.addListener(async (args: FormatsChangedArgs) => {
      if (args.formatsChanged === "all") {
        for (const [name, entry] of this._formatSpecsRegistry.entries()) {
          const formatProps = await IModelApp.formatsProvider.getFormat(name);
          if (formatProps) {
            const persistenceUnitName = entry.formatterSpec.persistenceUnit.name;
            await this.addFormattingSpecsToRegistry(name, persistenceUnitName, formatProps);
          } else {
            this._formatSpecsRegistry.delete(name); // clear the specs if format was removed, or no longer exists.
          }
        }
      } else {
        for (const name of args.formatsChanged) {
          if (this._formatSpecsRegistry.has(name)) {
            const formatProps = await IModelApp.formatsProvider.getFormat(name);
            if (formatProps) {
              const existingEntry = this._formatSpecsRegistry.get(name);
              if (existingEntry) {
                const persistenceUnitName = existingEntry.formatterSpec.persistenceUnit.name;
                await this.addFormattingSpecsToRegistry(name, persistenceUnitName, formatProps);
              }
            } else {
              this._formatSpecsRegistry.delete(name);
            }
          }
        }
      }
    });

    // initialize default format and parsing specs
    await this.loadFormatAndParsingMapsForSystem();
  }

  /** Return a map that serves as a registry of all standard and custom quantity types. */
  public get quantityTypesRegistry() {
    return this._quantityTypeRegistry;
  }

  /** Return the class the contain map of all alternate labels for units. These alternate labels are used when parsing strings in quantity values. */
  public get alternateUnitLabelsProvider(): AlternateUnitLabelsProvider {
    return this._alternateUnitLabelsRegistry;
  }

  /**
   * Add one or more alternate labels for a unit - these labels are used during string parsing.
   * @param key UnitNameKey which comes from `UnitProps.name`
   * @param labels one or more unit labels
   */
  public addAlternateLabels(key: UnitNameKey, ...labels: string[]) {
    this._alternateUnitLabelsRegistry.addAlternateLabels(key, ...labels);
    this.onUnitsProviderChanged.emit();
  }

  /** Get/Set the active UnitsProvider class. */
  public get unitsProvider() {
    return this._unitsProvider;
  }

  public set unitsProvider(unitsProvider: UnitsProvider) {
    this.setUnitsProvider(unitsProvider); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /** async method to set a units provider and reload caches */
  public async setUnitsProvider(unitsProvider: UnitsProvider) {
    this._unitsProvider = unitsProvider;

    try {
      // force all cached data to be reinitialized
      await IModelApp.quantityFormatter.onInitialized();
    } catch(err) {
      Logger.logWarning(`${FrontendLoggerCategory.Package}.quantityFormatter`, BentleyError.getErrorMessage(err), BentleyError.getErrorMetadata(err));
      Logger.logWarning(`${FrontendLoggerCategory.Package}.quantityFormatter`, "An exception occurred initializing the iModelApp.quantityFormatter with the given UnitsProvider. Defaulting back to the internal units provider.");
      // If there is a problem initializing with the given provider, default back to the internal provider
      await IModelApp.quantityFormatter.resetToUseInternalUnitsProvider();
      return;
    }

    // force default tool to start so any tool that may be using cached data will not be using bad data.
    if (IModelApp.toolAdmin)
      await IModelApp.toolAdmin.startDefaultTool();
    this.onUnitsProviderChanged.emit();
  }

  /** Async call typically used after IModel is closed to reset UnitsProvider to default one that does not require an Units schema. */
  public async resetToUseInternalUnitsProvider() {
    if (this._unitsProvider instanceof BasicUnitsProvider)
      return;

    await this.setUnitsProvider(new BasicUnitsProvider());
  }

  /** Async call to register a CustomQuantityType and load the FormatSpec and ParserSpec for the new type. */
  public async registerQuantityType(entry: CustomQuantityTypeDefinition, replace?: boolean) {
    if (!replace && this._quantityTypeRegistry.has(entry.key))
      return false;

    this._quantityTypeRegistry.set(entry.key, entry);
    // load any overrides so any saved overrides for the type being registered are applied
    if (this._unitFormattingSettingsProvider)
      await this._unitFormattingSettingsProvider.loadOverrides(undefined);

    if (entry.getDefaultFormatPropsBySystem) {
      const formatProps = entry.getDefaultFormatPropsBySystem(this.activeUnitSystem);
      await this.loadFormatAndParserSpec(entry, formatProps);
      return true;
    }
    return false;
  }

  /** Reinitialize caches. Typically called by active UnitFormattingSettingsProvider.
   * startDefaultTool - set to true to start the Default to instead of leaving any active tool pointing to cached unit data that is no longer valid
   * @public
   */
  public async reinitializeFormatAndParsingsMaps(overrideFormatPropsByUnitSystem: Map<UnitSystemKey, Map<QuantityTypeKey, FormatProps>>,
    unitSystemKey?: UnitSystemKey, fireUnitSystemChanged?: boolean, startDefaultTool?: boolean): Promise<void> {
    this._overrideFormatPropsByUnitSystem.clear();
    if (overrideFormatPropsByUnitSystem.size) {
      this._overrideFormatPropsByUnitSystem = overrideFormatPropsByUnitSystem;
    }

    unitSystemKey && (this._activeUnitSystem = unitSystemKey);
    await this.loadFormatAndParsingMapsForSystem(this._activeUnitSystem);
    fireUnitSystemChanged && this.onActiveFormattingUnitSystemChanged.emit({ system: this._activeUnitSystem });
    IModelApp.toolAdmin && startDefaultTool && await IModelApp.toolAdmin.startDefaultTool();
  }

  /** Set the Active unit system to one of the supported types. This will asynchronously load the formatter and parser specs for the activated system. */
  public async setActiveUnitSystem(isImperialOrUnitSystem: UnitSystemKey | boolean, restartActiveTool?: boolean): Promise<void> {
    let systemType: UnitSystemKey;
    if (typeof isImperialOrUnitSystem === "boolean")
      systemType = isImperialOrUnitSystem ? "imperial" : "metric";
    else
      systemType = isImperialOrUnitSystem;

    if (this._activeUnitSystem === systemType)
      return;

    this._activeUnitSystem = systemType;
    await this.loadFormatAndParsingMapsForSystem(systemType);
    // allow settings provider to store the change
    await this._unitFormattingSettingsProvider?.storeUnitSystemSetting({ system: systemType });
    // fire current event
    this.onActiveFormattingUnitSystemChanged.emit({ system: systemType });
    if (IModelApp.toolAdmin && restartActiveTool)
      return IModelApp.toolAdmin.startDefaultTool();
  }

  /** Retrieve the active [[UnitSystemKey]] which is used to determine what formats are to be used to display quantities */
  public get activeUnitSystem(): UnitSystemKey { return this._activeUnitSystem; }

  /** Clear any formatting override for specified quantity type, but only for the "active" Unit System. */
  public async clearOverrideFormats(type: QuantityTypeArg) {
    await this.clearOverrideFormatsByQuantityTypeKey(this.getQuantityTypeKey(type));
  }

  /** Set formatting override for specified quantity type, but only for the "active" Unit System. */
  public async setOverrideFormats(type: QuantityTypeArg, overrideEntry: OverrideFormatEntry) {
    await this.setOverrideFormatsByQuantityTypeKey(this.getQuantityTypeKey(type), overrideEntry);
  }

  /** Set Override Format for a quantity type, but only in the "active" Unit System. */
  public async setOverrideFormat(type: QuantityTypeArg, overrideFormat: FormatProps) {
    const typeKey = this.getQuantityTypeKey(type);
    let overrideEntry: OverrideFormatEntry = {};
    if (this.activeUnitSystem === "imperial")
      overrideEntry = { imperial: overrideFormat };
    else if (this.activeUnitSystem === "metric")
      overrideEntry = { metric: overrideFormat };
    else if (this.activeUnitSystem === "usCustomary")
      overrideEntry = { usCustomary: overrideFormat };
    else
      overrideEntry = { usSurvey: overrideFormat };

    await this.setOverrideFormatsByQuantityTypeKey(typeKey, overrideEntry);
  }

  /** Clear formatting override for all quantity types, but only for the "active" Unit System. */
  public async clearAllOverrideFormats() {
    if (0 === this._overrideFormatPropsByUnitSystem.size)
      return;

    if (this._overrideFormatPropsByUnitSystem.has(this.activeUnitSystem)) {
      const overrides = this._overrideFormatPropsByUnitSystem.get(this.activeUnitSystem);
      const typesRemoved: string[] = [];
      if (overrides && overrides.size) {
        const promises = new Array<Promise<void> | undefined>();
        overrides.forEach((_props, typeKey) => {
          typesRemoved.push(typeKey);
          promises.push(this._unitFormattingSettingsProvider?.storeFormatOverrides({ typeKey, unitSystem: this.activeUnitSystem }));
        });
        await Promise.all(promises);
      }

      if (typesRemoved.length) {
        const promises = new Array<Promise<void>>();
        typesRemoved.forEach((typeRemoved) => promises.push(this.loadDefaultFormatAndParserSpecForQuantity(typeRemoved)));
        await Promise.all(promises);
        // trigger a message to let callers know the format has changed.
        this.onQuantityFormatsChanged.emit({ quantityType: typesRemoved.join("|") });
      }
    }
  }

  /** Converts a QuantityTypeArg into a QuantityTypeKey/string value that can be used to lookup custom and standard quantity types. */
  public getQuantityTypeKey(type: QuantityTypeArg): string {
    return getQuantityTypeKey(type);
  }

  /** Return [[QuantityTypeDefinition]] if type has been registered. Standard QuantityTypes are automatically registered. */
  public getQuantityDefinition(type: QuantityTypeArg) {
    return this.quantityTypesRegistry.get(this.getQuantityTypeKey(type));
  }

  /** Synchronous call to get a FormatterSpec of a QuantityType. If the FormatterSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatAndParsingMapsForSystem.
   */
  public findFormatterSpecByQuantityType(type: QuantityTypeArg, _unused?: boolean): FormatterSpec | undefined {
    return this._activeFormatSpecsByType.get(this.getQuantityTypeKey(type));
  }

  /** Asynchronous Call to get a FormatterSpec for a QuantityType. This formatter spec can be used to synchronously format quantities. */
  public async generateFormatterSpecByType(type: QuantityTypeArg, formatProps: FormatProps) {
    const quantityTypeDefinition = this.quantityTypesRegistry.get(this.getQuantityTypeKey(type));
    if (quantityTypeDefinition)
      return quantityTypeDefinition.generateFormatterSpec(formatProps, this.unitsProvider);

    throw new Error(`Unable to generate FormatSpec for QuantityType ${type}`);
  }

  /** Asynchronous Call to get a FormatterSpec for a QuantityType and a Unit System. This formatter spec can be used to synchronously format quantities.
   * @param type        One of the built-in quantity types supported.
   * @param system      Requested unit system key. Note it is more efficient to use setActiveUnitSystem to set up formatters for all
   * quantity types of a unit system.
   * @return A FormatterSpec Promise.
   */
  public async getFormatterSpecByQuantityTypeAndSystem(type: QuantityTypeArg, system?: UnitSystemKey): Promise<FormatterSpec | undefined> {
    const quantityKey = this.getQuantityTypeKey(type);
    const requestedSystem = system ?? this.activeUnitSystem;

    if (requestedSystem === this.activeUnitSystem) {
      const formatterSpec = this._activeFormatSpecsByType.get(quantityKey);
      if (formatterSpec)
        return formatterSpec;
    }

    const entry = this.quantityTypesRegistry.get(quantityKey);
    if (!entry)
      throw new Error(`Unable to find registered quantity type with key ${quantityKey}`);
    return entry.generateFormatterSpec(this.getFormatPropsByQuantityTypeEntryAndSystem(entry, requestedSystem), this.unitsProvider);
  }

  /** Asynchronous Call to get a FormatterSpec for a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param isImperial  Argument to specify use of imperial or metric unit system. If left undefined the active unit system is used.
   * @return A FormatterSpec Promise.
   */
  public async getFormatterSpecByQuantityType(type: QuantityTypeArg, isImperial?: boolean): Promise<FormatterSpec | undefined> {
    let requestedSystem = this.activeUnitSystem;
    if (undefined !== isImperial)
      requestedSystem = isImperial ? "imperial" : "metric";
    return this.getFormatterSpecByQuantityTypeAndSystem(type, requestedSystem);
  }

  /** Synchronous call to get a ParserSpec for a QuantityType. If the ParserSpec is not yet cached an undefined object is returned. The
   * cache is populated when the active units system is set.
   */
  public findParserSpecByQuantityType(type: QuantityTypeArg): ParserSpec | undefined {
    return this._activeParserSpecsByType.get(this.getQuantityTypeKey(type));
  }

  /** Asynchronous Call to get a ParserSpec for a QuantityType. If the UnitSystemKey is not specified the active Unit System is used. **/
  public async getParserSpecByQuantityTypeAndSystem(type: QuantityTypeArg, system?: UnitSystemKey): Promise<ParserSpec | undefined> {
    const quantityKey = this.getQuantityTypeKey(type);
    const requestedSystem = system ?? this.activeUnitSystem;

    if (requestedSystem === this.activeUnitSystem) {
      const parserSpec = this._activeParserSpecsByType.get(quantityKey);
      if (parserSpec)
        return parserSpec;
    }

    const entry = this.quantityTypesRegistry.get(quantityKey);
    if (!entry)
      throw new Error(`Unable to find registered quantity type with key ${quantityKey}`);
    return entry.generateParserSpec(this.getFormatPropsByQuantityTypeEntryAndSystem(entry, requestedSystem), this.unitsProvider);
  }

  /** Asynchronous Call to get a ParserSpec for a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param isImperial  Argument to specify use of imperial or metric unit system. If left undefined the active unit system is used.
   * @return A FormatterSpec Promise.
   */
  public async getParserSpecByQuantityType(type: QuantityTypeArg, isImperial?: boolean): Promise<ParserSpec | undefined> {
    let requestedSystem = this.activeUnitSystem;
    if (undefined !== isImperial)
      requestedSystem = isImperial ? "imperial" : "metric";
    return this.getParserSpecByQuantityTypeAndSystem(type, requestedSystem);
  }

  /** Generates a formatted string asynchronously for a quantity given the provided properties.
   * @param props - an object containing value, valueUnitName, and kindOfQuantityName.
   * @return A promise resolving to a formatted string.
   */
  public formatQuantity(props: {
    value: number;
    valueUnitName: string;
    kindOfQuantityName: string;
  }): Promise<string>;
  /** Generates a formatted string for a quantity given its format spec.
   * @param magnitude       The magnitude of the quantity.
   * @param formatSpec      The format specification. See methods getFormatterSpecByQuantityType and findFormatterSpecByQuantityType.
   * @return a formatted string.
   */
  public formatQuantity(magnitude: number, formatSpec?: FormatterSpec): string;
   
  public formatQuantity(args: number | object, spec?: FormatterSpec): string | Promise<string> {
    if (typeof args === "number") {
      /** Format a quantity value. Default FormatterSpec implementation uses Formatter.formatQuantity. */
      const magnitude = args;
      if (spec)
        return spec.applyFormatting(magnitude);
      return magnitude.toString();
    }

    return this.formatQuantityAsync(args as {
      value: number;
      valueUnitName: string;
      kindOfQuantityName: string;
    });
  }

  private async formatQuantityAsync(args: {
    value: number;
    valueUnitName: string;
    kindOfQuantityName: string;
  }): Promise<string> {
    const { value, valueUnitName, kindOfQuantityName } = args;
    const formatProps = await IModelApp.formatsProvider.getFormat(kindOfQuantityName);
    if (!formatProps) return value.toString();
    const formatSpec = await this.createFormatterSpec({
      persistenceUnitName: valueUnitName,
      formatProps,
      formatName: kindOfQuantityName,
    })
    return formatSpec.applyFormatting(value);
  }

  /** Parse input string asynchronously into a quantity given the provided properties.
   * @param props - an object containing value, valueUnitName, and kindOfQuantityName.
   * @return Promise resolving to a QuantityParseResult object containing either the parsed value or an error value if unsuccessful.
   */
  public parseToQuantityValue(props: {
    value: string;
    valueUnitName: string;
    kindOfQuantityName: string;
  }): Promise<QuantityParseResult>;
  /** Parse input string into quantity given the ParserSpec
   * @param inString       The magnitude of the quantity.
   * @param parserSpec     The parse specification the defines the expected format of the string and the conversion to the output unit.
   * @return QuantityParseResult object containing either the parsed value or an error value if unsuccessful.
   */
  public parseToQuantityValue(inString: string, parserSpec?: ParserSpec): QuantityParseResult;
   
  public parseToQuantityValue(args: string | object, parserSpec?: ParserSpec): QuantityParseResult | Promise<QuantityParseResult> {
    if (typeof args === "string") {
      /** Parse a quantity value. Default ParserSpec implementation uses ParserSpec.parseToQuantityValue. */
      const inString = args;
      if (parserSpec)
        return parserSpec.parseToQuantityValue(inString);
      return { ok: false, error: ParseError.InvalidParserSpec };
    }
    return this.parseToQuantityValueAsync(args as {
      value: string;
      valueUnitName: string;
      kindOfQuantityName: string;
    });
  }

  private async parseToQuantityValueAsync(args: {
    value: string;
    valueUnitName: string;
    kindOfQuantityName: string;
  }): Promise<QuantityParseResult> {
    const { value, valueUnitName, kindOfQuantityName } = args;
    const formatProps = await IModelApp.formatsProvider.getFormat(kindOfQuantityName);
    if (!formatProps) return { ok: false, error: ParseError.InvalidParserSpec };
    const parserSpec = await this.createParserSpec({
      persistenceUnitName: valueUnitName,
      formatProps,
      formatName: kindOfQuantityName,
    });
    return parserSpec.parseToQuantityValue(value);
  }

  /**
   * Get a UnitSystemKey from a string that may have been entered via a key-in. Supports different variation of
   * unit system names that have been used in the past.
   */
  public getUnitSystemFromString(inputSystem: string, fallback?: UnitSystemKey): UnitSystemKey {
    switch (inputSystem.toLowerCase()) {
      case "metric":
      case "si":
        return "metric";
      case "imperial":
      case "british-imperial":
        return "imperial";
      case "uscustomary":
      case "us-customary":
      case "us":
        return "usCustomary";
      case "ussurvey":
      case "us-survey":
      case "survey":
        return "usSurvey";
      default:
        if (undefined !== fallback)
          return fallback;
        break;
    }
    return "imperial";
  }

  /** Return true if the QuantityType is using an override format. */
  public hasActiveOverride(type: QuantityTypeArg, checkOnlyActiveUnitSystem?: boolean): boolean {
    const quantityTypeKey = this.getQuantityTypeKey(type);

    if (checkOnlyActiveUnitSystem) {
      const overrides = this._overrideFormatPropsByUnitSystem.get(this.activeUnitSystem);
      if (overrides && overrides.has(quantityTypeKey))
        return true;
      return false;
    }

    for (const [_key, overrideMap] of this._overrideFormatPropsByUnitSystem) {
      if (overrideMap.has(quantityTypeKey))
        return true;
    }
    return false;
  }

  /** Get the cached FormatProps give a quantity type. If ignoreOverrides is false then if the format has been overridden
   * the overridden format is returned, else the standard format is returned.
   */
  public getFormatPropsByQuantityType(quantityType: QuantityTypeArg, requestedSystem?: UnitSystemKey, ignoreOverrides?: boolean) {
    const quantityEntry = this.quantityTypesRegistry.get(this.getQuantityTypeKey(quantityType));
    if (quantityEntry)
      return this.getFormatPropsByQuantityTypeEntryAndSystem(quantityEntry, requestedSystem ?? this.activeUnitSystem, ignoreOverrides);
    return undefined;
  }

  // keep following to maintain existing API of implementing UnitsProvider
  /** Find [UnitProp] for a specific unit label. */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    return this._unitsProvider.findUnit(unitLabel, schemaName, phenomenon, unitSystem);
  }

  /** Returns all defined units for the specified Unit Family/Phenomenon. */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    return this._unitsProvider.getUnitsByFamily(phenomenon);
  }

  /** Find [UnitProp] for a specific unit name. */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    return this._unitsProvider.findUnitByName(unitName);
  }

  /** Returns data needed to convert from one Unit to another in the same Unit Family/Phenomenon. */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps> {
    return this._unitsProvider.getConversion(fromUnit, toUnit);
  }

  /**
   * Creates a [[FormatterSpec]] for a given persistence unit name and format properties, using the [[UnitsProvider]] to resolve the persistence unit.
   * @beta
   * @param props - A [[CreateFormattingSpecProps]] interface.
   */
  public async createFormatterSpec(props: CreateFormattingSpecProps): Promise<FormatterSpec> {
    const { persistenceUnitName, formatProps, formatName } = props;
    const persistenceUnitProps = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON(formatName ?? "temp", this._unitsProvider, formatProps);
    return FormatterSpec.create(`${format.name}_format_spec`, format, this._unitsProvider, persistenceUnitProps);
  }

  /**
   * Creates a [[ParserSpec]] for a given persistence unit name and format properties, using the [[UnitsProvider]] to resolve the persistence unit.
   * @beta
   * @param props - A [[CreateFormattingSpecProps]] object.
   */
  public async createParserSpec(props: CreateFormattingSpecProps): Promise<ParserSpec> {
    const { persistenceUnitName, formatProps, formatName } = props;
    const persistenceUnitProps = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON(formatName ?? "temp", this._unitsProvider, formatProps);
    return ParserSpec.create(format, this._unitsProvider, persistenceUnitProps);
  }

  /**
   * @beta
   * Returns a [[FormattingSpecEntry]] for a given name, typically a KindOfQuantity full name.
   */
  public getSpecsByName(name: string): FormattingSpecEntry | undefined {
    return this._formatSpecsRegistry.get(name);
  }

    /**
   * Populates the registry with a new FormatterSpec and ParserSpec entry for the given format name.
   * @beta
   * @param name The key used to identify the formatter and parser spec
   * @param persistenceUnitName The name of the persistence unit
   * @param formatProps If not supplied, tries to retrieve the [[FormatProps]] from [[IModelApp.formatsProvider]]
   */
  public async addFormattingSpecsToRegistry(name: string, persistenceUnitName: string, formatProps?: FormatProps): Promise<void> {
    if (!formatProps) {
      formatProps = await IModelApp.formatsProvider.getFormat(name);
    }
    if (formatProps) {
      const formatterSpec = await this.createFormatterSpec({
        persistenceUnitName,
        formatProps,
        formatName: name,
      });
      const parserSpec = await this.createParserSpec({
        persistenceUnitName,
        formatProps,
        formatName: name,
      });
      this._formatSpecsRegistry.set(name, { formatterSpec, parserSpec });
    } else {
      throw new Error(`Unable to find format properties for ${name} with persistence unit ${persistenceUnitName}`);
    }
  }
}

// ========================================================================================================================================
// Default Data
// ========================================================================================================================================
const DEFAULT_FORMATKEY_BY_UNIT_SYSTEM = [
  {
    system: "metric",  // PresentationUnitSystem.Metric,
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]meter4" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]degree2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]mSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]mCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]meter2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]m-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]meter4" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]meter4" },
    ],
  },
  {
    system: "imperial", // PresentationUnitSystem.BritishImperial,
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]fi8" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]dms2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]fSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]fCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]feet2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]f-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]f-survey-4-labeled" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]feet4" },
    ],
  },
  {
    system: "usCustomary",  // PresentationUnitSystem.UsCustomary
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]fi8" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]dms2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]fSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]fCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]feet2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]f-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]f-survey-4" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]feet4" },
    ],
  },
  {
    system: "usSurvey",  // PresentationUnitSystem.UsSurvey
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]f-survey-4" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]dms2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]usSurveyFtSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]usSurveyFtCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]f-survey-2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]f-survey-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]f-survey-4" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]f-survey-4" },
    ],
  },
];

/** Interface used to define structure of default format definitions. */
interface UniqueFormatsProps {
  readonly key: string;
  readonly description?: string;
  readonly format: FormatProps;
}

/** List of default format definitions used by the Standard QuantityTypes. */
const DEFAULT_FORMATPROPS: UniqueFormatsProps[] = [
  {
    key: "[units:length]meter4",
    description: "meters (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]meter2",
    description: "meters (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  },

  {
    key: "[units:length]feet4",
    description: "feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft", name: "Units.FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]feet2",
    description: "feet (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft", name: "Units.FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]fi8",
    description: "feet-inch 1/8 (labeled)",
    format: {
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
  },
  {
    key: "[units:length]f-sta2",
    description: "stationing feet-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft", name: "Units.FT" }],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 2,
      precision: 2,
      type: "Station",
    },
  },
  {
    key: "[units:length]f-survey-sta2",
    description: "stationing feet-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 2,
      precision: 2,
      type: "Station",
    },
  },

  {
    key: "[units:length]m-sta2",
    description: "stationing meters-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 3,
      precision: 2,
      type: "Station",
    },
  },
  {
    key: "[units:length]f-survey-2",
    description: "survey feet (labeled)-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]f-survey-4-labeled",
    description: "survey feet (labeled)-4 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft (US Survey)", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },

  {
    key: "[units:length]f-survey-4",
    description: "survey feet (labeled)-4 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:angle]degree2",
    description: "degrees (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  },
  {
    key: "[units:angle]dms",
    description: "degrees minutes seconds (labeled) 0 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }, { label: "'", name: "Units.ARC_MINUTE" }, { label: "\"", name: "Units.ARC_SECOND" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    },
  },
  {
    key: "[units:angle]dms2",
    description: "degrees minutes seconds (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }, { label: "'", name: "Units.ARC_MINUTE" }, { label: "\"", name: "Units.ARC_SECOND" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  },
  {
    key: "[units:area]mSquared4",
    description: "square meters (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "m²", name: "Units.SQ_M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:area]fSquared4",
    description: "square feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft²", name: "Units.SQ_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:area]usSurveyFtSquared4",
    description: "square survey feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft²", name: "Units.SQ_US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:volume]mCubed4",
    description: "cubic meters (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "m³", name: "Units.CUB_M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:volume]fCubed4",
    description: "cubic feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft³", name: "Units.CUB_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:volume]usSurveyFtCubed4",
    description: "cubic survey feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "ft³", name: "Units.CUB_US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
];
