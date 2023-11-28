/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, JsonUtils } from "@itwin/core-bentley";
import { ViewFlagOverrides } from "./ViewFlags";
import { RgbColor, RgbColorProps } from "./RgbColor";
import { HiddenLine } from "./HiddenLine";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";
import { ColorDef } from "./ColorDef";

/** Wire format describing a [[CutStyle]] applied to section-cut geometry produced at intersections with a view's [ClipVector]($core-geometry).
 * @see [[ClipStyleProps.cutStyle]].
 * @public
 * @extensions
 */
export interface CutStyleProps {
  /** If defined, overrides aspects of the view's [[ViewFlags]] when drawing the cut geometry. */
  viewflags?: ViewFlagOverrides;
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
    this.viewflags = viewflags ?? {};
    if (hiddenLine && !hiddenLine.matchesDefaults)
      this.hiddenLine = hiddenLine;

    if (appearance && !appearance.matchesDefaults)
      this.appearance = appearance;
  }

  /** Create a CutStyle from its components. */
  public static create(viewflags?: Readonly<ViewFlagOverrides>, hiddenLine?: HiddenLine.Settings, appearance?: FeatureAppearance): CutStyle {
    if ((viewflags && JsonUtils.isNonEmptyObject(viewflags)) || (hiddenLine && !hiddenLine.matchesDefaults) || (appearance && !appearance.matchesDefaults))
      return new CutStyle(viewflags, hiddenLine, appearance);

    return this.defaults;
  }

  public static fromJSON(props?: CutStyleProps): CutStyle {
    if (JsonUtils.isNonEmptyObject(props)) {
      const viewflags = { ...props?.viewflags };
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

    const props: CutStyleProps = {};
    if (JsonUtils.isNonEmptyObject(this.viewflags))
      props.viewflags = this.viewflags;

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

    return !JsonUtils.isNonEmptyObject(this.viewflags) && (!this.hiddenLine || this.hiddenLine.matchesDefaults) && (!this.appearance || this.appearance.matchesDefaults);
  }
}

/** Wire format describing a [[ClipIntersectionStyle]].
 * @see [[ClipStyleProps.ClipIntersectionStyle]].
 * @public
 * @extensions
 */
export interface ClipIntersectionStyleProps {
  /** Color to apply to intersection of geometry and clip planes, default white */
  color?: RgbColorProps;
  /** Number of pixels to be considered intersecting the clip plane, default 1 */
  width?: number;
}

/** As part of a [[ClipStyle]], describes how to colorize geometry intersecting the clip planes.
 * @note Edges are highlighted only if [[ClipStyle.ClipIntersectionStyle]] is `true`.
 * @public
 * @extensions
 */
export class ClipIntersectionStyle {
  /** Color to apply to intersection of geometry and clip planes, default white */
  public readonly color: RgbColor;
  /** Number of pixels to be considered intersecting the clip plane, default 1 */
  public readonly width: number;

  private constructor(color: RgbColor = RgbColor.fromColorDef(ColorDef.white), width: number = 1) {
    this.color = color;
    this.width = width;
  }
  /** Create a highlight  from its components. */
  public static create(color?: RgbColor, width?: number): ClipIntersectionStyle {
    if (!color && !width)
      return this.defaults;

    return new ClipIntersectionStyle(color, width);
  }

  public static readonly defaults = new ClipIntersectionStyle();

  public static fromJSON(props?: ClipIntersectionStyleProps): ClipIntersectionStyle {
    if (props === undefined) {
      return ClipIntersectionStyle.defaults;
    }

    const color = props.color ? RgbColor.fromJSON(props.color) : RgbColor.fromColorDef(ColorDef.white);
    const width = props.width ? props.width : 1;
    return new ClipIntersectionStyle(color, width);
  }

  /** The JSON representation of this style. It is `undefined` if this style matches the defaults. */
  public toJSON(): ClipIntersectionStyleProps | undefined {
    const props: ClipIntersectionStyleProps = {};

    if (this.matchesDefaults) {
      return undefined;
    }

    if (this.color)
      props.color = this.color.toJSON();

    if (this.width)
      props.width = this.width;

    return props;
  }

  public get matchesDefaults(): boolean {
    if (this === ClipIntersectionStyle.defaults)
      return true;

    return !this.color && !this.width;
  }
}

/** Arguments supplied to [[ClipStyle.create]].
 * @public
 * @extensions
 */
export interface ClipStyleCreateArgs {
  /** If `true`, geometry will be produced at the clip planes in a 3d view.
   * - Solids (closed volumes) will produce facets on the clip planes.
   * - Other surfaces will produce line strings representing the edges of the surface at the clip planes.
   * @note Cut geometry will only be produced for element geometry - not for, e.g., terrain or reality models.
   */
  produceCutGeometry?: boolean;
  /** If `true`, intersection of geometry and clip planes will be colorized */
  colorizeIntersection?: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  cutStyle?: CutStyle;
  /** If defined, geometry inside the clip planes will be drawn in this color. */
  insideColor?: RgbColor;
  /** If defined, geometry outside of the clip planes will be drawn in this color instead of being clipped. */
  outsideColor?: RgbColor;
  /** Controls the style of the intersection of geometry and clip planes */
  intersectionStyle?: ClipIntersectionStyle;
}

/** Wire format describing a [[ClipStyle]].
 * @see [[DisplayStyleSettingsProps.clipStyle]].
 * @public
 * @extensions
 */
