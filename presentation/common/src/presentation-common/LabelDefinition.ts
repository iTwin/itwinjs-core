/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hierarchies
 */

/**
 * Data structure that describes raw composite label value.
 * @public
 */
export interface LabelCompositeValue {
  separator: string;
  values: LabelDefinition[];
}

/**
 * JSON representation of [[LabelCompositeValue]]
 * @public
 */
export interface LabelCompositeValueJSON {
  separator: string;
  values: LabelDefinitionJSON[];
}

/** @public */
export namespace LabelCompositeValue {
  /** Serialize given [[LabelCompositeValue]] to JSON */
  export function toJSON(compositeValue: LabelCompositeValue): LabelCompositeValueJSON {
    return { ...compositeValue, values: compositeValue.values.map(LabelDefinition.toJSON) };
  }

  /** Deserialize [[LabelCompositeValue]] from JSON */
  export function fromJSON(json: LabelCompositeValueJSON): LabelCompositeValue {
    return {
      ...json,
      values: json.values.map(LabelDefinition.fromJSON),
    };
  }
}

/**
 * Type definition of label raw value.
 * @public
 */
export type LabelRawValue = string | number | boolean | LabelCompositeValue;

/**
 * JSON representation of  [[LabelRawValue]]
 * @public
 */
export type LabelRawValueJSON = string | number | boolean | LabelCompositeValueJSON;

/**
 * Data structure that describes label definition.
 * @public
 */
export interface LabelDefinition {
  /** Display value of label */
  displayValue: string;
  /** Raw value of label */
  rawValue: LabelRawValue;
  /** Type name of raw value */
  typeName: string;
}

/**
 * JSON representation of [[LabelDefinition]]
 * @public
 */
export interface LabelDefinitionJSON {
  displayValue: string;
  rawValue: LabelRawValueJSON;
  typeName: string;
}

/** @public */
export namespace LabelDefinition {
  /** Serialize given [[LabelDefinition]] to JSON */
  export function toJSON(labelDefinition: LabelDefinition): LabelDefinitionJSON {
    return {
      displayValue: labelDefinition.displayValue,
      typeName: labelDefinition.typeName,
      rawValue: isCompositeDefinition(labelDefinition) ? LabelCompositeValue.toJSON(labelDefinition.rawValue) : labelDefinition.rawValue,
    };
  }

  /** Deserialize [[LabelDefinition]] from JSON */
  export function fromJSON(json: LabelDefinitionJSON | string): LabelDefinition {
    if (typeof json === "string")
      return JSON.parse(json, reviver);
    return {
      ...json,
      rawValue: isCompositeDefinition(json) ? LabelCompositeValue.fromJSON(json.rawValue) : json.rawValue,
    };
  }

  /** @internal */
  export const COMPOSITE_DEFINITION_TYPENAME = "composite";

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing [[LabelDefinition]] objects.
   *
   * @internal
   */
  export function reviver(key: string, value: any): any {
    return key === "" ? fromJSON(value) : value;
  }

  /** @internal */
  export function isCompositeDefinition(def: LabelDefinition): def is LabelDefinition & { rawValue: LabelCompositeValue } {
    return def.typeName === COMPOSITE_DEFINITION_TYPENAME;
  }

  /** @internal */
  export function fromLabelString(label: string): LabelDefinitionJSON {
    return {
      displayValue: label,
      rawValue: label,
      typeName: "string",
    };
  }
}
