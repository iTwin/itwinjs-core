/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Sub-specification to specify custom property editor
 * @public
 */
export interface PropertyEditorsSpecification {
  /** Name of the property which custom editor should be used for */
  propertyName: string;

  /** Name of the custom editor */
  editorName: string;

  /**
   * Parameters for the editor
   * @public
   */
  parameters?: PropertyEditorParameters[];
}

/**
 * Parameters for [[PropertyEditorsSpecification]]
 * @public
 */
export declare type PropertyEditorParameters = PropertyEditorJsonParameters
  | PropertyEditorMultilineParameters
  | PropertyEditorRangeParameters
  | PropertyEditorSliderParameters;

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
