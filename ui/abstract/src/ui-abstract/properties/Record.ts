/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { PropertyDescription } from "./Description";
import { PropertyValue, PropertyValueFormat } from "./Value";

/** Properties for the [[PropertyRecord]] with link info supplied
 * @beta
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
 */
export class PropertyRecord {
  /** Value for the property */
  public readonly value: PropertyValue;
  /** The property description containing metadata for the property */
  public readonly property: PropertyDescription;

  /** Description for the property */
  public description?: string;
  /** Indicates if the property is read-only */
  public isReadonly?: boolean;
  /** Indicates if the property is disabled */
  public isDisabled?: boolean;
  /** Indicates if the property record represents merged properties */
  public isMerged?: boolean;
  /** Indicates if the property should be automatically expanded */
  public autoExpand?: boolean;
  /** Map containing any additional data */
  public extendedData?: { [key: string]: any };

  /** Properties for link logic */
  public links?: LinkElementsInfo;

  /** Constructs a PropertyRecord instance */
  public constructor(value: PropertyValue, property: PropertyDescription) {
    this.value = value;
    this.property = property;
  }

  /** Creates a copy of this PropertyRecord with a new value */
  public copyWithNewValue(newValue: PropertyValue): PropertyRecord {
    return new PropertyRecord(newValue, this.property);
  }

  /** Creates a PropertyRecord based on a value string and an optional property description or name */
  public static fromString(value: string, descriptionOrName?: PropertyDescription | string): PropertyRecord {
    let description: PropertyDescription;
    if (descriptionOrName && typeof descriptionOrName === "object") {
      description = descriptionOrName;
    } else if (descriptionOrName && typeof descriptionOrName === "string") {
      description = {
        name: descriptionOrName,
        displayLabel: descriptionOrName,
        typename: "string",
      };
    } else {
      description = {
        name: "string_value",
        displayLabel: "String Value",
        typename: "string",
      };
    }
    return new PropertyRecord({
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value,
    }, description);
  }
}
