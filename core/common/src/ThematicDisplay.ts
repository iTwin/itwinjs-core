/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { XYZProps, Range1d, Vector3d, Range1dProps } from "@bentley/geometry-core";
import { ColorDefProps, ColorDef } from "./ColorDef";
import { Gradient } from "./Gradient";

/** @beta */
export enum ThematicGradientMode {
  Smooth = 0,
  Stepped = 1,
  SteppedWithDelimiter = 2,
  IsoLines = 3,
}

/** @beta */
export enum ThematicGradientColorScheme {
  BlueRed = 0,
  RedBlue = 1,
  Monochrome = 2,
  Topographic = 3,
  SeaMountain = 4,
  Custom = 5,
}

/** @beta */
export interface ThematicGradientSettingsProps {
  /** The thematic image mode used to generate the gradient. Defaults to [[ThematicGradientMode.Smooth]]. */
  mode?: ThematicGradientMode;
  /** The step count value used for [[ThematicGradientMode.Stepped]]. Defaults to 10. */
  stepCount?: number;
  /** The margin color used at the extremes of the gradient, when outside the applied range. Defaults to a black color using [[ColorDef.fromJSON]] with no arguments. */
  marginColor?: ColorDefProps;
  /** The color scheme used to generate the colors of the gradient color used at the extremes of the gradient, when outside the applied range. Defaults to [[ThematicGradientColorScheme.BlueRed]]. */
  colorScheme?: ThematicGradientColorScheme;
  /** The key color values that must be provided when using a custom thematic color scheme.
   * Defaults to empty, unless using a custom thematic color scheme. In that case, this defaults to two key colors going from white to black.
   * When using a custom thematic color scheme, there must be at least two entries in here. If there are not, it will revert to the default settings.
   */
  customKeys?: Gradient.KeyColorProps[];
}

/** Thematic settings specific to creating a color gradient used by [[ThematicDisplay]].
 * @beta
 */
export class ThematicGradientSettings {
  /** The thematic image mode used to generate the gradient. Defaults to [[ThematicGradientMode.Smooth]]. */
  public readonly mode: ThematicGradientMode;
  /** The step count value used for [[ThematicGradientMode.Stepped]]. Defaults to 10. */
  public readonly stepCount: number;
  /** The margin color used at the extremes of the gradient, when outside the applied range. Defaults to a black color using [[ColorDef.fromJSON]] with no arguments. */
  public readonly marginColor: ColorDef;
  /** The color scheme used to generate the colors of the gradient color used at the extremes of the gradient, when outside the applied range. Defaults to [[ThematicGradientColorScheme.BlueRed]]. */
  public readonly colorScheme: ThematicGradientColorScheme;
  /** The key color values that must be provided when using a custom thematic color scheme.
   * Defaults to empty, unless using a custom thematic color scheme. In that case, this defaults to two key colors going from white to black.
   * When using a custom thematic color scheme, there must be at least two entries in here. If there are not, it will revert to the default settings.
   */
  public readonly customKeys: Gradient.KeyColor[];

  public static get margin(): number { return .001; }    // A fixed portion of the gradient for out of range values.
  public static get contentRange(): number { return 1.0 - 2.0 * ThematicGradientSettings.margin; }
  public static get contentMax(): number { return 1.0 - ThematicGradientSettings.margin; }

  public static defaults = ThematicGradientSettings.fromJSON();

  private static _defaultCustomKeys = [[0.0, 255, 255, 255], [1.0, 0, 0, 0]];

  public equals(other: ThematicGradientSettings): boolean {
    if (this.mode !== other.mode)
      return false;
    if (this.stepCount !== other.stepCount)
      return false;
    if (!this.marginColor.equals(other.marginColor))
      return false;
    if (this.colorScheme !== other.colorScheme)
      return false;
    if (this.customKeys.length !== other.customKeys.length)
      return false;

    for (let i = 0; i < this.customKeys.length; i++) {
      if (!Gradient.keyColorEquals(this.customKeys[i], other.customKeys[i]))
        return false;
    }

    return true;
  }

  private constructor(json?: ThematicGradientSettingsProps) {
    this.customKeys = [];
    if (undefined === json) {
      this.mode = ThematicGradientMode.Smooth;
      this.stepCount = 10;
      this.marginColor = ColorDef.fromJSON();
      this.colorScheme = ThematicGradientColorScheme.BlueRed;
    } else {
      this.mode = (json.mode !== undefined && json.mode !== null) ? json.mode : ThematicGradientMode.Smooth;
      if (this.mode < ThematicGradientMode.Smooth || this.mode > ThematicGradientMode.IsoLines)
        this.mode = ThematicGradientMode.Smooth;

      this.stepCount = (typeof json.stepCount === "number") ? json.stepCount : 10;
      this.marginColor = ColorDef.fromJSON(json.marginColor);

      this.colorScheme = (json.colorScheme !== undefined && json.colorScheme !== null) ? json.colorScheme : ThematicGradientColorScheme.BlueRed;
      if (this.colorScheme < ThematicGradientColorScheme.BlueRed || this.colorScheme > ThematicGradientColorScheme.Custom)
        this.colorScheme = ThematicGradientColorScheme.BlueRed;

      if (json.customKeys !== undefined && json.customKeys !== null)
        json.customKeys.forEach((key) => this.customKeys.push(new Gradient.KeyColor(key)));

      // Enforce 2 entries in custom color keys if violated
      if (this.colorScheme === ThematicGradientColorScheme.Custom && this.customKeys.length < 2) {
        this.customKeys = [];
        for (const keyValue of ThematicGradientSettings._defaultCustomKeys)
          this.customKeys.push(new Gradient.KeyColor({ value: keyValue[0], color: ColorDef.computeTbgrFromComponents(keyValue[1], keyValue[3], keyValue[2]) }));
      }
    }
  }

