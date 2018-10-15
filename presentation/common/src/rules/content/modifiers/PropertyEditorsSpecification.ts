/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** Sub-specification to specify custom property editor */
export interface PropertyEditorsSpecification {
  /** Name of the property which custom editor should be used for */
  propertyName: string;

  /** Name of the custom editor */
  editorName: string;

  /** Parameters for the editor */
  parameters?: PropertyEditorParameters[];
}

/** Parameters for [[PropertyEditorsSpecification]] */
export declare type PropertyEditorParameters = PropertyEditorJsonParameters
  | PropertyEditorMultilineParameters
  | PropertyEditorRangeParameters
  | PropertyEditorSliderParameters;

/** Used for serializing array of [[PropertyEditorParameters]] to JSON */
export const enum PropertyEditorParameterTypes {
  Json = "Json",
  Multiline = "Multiline",
  Range = "Range",
  Slider = "Slider",
}

/** Base interface for [[PropertyEditorParameters]] */
export interface PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes;
}

/** Arbitrary JSON parameters for custom property editors */
export interface PropertyEditorJsonParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes.Json;

  /** Arbitrary JSON that can be handled by a property editor */
  json: any;
}

/** Multiline parameters for property editors that support multiline display */
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

/** Range parameters for property editors that support ranges */
export interface PropertyEditorRangeParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: PropertyEditorParameterTypes.Range;

  /** Minimum value of the range. */
  min?: number;

  /** Maximum value of the range. */
  max?: number;
}

/** Slider parameters for property editors that support slider display */
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