export interface ClipStyleProps {
  /** If `true`, geometry will be produced at the clip planes in a 3d view.
   * - Solids (closed volumes) will produce facets on the clip planes.
   * - Other surfaces will produce line strings representing the edges of the surface at the clip planes.
   * @note Cut geometry will only be produced for element geometry - not for, e.g., terrain or reality models.
   */
  produceCutGeometry?: boolean;
  /** If 'true', intersection of geometry and clip planes will be colorized */
  colorizeIntersection?: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  cutStyle?: CutStyleProps;
  /** If defined, geometry inside the clip planes will be drawn in this color. */
  insideColor?: RgbColorProps;
  /** If defined, geometry outside of the clip planes will be drawn in this color instead of being clipped. */
  outsideColor?: RgbColorProps;
  /** Controls the style of the intersection of geometry and clip planes */
  intersectionStyle?: ClipIntersectionStyleProps;
}

/** Describes symbology and behavior applied to a [ClipVector]($core-geometry) when applied to a [ViewState]($frontend) or [[ModelClipGroup]].
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
  /** If 'true', intersection of geometry and clip planes will be colorized */
  public readonly colorizeIntersection: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  public readonly cutStyle: CutStyle;
  /** If defined, geometry inside the clip planes will be drawn in this color. */
  public readonly insideColor?: RgbColor;
  /** If defined, geometry outside of the clip planes will be drawn in this color instead of being clipped. */
  public readonly outsideColor?: RgbColor;
  /** Controls the style of the intersection of geometry and clip planes */
  public readonly intersectionStyle?: ClipIntersectionStyle;

  /** The default style, which overrides none of the view's settings. */
  public static readonly defaults = new ClipStyle(false, false, CutStyle.defaults, undefined, undefined, undefined);

  private constructor(produceCutGeometry: boolean, colorizeIntersection: boolean, cutStyle: CutStyle, inside: RgbColor | undefined, outside: RgbColor | undefined, intersectionStyle: ClipIntersectionStyle | undefined) {
    this.produceCutGeometry = produceCutGeometry;
    this.colorizeIntersection = colorizeIntersection;
    this.cutStyle = cutStyle;
    this.insideColor = inside;
    this.outsideColor = outside;
    this.intersectionStyle = intersectionStyle;
  }

  /** @deprecated in 4.x. Use [[create(style: ClipStyleCreateArgs]] */
  public static create(produceCutGeometry: boolean, cutStyle: CutStyle, insideColor?: RgbColor, outsideColor?: RgbColor): ClipStyle;

  /** Create a style from its components. */
  public static create(style: ClipStyleCreateArgs): ClipStyle;

  /** @internal */
  public static create(styleOrProduceCutGeometry: ClipStyleCreateArgs | boolean, cutStyle?: CutStyle, insideColor?: RgbColor, outsideColor?: RgbColor): ClipStyle {

    if (typeof styleOrProduceCutGeometry === "boolean") {
      cutStyle = cutStyle === undefined ? CutStyle.defaults : cutStyle;

      if (!styleOrProduceCutGeometry && cutStyle.matchesDefaults && !insideColor && !outsideColor) {
        return this.defaults;
      }

      return new ClipStyle(styleOrProduceCutGeometry, false, cutStyle, insideColor, outsideColor, undefined);
    }

    const style = styleOrProduceCutGeometry;
    if (!style.produceCutGeometry && !style.colorizeIntersection && (!style.cutStyle || style.cutStyle.matchesDefaults) && !style.insideColor && !style.outsideColor && !style.intersectionStyle)
      return this.defaults;

    const produceCutGeometry = style.produceCutGeometry ? true : false;
    const colorizeIntersection = style.colorizeIntersection ? true : false;
    cutStyle = style.cutStyle === undefined ? CutStyle.defaults : style.cutStyle;

    return new ClipStyle(produceCutGeometry, colorizeIntersection, cutStyle, style.insideColor, style.outsideColor,  style.intersectionStyle);
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    if (JsonUtils.isNonEmptyObject(props)) {
      const produceCutGeometry = props.produceCutGeometry ?? false;
      const colorizeIntersection = props.colorizeIntersection ? true : false;
      const cutStyle = CutStyle.fromJSON(props.cutStyle);
      const insideColor = props.insideColor ? RgbColor.fromJSON(props.insideColor) : undefined;
      const outsideColor = props.outsideColor ? RgbColor.fromJSON(props.outsideColor) : undefined;
      const intersectionStyle = props.intersectionStyle ? ClipIntersectionStyle.fromJSON(props.intersectionStyle) : undefined;

      return this.create({produceCutGeometry, colorizeIntersection, cutStyle, insideColor, outsideColor, intersectionStyle});
    }

    return this.defaults;
  }

  /** The JSON representation of this style. It is `undefined` if this style matches the defaults. */
  public toJSON(): ClipStyleProps | undefined {
    if (this.matchesDefaults)
      return undefined;

    const props: ClipStyleProps = {};
    if (this.produceCutGeometry)
      props.produceCutGeometry = true;

    if (this.colorizeIntersection)
      props.colorizeIntersection = true;

    const cutStyle = this.cutStyle.toJSON();
    if (cutStyle) {
      assert(!this.cutStyle.matchesDefaults);
      props.cutStyle = cutStyle;
    }

    if (this.insideColor)
      props.insideColor = this.insideColor.toJSON();

    if (this.outsideColor)
      props.outsideColor = this.outsideColor.toJSON();

    if (this.intersectionStyle)
      props.intersectionStyle = this.intersectionStyle.toJSON();

    return props;
  }

  /** Returns true if this style matches the [[ClipStyle.defaults]] - that is, it overrides no settings from the view. */
  public get matchesDefaults(): boolean {
    if (this === ClipStyle.defaults)
      return true;

    return !this.produceCutGeometry && !this.colorizeIntersection && !this.insideColor && !this.outsideColor && this.cutStyle.matchesDefaults && !this.intersectionStyle;
  }
}
