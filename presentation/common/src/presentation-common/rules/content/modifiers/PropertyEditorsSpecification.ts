/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

/**
 * This specification allows assigning a custom property editor to specific properties.
 *
 * @see [Property editor specification specification reference documentation page]($docs/presentation/content/PropertyEditorSpecification.md)
 * @public
 */
export interface PropertyEditorSpecification {
  /**
   * Name of the property editor that's going to be used in UI components. This name is carried over to
   * [[Field.editor]] and it's up to the UI component to make sure appropriate editor
   * is used to edit the property.
   */
  editorName: string;

  /**
   * Parameters for the editor.
   * @note At this moment the attribute is not used.
   * @public
   */
  parameters?: PropertyEditorParameters[];
}

/**
 * Parameters for [[PropertyEditorSpecification]]
 * @public
 */
export declare type PropertyEditorParameters =
  | PropertyEditorJsonParameters
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
  /**
   * Used for serializing to JSON.
   * @see PropertyEditorParameterTypes
   */
  paramsType: `${PropertyEditorParameterTypes}`;
}

/**
 * Arbitrary JSON parameters for custom property editors
 * @public
 */
export interface PropertyEditorJsonParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: "Json";

  /** Arbitrary JSON that can be handled by a property editor */
  json: any;
}

/**
 * Multiline parameters for property editors that support multiline display
 * @public
 */
export interface PropertyEditorMultilineParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  paramsType: "Multiline";

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
  paramsType: "Range";

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
  paramsType: "Slider";

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
