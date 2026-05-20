/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Represents localized label and description for a schema element.
 * @beta
 */
export interface LocalizedText {
  label?: string;
  description?: string;
}

/**
 * Represents localized text for a class including its properties.
 * @beta
 */
export interface LocalizedClassText extends LocalizedText {
  /** Localized properties of the class, keyed by property name */
  properties?: { [propertyName: string]: LocalizedText };
}

/**
 * Represents localized text for an enumeration including its enumerators.
 * @beta
 */
export interface LocalizedEnumerationText extends LocalizedText {
  /** Localized enumerators, keyed by enumerator name */
  enumerators?: { [enumeratorName: string]: LocalizedText };
}

/**
 * JSON structure for schema localization file.
 * @beta
 */
export interface SchemaLocalizationJson {
  /** Schema version identifier */
  $schema?: string;
  /** Name of the schema, this localization applies to */
  name: string;
  /** Version of the schema */
  version?: string;
  /** Locale identifier (e.g., "de", "fr", "es-CO") */
  locale: string;
  /** Localized schema label */
  label?: string;
  /** Localized schema description */
  description?: string;
  /** Localized classes, keyed by class name */
  classes?: { [className: string]: LocalizedClassText };
  /** Localized enumerations, keyed by enumeration name */
  enumerations?: { [enumerationName: string]: LocalizedEnumerationText };
  /** Localized units, keyed by unit name */
  units?: { [unitName: string]: LocalizedText };
  /** Localized inverted units, keyed by inverted unit name */
  invertedUnits?: { [invertedUnitName: string]: LocalizedText };
  /** Localized phenomena, keyed by phenomenon name */
  phenomena?: { [phenomenonName: string]: LocalizedText };
  /** Localized unit systems, keyed by unit system name */
  unitSystems?: { [unitSystemName: string]: LocalizedText };
  /** Localized property categories, keyed by property category name */
  propertyCategories?: { [propertyCategoryName: string]: LocalizedText };
  /** Localized formats, keyed by format name */
  formats?: { [formatName: string]: LocalizedText };
  /** Localized kinds of quantity, keyed by kind of quantity name */
  kindOfQuantities?: { [koqName: string]: LocalizedText };
  /** Localized constants, keyed by constant name */
  constants?: { [constantName: string]: LocalizedText };
}
