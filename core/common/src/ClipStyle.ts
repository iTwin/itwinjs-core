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

  public static readonly defaults = new CutStyle();

  private constructor(viewflags?: Readonly<ViewFlagOverrides>, hiddenLine?: HiddenLine.Settings, appearance?: FeatureAppearance) {
    this.viewflags = viewflags ?? ViewFlagOverrides.fromJSON();
    if (hiddenLine && !hiddenLine.matchesDefaults)
      this.hiddenLine = hiddenLine;

    if (appearance && !appearance.matchesDefaults)
      this.appearance = appearance;
  }

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
    if (this === CutStyle.defaults)
      return true;

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

  public static readonly defaults = new ClipAppearance();

  private constructor(color?: RgbColor, linePixels?: LinePixels, nonLocatable?: boolean) {
    this.color = color;
    this.linePixels = linePixels;
    this.nonLocatable = true === nonLocatable;
  }

  public static create(color?: RgbColor, linePixels?: LinePixels, nonLocatable?: boolean): ClipAppearance {
    if (undefined === color && undefined === linePixels && true !== nonLocatable)
      return this.defaults;

    return new ClipAppearance(color, linePixels, nonLocatable);
  }

  public static fromJSON(props?: ClipAppearanceProps): ClipAppearance {
    if (JsonUtils.isNonEmptyObject(props)) {
      const color = props.color ? RgbColor.fromJSON(props.color) : undefined;
      return this.create(color, props?.linePixels, props?.nonLocatable);
    } else {
      return this.defaults;
    }
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
    return this.equals(ClipAppearance.defaults);
  }

  public equals(other: ClipAppearance): boolean {
    return this.linePixels === other.linePixels && this.nonLocatable === other.nonLocatable
      && areEqualPossiblyUndefined(this.color, other.color, (a, b) => a.equals(b));
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
   * @note Cut geometry will only be produced for element geometry - not for, e.g., terrain or reality models.
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
   * @note Cut geometry will only be produced for element geometry - not for, e.g., terrain or reality models.
   */
  public readonly produceCutGeometry: boolean;
  /** Controls aspects of how the cut geometry is displayed, if [[produceCutGeometry]] is `true`. */
  public readonly cutStyle: CutStyle;
  /** Overrides aspects of the symbology of geometry that is outside of the clip volume. */
  public readonly outsideAppearance: ClipAppearance;
  /** Overrides aspects of the symbology of geometry that is inside of the clip volume. */
  public readonly insideAppearance: ClipAppearance;

  public static readonly defaults = new ClipStyle(false, CutStyle.defaults, ClipAppearance.defaults, ClipAppearance.defaults);

  private constructor(produceCutGeometry: boolean, cutStyle: CutStyle, insideAppearance: ClipAppearance, outsideAppearance: ClipAppearance) {
    this.produceCutGeometry = produceCutGeometry;
    this.cutStyle = cutStyle;
    this.insideAppearance = insideAppearance;
    this.outsideAppearance = outsideAppearance;
  }

  public static create(produceCutGeometry: boolean, cutStyle: CutStyle, insideAppearance: ClipAppearance, outsideAppearance: ClipAppearance): ClipStyle {
    if (!produceCutGeometry && cutStyle.matchesDefaults && insideAppearance.matchesDefaults && outsideAppearance.matchesDefaults)
      return this.defaults;

    return new ClipStyle(produceCutGeometry, cutStyle, insideAppearance, outsideAppearance);
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    if (JsonUtils.isNonEmptyObject(props)) {
      const produceCutGeometry = props.produceCutGeometry ?? false;
      const cutStyle = CutStyle.fromJSON(props.cutStyle);
      const insideAppearance = ClipAppearance.fromJSON(props.insideAppearance);
      const outsideAppearance = ClipAppearance.fromJSON(props.outsideAppearance);

      return this.create(produceCutGeometry, cutStyle, insideAppearance, outsideAppearance);
    } else {
      return this.defaults;
    }
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
    if (this === ClipStyle.defaults)
      return true;

    return !this.produceCutGeometry && this.cutStyle.matchesDefaults && this.outsideAppearance.matchesDefaults && this.insideAppearance.matchesDefaults;
  }
}
