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
 * @deprecated in 3.x. Use [[LabelCompositeValue]].
 */
export interface LabelCompositeValueJSON {
  separator: string;
  values: LabelDefinition[];
}

/** @public */
export namespace LabelCompositeValue {
  /**
   * Serialize given [[LabelCompositeValue]] to JSON
   * @deprecated in 3.x. Use [[LabelCompositeValue]].
   */
  // eslint-disable-next-line deprecation/deprecation
  export function toJSON(compositeValue: LabelCompositeValue): LabelCompositeValueJSON {
    return { ...compositeValue };
  }

  /**
   * Deserialize [[LabelCompositeValue]] from JSON
   * @deprecated in 3.x. Use [[LabelCompositeValue]].
   */
  // eslint-disable-next-line deprecation/deprecation
  export function fromJSON(json: LabelCompositeValueJSON): LabelCompositeValue {
    return { ...json };
  }
}

/**
 * Type definition of label raw value.
 * @public
 */
export type LabelRawValue = string | number | boolean | LabelCompositeValue;

/**
 * JSON representation of [[LabelRawValue]]
 * @public
 * @deprecated in 3.x. Use [[LabelRawValue]].
 */
export type LabelRawValueJSON = LabelRawValue;

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
 * @deprecated in 3.x. Use [[LabelDefinition]].
 */
export interface LabelDefinitionJSON {
  displayValue: string;
  rawValue: LabelRawValue;
  typeName: string;
}

/** @public */
export namespace LabelDefinition {
  /**
   * Serialize given [[LabelDefinition]] to JSON
   * @deprecated in 3.x. Use [[LabelDefinition]].
   */
  // eslint-disable-next-line deprecation/deprecation
  export function toJSON(labelDefinition: LabelDefinition): LabelDefinitionJSON {
    return { ...labelDefinition };
  }

  /**
   * Deserialize [[LabelDefinition]] from JSON
   * @deprecated in 3.x. Use [[LabelDefinition]].
   */
  // eslint-disable-next-line deprecation/deprecation
  export function fromJSON(json: LabelDefinitionJSON | string): LabelDefinition {
    if (typeof json === "string") {
      return JSON.parse(json);
    }
    return { ...json };
  }

  /** @internal */
  export const COMPOSITE_DEFINITION_TYPENAME = "composite";

  /**
   * Checks if provided [[LabelDefinition]] has raw value of type [[LabelCompositeValue]].
   * @public
   */
  export function isCompositeDefinition(def: LabelDefinition): def is LabelDefinition & { rawValue: LabelCompositeValue } {
    return def.typeName === COMPOSITE_DEFINITION_TYPENAME;
  }

  /**
   * Creates [[LabelDefinition]] from string value.
   * @public
   */
  export function fromLabelString(label: string): LabelDefinition {
    return {
      displayValue: label,
      rawValue: label,
      typeName: "string",
    };
  }
}