  public static fromJSON(json?: ThematicGradientSettingsProps) {
    return new ThematicGradientSettings(json);
  }

  public toJSON(): ThematicGradientSettingsProps {
    const json: ThematicGradientSettingsProps = {
      mode: this.mode,
      stepCount: this.stepCount,
      marginColor: this.marginColor.toJSON(),
      colorScheme: this.colorScheme,
    };

    json.customKeys = [];
    this.customKeys.forEach((key) => json.customKeys!.push({ value: key.value, color: key.color.tbgr }));
    return json;
  }

  /** Create a copy of this ThematicGradientSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A ThematicGradientSettings with all of its properties set to match those of `this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: ThematicGradientSettingsProps): ThematicGradientSettings {
    if (undefined === changedProps)
      return ThematicGradientSettings.fromJSON(this.toJSON());

    const props: ThematicGradientSettingsProps = {
      mode: undefined !== changedProps.mode ? changedProps.mode : this.mode,
      stepCount: undefined !== changedProps.stepCount ? changedProps.stepCount : this.stepCount,
      marginColor: undefined !== changedProps.marginColor ? changedProps.marginColor : this.marginColor.tbgr,
      colorScheme: undefined !== changedProps.colorScheme ? changedProps.colorScheme : this.colorScheme,
      customKeys: undefined !== changedProps.customKeys ? changedProps.customKeys : this.customKeys.map((key) => ({ value: key.value, color: key.color.tbgr })),
    };

    return ThematicGradientSettings.fromJSON(props);
  }
}

/** The thematic display mode. This determines how to apply the thematic color gradient to the geometry.
 * @beta
 */
export enum ThematicDisplayMode {
  /** The color gradient will be mapped to surface geometry based on world height in meters. */
  Height = 0,
}

/** JSON representation of the thematic display setup of a [[DisplayStyle3d]].
 * @beta
 */
export interface ThematicDisplayProps {
  /** The thematic display mode. This determines how to apply the thematic color gradient to the geometry. Defaults to [[ThematicDisplayMode.Height]]. */
  displayMode?: ThematicDisplayMode;
  /** The settings used to create a color gradient applied to the geometry. The mode currently must be [[Gradient.ThematicMode.Smooth]]. Defaults to an instantiation using [[ThematicGradientSettings.fromJSON]] with no arguments. */
  gradientSettings?: ThematicGradientSettingsProps;
  /** The range in which to apply the thematic gradient. For [[ThematicDisplayMode.Height]], this is world space in meters. Defaults to a null range. */
  range?: Range1dProps;
  /** For [[ThematicDisplayMode.Height]], this is the axis along which to apply the thematic gradient in the scene. Defaults to {0,0,0}. */
  axis?: XYZProps;
}

/** The thematic display setup of a [[DisplayStyle3d]].
 * @beta
 */
export class ThematicDisplay {
  /** The thematic display mode. This determines how to apply the thematic color gradient to the geometry. Defaults to [[ThematicDisplayMode.Height]]. */
  public readonly displayMode: ThematicDisplayMode;
  /** The settings used to create a color gradient applied to the geometry. The mode currently must be [[Gradient.ThematicMode.Smooth]]. Defaults to an instantiation using [[ThematicGradientSettings.fromJSON]] with no arguments. */
  public readonly gradientSettings: ThematicGradientSettings;
  /** The range in which to apply the thematic gradient. For [[ThematicDisplayMode.Height]], this is world space in meters. Defaults to a null range. */
  public readonly range: Range1d;
  /** For [[ThematicDisplayMode.Height]], this is the axis along which to apply the thematic gradient in the scene. Defaults to {0,0,0}. */
  public readonly axis: Vector3d;

  public equals(other: ThematicDisplay): boolean {
    if (this.displayMode !== other.displayMode)
      return false;
    if (!this.gradientSettings.equals(other.gradientSettings))
      return false;
    if (!this.range.isAlmostEqual(other.range))
      return false;
    if (!this.axis.isAlmostEqual(other.axis))
      return false;

    return true;
  }

  private constructor(json?: ThematicDisplayProps) {
    if (undefined === json) {
      this.displayMode = ThematicDisplayMode.Height;
      this.gradientSettings = ThematicGradientSettings.fromJSON();
      this.axis = Vector3d.fromJSON();
      this.range = Range1d.fromJSON();
    } else {
      this.displayMode = (json.displayMode !== undefined && json.displayMode !== null) ? json.displayMode : ThematicDisplayMode.Height;
      if (this.displayMode < ThematicDisplayMode.Height || this.displayMode > ThematicDisplayMode.Height)
        this.displayMode = ThematicDisplayMode.Height;
      this.gradientSettings = ThematicGradientSettings.fromJSON(json.gradientSettings);
      this.axis = Vector3d.fromJSON(json.axis);
      this.range = Range1d.fromJSON(json.range);
    }
  }

  public static fromJSON(json?: ThematicDisplayProps) {
    return new ThematicDisplay(json);
  }

  public toJSON(): ThematicDisplayProps {
    return {
      displayMode: this.displayMode,
      gradientSettings: this.gradientSettings.toJSON(),
      axis: this.axis.toJSON(),
      range: this.range.toJSON(),
    };
  }
}
