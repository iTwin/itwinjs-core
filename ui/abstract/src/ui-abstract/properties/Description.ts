/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { PropertyEditorParams } from "./EditorParams";

/**
 * Information about an enumeration choice
 * @beta
 */
export interface EnumerationChoice {
  label: string;
  value: string | number;
}

/**
 * Information about a set of enumeration choices
 * @beta
 */
export interface EnumerationChoicesInfo {
  choices: EnumerationChoice[];
  isStrict?: boolean;
  maxDisplayedRows?: number;
}

/**
 * Information about a Property Editor
 * @beta
 */
export interface PropertyEditorInfo {
  name?: string;
  params?: PropertyEditorParams[];
}

/**
 * PropertyDescription contains metadata about a Property
 * @beta
 */
export interface PropertyDescription {
  name: string;
  displayLabel: string;
  typename: string;
  enum?: EnumerationChoicesInfo;
  editor?: PropertyEditorInfo;
  /** Quantity type key used to look up formatting and parsing specs. This is typically either the name of a quantity type used by a tool
   *  or the full name of a KOQ (schema:koq).
   * @alpha
   */
  quantityType?: string;
  /** Get the custom DataController by this name and register it with the property editor */
  dataController?: string;
}
