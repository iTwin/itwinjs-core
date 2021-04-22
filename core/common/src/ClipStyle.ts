/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, JsonUtils } from "@bentley/bentleyjs-core";
import { ViewFlagOverrides, ViewFlagOverridesProps } from "./ViewFlags";
import { RgbColor, RgbColorProps } from "./RgbColor";
import { HiddenLine } from "./HiddenLine";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";

/** Wire format describing a [[CutStyle]] applied to section-cut geometry produced at intersections with a view's [ClipVector]($geometry-core).
 * @see [[ClipStyleProps.cutStyle]].
 * @public
 */
export interface CutStyleProps {
  /** If defined, overrides aspects of the view's [[ViewFlags]] when drawing the cut geometry. */
  viewflags?: ViewFlagOverridesProps;
  /** If defined, overrides the view's [[HiddenLine.Settings]] when drawing the cut geometry. */
  hiddenLine?: HiddenLine.SettingsProps;
  /** If defined, overrides aspects of the cut geometry's symbology. */
  appearance?: FeatureAppearanceProps;
}

/** As part of a [[ClipStyle]], describes how section-cut graphics should be displayed.
 * @note Section-cut graphics are only produced if [[ClipStyle.produceCutGeometry]] is `true`.
 * @public
 */
export class CutStyle {
  /** Selectively overrides some of the view's [[ViewFlags]] when drawing the section-cut graphics. */
  public readonly viewflags: Readonly<ViewFlagOverrides>;
  /** If defined, overrides the settings the view uses to draw the edges of the section-cut graphics. */
  public readonly hiddenLine?: HiddenLine.Settings;
  /** If defined, overrides aspects of the symbology of the section-cut graphics. */
  public readonly appearance?: FeatureAppearance;

  /** The default CutStyle, configured to draw the section-cut graphics using the view's settings, with no overrides. */
  public static readonly defaults = new CutStyle();

  private constructor(viewflags?: Readonly<ViewFlagOverrides>, hiddenLine?: HiddenLine.Settings, appearance?: FeatureAppearance) {
    this.viewflags = viewflags ?? ViewFlagOverrides.fromJSON();
    if (hiddenLine && !hiddenLine.matchesDefaults)
      this.hiddenLine = hiddenLine;

    if (appearance && !appearance.matchesDefaults)
      this.appearance = appearance;
  }

  /** Create a CutStyle from its components. */
  public static create(viewflags?: Readonly<ViewFlagOverrides>, hiddenLine?: HiddenLine.Settings, appearance?: FeatureAppearance): CutStyle {
    if ((viewflags && viewflags.anyOverridden()) || (hiddenLine && !hiddenLine.matchesDefaults) || (appearance && !appearance.matchesDefaults))
      return new CutStyle(viewflags, hiddenLine, appearance);

    return this.defaults;
  }

  public static fromJSON(props?: CutStyleProps): CutStyle {
    if (JsonUtils.isNonEmptyObject(props)) {
      const viewflags = ViewFlagOverrides.fromJSON(props?.viewflags);
      const hiddenLine = props?.hiddenLine ? HiddenLine.Settings.fromJSON(props.hiddenLine) : undefined;
      const appearance = props?.appearance ? FeatureAppearance.fromJSON(props.appearance) : undefined;

      return this.create(viewflags, hiddenLine, appearance);
    } else {
      return this.defaults;
    }
  }

  /** Return JSON representation. The representation is `undefined` if this style matches the default style. */
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

  /** Returns true if this style matches the default style - that is, it overrides none of the view's settings. */
  public get matchesDefaults(): boolean {
    if (this === CutStyle.defaults)
      return true;

    return !this.viewflags.anyOverridden() && (!this.hiddenLine || this.hiddenLine.matchesDefaults) && (!this.appearance || this.appearance.matchesDefaults);
  }
}

/** Wire format describing a [[ClipStyle]].
 * @see [[DisplayStyleSettingsProps.clipStyle]].
 * @public
 */
