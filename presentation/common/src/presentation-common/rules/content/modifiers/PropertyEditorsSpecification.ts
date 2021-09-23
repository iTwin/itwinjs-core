/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * Specification for custom property editor
 *
 * @see [More details]($docs/presentation/Content/PropertyEditorSpecification.md)
 * @public
 */
export interface PropertyEditorSpecification {
  /** Name of the custom editor */
  editorName: string;

  /**
   * Parameters for the editor
   * @public
   */
  parameters?: PropertyEditorParameters[];
}

/**
 * Parameters for [[PropertyEditorSpecification]]
 * @public
 */
export declare type PropertyEditorParameters = PropertyEditorJsonParameters | PropertyEditorMultilineParameters | PropertyEditorRangeParameters | PropertyEditorSliderParameters;

/**
 * Used for serializing array of [[PropertyEditorParameters]] to JSON
 * @public
 */
export enum PropertyEditorParameterTypes {
  Json = "Json",
  Multiline = "Multiline",
  Range = "Range",
  Slider = "Slider",
}

/**
 * Base interface for [[PropertyEditorParameters]]. Not meant
 * to be used directly, see `PropertyEditorParameters`.
 * @public
 */
export interface PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes;
}

/**
 * Arbitrary JSON parameters for custom property editors
 * @public
 */
export interface PropertyEditorJsonParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes.Json;

  /** Arbitrary JSON that can be handled by a property editor */
  json: any;
}

/**
 * Multiline parameters for property editors that support multiline display
 * @public
 */
export interface PropertyEditorMultilineParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes.Multiline;

  /**
   * Number of lines. Defaults to `1`.
   *
   * @type integer
   * @minimum 1
   */
  height?: number;
}

/**
 * Range parameters for property editors that support ranges
 * @public
 */
export interface PropertyEditorRangeParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes.Range;

  /** Minimum value of the range. */
  min?: number;

  /** Maximum value of the range. */
  max?: number;
}

/**
 * Slider parameters for property editors that support slider display
 * @public
 */
export interface PropertyEditorSliderParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes.Slider;

  /** Minimum value that can be set. */
  min: number;

  /** Maximum value that can be set. */
  max: number;

  /**
   * Count of intervals. Defaults to `1`.
   *
   * @type integer
   * @minimum 1
   */
  intervalsCount?: number;

  /** Is slider vertical. */
  isVertical?: boolean;
}
