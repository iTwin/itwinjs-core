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
 * Localized text for a schema item
 * @beta
 */
export interface LocalizedItemText extends LocalizedText {
  /** Localized members keyed by member name */
  members?: { [memberName: string]: LocalizedText };
}

/**
 * JSON structure for schema localization file.
 * @beta
 */
export interface SchemaLocalizationJson {
  /** Schema version identifier */
  $schema: string;
  /** Name of the schema this localization applies to */
  name: string;
  /** Version of the schema */
  version: string;
  /** Locale identifier (e.g., "de", "fr", "es-CO") */
  locale: string;
  /** Localized schema label */
  label?: string;
  /** Localized schema description */
  description?: string;
  /** Localized schema items, keyed by item name */
  items?: { [itemName: string]: LocalizedItemText };
}
