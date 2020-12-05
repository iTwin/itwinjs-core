/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { areEqualPossiblyUndefined, JsonUtils } from "@bentley/bentleyjs-core";
import { ViewFlagOverrides, ViewFlagOverridesProps } from "./ViewFlags";
import { HiddenLine } from "./HiddenLine";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";
import { RgbColor, RgbColorProps } from "./RgbColor";
import { LinePixels } from "./LinePixels";

/** Wire format describing a [[CutStyle]] applied to section-cut geometry produced at intersections with a view's [ClipVector]($geometry-core).
 * @see [[ClipStyleProps.cutStyle]].
 * @beta
 */
export interface CutStyleProps {
  /** If defined, overrides aspects of the view's [[ViewFlags]] when drawing the cut geometry. */
  viewflags?: ViewFlagOverridesProps;
  /** If defined, overrides the view's [[HiddenLine.Settings]] when drawing the cut geometry. */
  hiddenLine?: HiddenLine.SettingsProps;
  /** If defined, overrides aspects of the cut geometry's symbology. */
  appearance?: FeatureAppearanceProps;
}

export class CutStyle {
  public readonly viewflags: Readonly<ViewFlagOverrides>;
  public readonly hiddenLine?: HiddenLine.Settings;
  public readonly appearance?: FeatureAppearance;

  private constructor(props?: CutStyleProps) {
    this.viewflags = ViewFlagOverrides.fromJSON(props?.viewflags);
    if (!props)
      return;

    const hiddenLine = props.hiddenLine ? HiddenLine.Settings.fromJSON(props.hiddenLine) : undefined;
    if (hiddenLine && !hiddenLine.matchesDefaults)
      this.hiddenLine = hiddenLine;

    const appearance = props.appearance ? FeatureAppearance.fromJSON(props.appearance) : undefined;
    if (appearance && !appearance.matchesDefaults)
      this.appearance = appearance;
  }

  public static fromJSON(props?: CutStyleProps): CutStyle {
    return new CutStyle(props);
  }

  public toJSON(): CutStyleProps | undefined {
    if (this.matchesDefaults)
      return undefined;

    const props: CutStyleProps = { };
    if (this.viewflags.anyOverridden())
      props.viewflags = this.viewflags.toJSON();

    if (this.hiddenLine && !this.hiddenLine.matchesDefaults)
      props.hiddenLine = this.hiddenLine?.toJSON();

    if (this.appearance && !this.appearance.matchesDefaults)
      props.appearance = this.appearance.toJSON();

    return props;
  }

  public get matchesDefaults(): boolean {
    return !this.viewflags.anyOverridden() && (!this.hiddenLine || this.hiddenLine.matchesDefaults) && (!this.appearance || this.appearance.matchesDefaults);
  }
}

/** Wire format describing a [[ClipAppearance]].
 * @see [[ClipStyleProps.insideAppearance]] and [[ClipStyleProps.outsideAppearance]].
 * @beta
 */
export interface ClipAppearanceProps {
  /** If defined, the geometry will be displayed in this color. */
  color?: RgbColorProps;
  /** If defined, the geometry will be displayed using this line pattern. */
  linePixels?: LinePixels;
  /** If `true`, the geometry will not be locatable. */
  nonLocatable?: true;
}

/** Overrides selected aspects of symbology based on whether the geometry is inside or outside of the view's [ClipVector]($geometry-core).
 * @see [[ClipStyle.insideAppearance]] and [[ClipStyle.outsideAppearance]].
 * @beta
 */
export class ClipAppearance {
  /** If defined, the geometry will be displayed in this color. */
  public readonly color?: RgbColor;
  /** If defined, the geometry will be displayed using this line pattern. */
  public readonly linePixels?: LinePixels;
  /** If `true`, the geometry will not be locatable. */
  public readonly nonLocatable: boolean;

  private constructor(json: ClipAppearanceProps) {
    this.color = json.color ? RgbColor.fromJSON(json.color) : undefined;
    this.linePixels = json.linePixels ?? undefined;
    this.nonLocatable = true === json.nonLocatable;
  }

