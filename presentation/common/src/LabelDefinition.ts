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

/** @internal */
export interface LabelCompositeValueJSON {
  separator: string;
  values: LabelDefinitionJSON[];
}

/**
 * @public
 */
export namespace LabelCompositeValue {
  /** @internal */
  export function toJSON(compositeValue: LabelCompositeValue): LabelCompositeValueJSON {
    return { ...compositeValue, values: compositeValue.values.map(LabelDefinition.toJSON) };
  }

  /** @internal */
  export function fromJSON(json: LabelCompositeValueJSON): LabelCompositeValue {
    return Object.assign({}, json, {
      values: json.values.map(LabelDefinition.fromJSON),
    });
  }
}

/**
 * Type definition of label raw value.
 * @public
 */
export type LabelRawValue = string | number | boolean | LabelCompositeValue;
/** @internal */
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

/** @internal */
export interface LabelDefinitionJSON {
  displayValue: string;
  rawValue: LabelRawValueJSON;
  typeName: string;
}

/** @public */
export namespace LabelDefinition {
  /**
   * Serialize given label definition to JSON.
   * @internal
   */
  export function toJSON(labelDefinition: LabelDefinition): LabelDefinitionJSON {
    return {
      displayValue: labelDefinition.displayValue,
      typeName: labelDefinition.typeName,
      rawValue: isCompositeDefinition(labelDefinition) ? LabelCompositeValue.toJSON(labelDefinition.rawValue) : labelDefinition.rawValue,
    };
  }

  /**
   * Deserialize label definition from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized label definition
   *
   * @internal
   */
  export function fromJSON(json: LabelDefinitionJSON | string): LabelDefinition {
    if (typeof json === "string")
      return JSON.parse(json, reviver);
    return Object.assign({}, json, {
      rawValue: isCompositeDefinition(json) ? LabelCompositeValue.fromJSON(json.rawValue) : json.rawValue,
    });
  }

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
    return def.typeName === "composite";
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