export interface ClipStyleProps {
  /** If `true`, geometry will be produced at the clip planes in a 3d view.
   * - Solids (closed volumes) will produce facets on the clip planes.
   * - Other surfaces will produce line strings representing the edges of the surface at the clip planes.
   * @note Cut geometry will only be produced for element geometry - not for, e.g., terrain or reality models.
   */
  produceCutGeometry?: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  cutStyle?: CutStyleProps;
  /** If defined, geometry inside the clip planes will be drawn in this color. */
  insideColor?: RgbColorProps;
  /** If defined, geometry outside of the clip planes will be drawn in this color instead of being clipped. */
  outsideColor?: RgbColorProps;
}

/** Describes symbology and behavior applied to a [ClipVector]($geometry-core) when applied to a [ViewState]($frontend) or [[ModelClipGroup]].
 * @see [[DisplayStyleSettings.clipStyle]].
 * @public
 */
export class ClipStyle {
  /** If `true`, geometry will be produced at the clip planes.
   * - Solids (closed volumes) will produce facets on the clip planes.
   * - Other surfaces will produce line strings representing the edges of the surface at the clip planes.
   * @note Cut geometry will only be produced for element geometry - not for, e.g., terrain or reality models.
   */
  public readonly produceCutGeometry: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  public readonly cutStyle: CutStyle;
  /** If defined, geometry inside the clip planes will be drawn in this color. */
  public readonly insideColor?: RgbColor;
  /** If defined, geometry outside of the clip planes will be drawn in this color instead of being clipped. */
  public readonly outsideColor?: RgbColor;

  /** The default style, which overrides none of the view's settings. */
  public static readonly defaults = new ClipStyle(false, CutStyle.defaults, undefined, undefined);

  private constructor(produceCutGeometry: boolean, cutStyle: CutStyle, inside: RgbColor | undefined, outside: RgbColor | undefined) {
    this.produceCutGeometry = produceCutGeometry;
    this.cutStyle = cutStyle;
    this.insideColor = inside;
    this.outsideColor = outside;
  }

  /** Create a style from its components. */
  public static create(produceCutGeometry: boolean, cutStyle: CutStyle, insideColor?: RgbColor, outsideColor?: RgbColor): ClipStyle {
    if (!produceCutGeometry && cutStyle.matchesDefaults && !insideColor && !outsideColor)
      return this.defaults;

    return new ClipStyle(produceCutGeometry, cutStyle, insideColor, outsideColor);
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    if (JsonUtils.isNonEmptyObject(props)) {
      const produceCutGeometry = props.produceCutGeometry ?? false;
      const cutStyle = CutStyle.fromJSON(props.cutStyle);
      const inside = props.insideColor ? RgbColor.fromJSON(props.insideColor) : undefined;
      const outside = props.outsideColor ? RgbColor.fromJSON(props.outsideColor) : undefined;

      return this.create(produceCutGeometry, cutStyle, inside, outside);
    }

    return this.defaults;
  }

  /** The JSON representation of this style. It is `undefined` if this style matches the defaults. */
  public toJSON(): ClipStyleProps | undefined {
    if (this.matchesDefaults)
      return undefined;

    const props: ClipStyleProps = { };
    if (this.produceCutGeometry)
      props.produceCutGeometry = true;

    const cutStyle = this.cutStyle.toJSON();
    if (cutStyle) {
      assert(!this.cutStyle.matchesDefaults);
      props.cutStyle = cutStyle;
    }

    if (this.insideColor)
      props.insideColor = this.insideColor.toJSON();

    if (this.outsideColor)
      props.outsideColor = this.outsideColor.toJSON();

    return props;
  }

  /** Returns true if this style matches the [[ClipStyle.defaults]] - that is, it overrides no settings from the view. */
  public get matchesDefaults(): boolean {
    if (this === ClipStyle.defaults)
      return true;

    return !this.produceCutGeometry && !this.insideColor && !this.outsideColor && this.cutStyle.matchesDefaults;
  }
}