  private static _default = new ClipAppearance({});

  public static fromJSON(props?: ClipAppearanceProps): ClipAppearance {
    return JsonUtils.isNonEmptyObject(props) ? new ClipAppearance(props) : this._default;
  }

  public toJSON(): ClipAppearanceProps | undefined {
    if (this.matchesDefaults)
      return undefined;

    const props: ClipAppearanceProps = { };
    if (undefined !== this.color)
      props.color = this.color.toJSON();

    if (undefined !== this.linePixels)
      props.linePixels = this.linePixels;

    if (this.nonLocatable)
      props.nonLocatable = true;

    return props;
    }

  public get matchesDefaults(): boolean {
    return this.equals(ClipAppearance._default);
  }

  public equals(other: ClipAppearance): boolean {
    return this.linePixels === other.linePixels && this.nonLocatable === other.nonLocatable
      && areEqualPossiblyUndefined(this.color, other.color, (a, b) => a.equals(b))
  }
}

/** Wire format describing a [[ClipStyle]].
 * @see [[DisplayStyleSettingsProps.clipStyle]].
 * @beta
 */
export interface ClipStyleProps {
  /** If `true`, geometry will be produced at the clip planes in a 3d view.
   * - Solids (closed volumes) will produce facets on the clip planes.
   * - Other surfaces will produce line strings representing the edges of the surface at the clip planes.
   */
  produceCutGeometry?: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  cutStyle?: CutStyleProps;
  /** Overrides aspects of the symbology of geometry that is outside of the clip volume. */
  outsideAppearance?: ClipAppearanceProps;
  /** Overrides aspects of the symbology of geometry that is inside of the clip volume. */
  insideAppearance?: ClipAppearanceProps;
}

/** Describes symbology and behavior applied to a [ClipVector]($geometry-core) when applied to a [ViewState]($frontend) or [[ModelClipGroup]].
 * @see [[DisplayStyleSettings.clipStyle]].
 * @beta
 */
export class ClipStyle {
  /** If `true`, geometry will be produced at the clip planes.
   * - Solids (closed volumes) will produce facets on the clip planes.
   * - Other surfaces will produce line strings representing the edges of the surface at the clip planes.
   */
  public readonly produceCutGeometry: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  public readonly cutStyle: CutStyle;
  /** Overrides aspects of the symbology of geometry that is outside of the clip volume. */
  outsideAppearance: ClipAppearance;
  /** Overrides aspects of the symbology of geometry that is inside of the clip volume. */
  insideAppearance: ClipAppearance;

  private static readonly _default = new ClipStyle({});

  private constructor(json: ClipStyleProps) {
    this.produceCutGeometry = json.produceCutGeometry ?? false;
    this.cutStyle = CutStyle.fromJSON(json.cutStyle);
    this.outsideAppearance = ClipAppearance.fromJSON(json.outsideAppearance);
    this.insideAppearance = ClipAppearance.fromJSON(json.insideAppearance);
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    return JsonUtils.isNonEmptyObject(props) ? new ClipStyle(props) : this._default;
  }

  public toJSON(): ClipStyleProps | undefined {
    if (this.matchesDefaults)
      return undefined;

    const props: ClipStyleProps = { };
    if (this.produceCutGeometry)
      props.produceCutGeometry = true;

    const cutStyle = this.cutStyle.toJSON();
    if (cutStyle)
      props.cutStyle = cutStyle;

    const outsideAppearance = this.outsideAppearance.toJSON();
    if (outsideAppearance)
      props.outsideAppearance = outsideAppearance;

    const insideAppearance = this.insideAppearance.toJSON();
    if (insideAppearance)
      props.insideAppearance = insideAppearance;

    return props;
  }

  public get matchesDefaults(): boolean {
    if (this === ClipStyle._default)
      return true;

    return !this.produceCutGeometry && this.cutStyle.matchesDefaults && this.outsideAppearance.matchesDefaults && this.insideAppearance.matchesDefaults;
  }
}
