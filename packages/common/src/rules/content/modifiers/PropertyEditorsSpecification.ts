/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** This is a sub-specification that allows specifying custom editors for properties. */
export interface PropertyEditorsSpecification {
  /** Name of the property for which custom editor should be used */
  propertyName: string;

  /** Name of the custom editor. */
  editorName: string;

  parameters?: PropertyEditorParameters[];
}

/** Parameters for [[PropertyEditorsSpecification]] */
export declare type PropertyEditorParameters = PropertyEditorJsonParameters
  | PropertyEditorMultilineParameters
  | PropertyEditorRangeParameters
  | PropertyEditorSliderParameters;

/** Used for serializing array of [[PropertyEditorParameters]] to JSON */
export enum PropertyEditorParameterTypes {
  PropertyEditorJsonParameters = "Json",
  PropertyEditorMultilineParameters = "Multiline",
  PropertyEditorRangeParameters = "Range",
  PropertyEditorSliderParameters = "Slider",
}

/** Base interface for [[PropertyEditorParameters]] */
export interface PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  type: PropertyEditorParameterTypes;
}

/** [[PropertyEditorsSpecification]] json parameter */
export interface PropertyEditorJsonParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  type: PropertyEditorParameterTypes.PropertyEditorJsonParameters;

  /** Arbitrary JSON that can be handled by a property editor */
  json: any;
}

/** [[PropertyEditorsSpecification]] multiline parameter */
export interface PropertyEditorMultilineParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  type: PropertyEditorParameterTypes.PropertyEditorMultilineParameters;

  /** Number of lines. **Must be non negative.** By default is set to 1 */
  height?: number;
}

/** [[PropertyEditorsSpecification]] range parameter */
export interface PropertyEditorRangeParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  type: PropertyEditorParameterTypes.PropertyEditorRangeParameters;

  /** Maximum value of the range. */
  min?: number;

  /** Minimum value of the range. */
  max?: number;
}

/** [[PropertyEditorsSpecification]] slider parameter */
export interface PropertyEditorSliderParameters extends PropertyEditorParametersBase {
  /** Used for serializing to JSON. */
  type: PropertyEditorParameterTypes.PropertyEditorSliderParameters;

  /** Minimum value that can be set. */
  min: number;

  /** Maximum value that can be set. */
  max: number;

  /** Count of intervals. **Must be non negative.** By default is set to 1. */
  intervalsCount?: number;

  /** Since slider must work with integer values define factor used to produce a integer (0.1=10, 0.01=100, 0.001=1000). */
  valueFactor?: number;

  /** Is slider vertical. By default is set to false. */
  isVertical?: boolean;
}
