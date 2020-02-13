/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { PropertyDescription } from "./Description";
import { PropertyValue } from "./Value";

/** Properties for the [[PropertyRecord]] with link info supplied
 * @beta
 * @deprecated Move LinkElementsInfo to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export interface LinkElementsInfo {
  /** Callback to link click event */
  onClick?: (record: PropertyRecord, text: string) => void;
  /**
   * Function that specifies which parts of display value need to be clickable.
   *
   * Letters will be picked from __start__ index to __end__ index. __end__ index is not included.
   * For a string _"example"_ and a match ```{ start: 1, end: 3 }```, _"xa"_ will be clickable.
   */
  matcher?: (displayValue: string) => Array<{ start: number, end: number }>;
}

/**
 * PropertyRecord contains instance information about a Property, including a
 * value that can be edited using a PropertyEditor and converted using a TypeConverter.
 * @beta
 * @deprecated Move PropertyRecord to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export class PropertyRecord {
  public readonly value: PropertyValue;
  public readonly property: PropertyDescription;
  public description?: string;
  public isReadonly?: boolean;
  public isDisabled?: boolean;
  public isMerged?: boolean;
  public autoExpand?: boolean;
  public extendedData?: { [key: string]: any };

  /** Properties for link logic */
  public links?: LinkElementsInfo;

  public constructor(value: PropertyValue, property: PropertyDescription) {
    this.value = value;
    this.property = property;
  }

  /** Creates a copy of this PropertyRecord with a new value */
  public copyWithNewValue(newValue: PropertyValue): PropertyRecord {
    return new PropertyRecord(newValue, this.property);
  }
}
