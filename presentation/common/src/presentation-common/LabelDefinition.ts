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
 * Type definition of label raw value.
 * @public
 */
export type LabelRawValue = string | number | boolean | LabelCompositeValue;

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
export const COMPOSITE_LABEL_DEFINITION_TYPENAME = "composite";

/** @public */
export namespace LabelDefinition {
  /**
   * Checks if provided [[LabelDefinition]] has raw value of type [[LabelCompositeValue]].
   * @public
   */
  export function isCompositeDefinition(def: LabelDefinition): def is LabelDefinition & { rawValue: LabelCompositeValue } {
    return def.typeName === COMPOSITE_LABEL_DEFINITION_TYPENAME;
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
