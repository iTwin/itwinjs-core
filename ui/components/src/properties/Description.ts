/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { PropertyEditorParams } from "./EditorParams";

/**
 * Information about an enumeration choice
 */
export interface EnumerationChoice {
  label: string;
  value: string | number;
}

/**
 * Information about a set of enumeration choices
 */
export interface EnumerationChoicesInfo {
  choices: EnumerationChoice[];
  isStrict?: boolean;
  maxDisplayedRows?: number;
}

/**
 * Information about a Property Editor
 */
export interface PropertyEditorInfo {
  name: string;
  params: PropertyEditorParams[];
}

/**
 * PropertyDescription contains metadata about a Property
 */
export interface PropertyDescription {
  name: string;
  displayLabel: string;
  typename: string;
  enum?: EnumerationChoicesInfo;
  editor?: PropertyEditorInfo;
}
