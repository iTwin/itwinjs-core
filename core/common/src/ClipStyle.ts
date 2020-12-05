/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ViewFlagOverrides, ViewFlagOverridesProps } from "./ViewFlags";
import { HiddenLine } from "./HiddenLine";
import { FeatureAppearance, FeatureAppearanceProps } from "./FeatureSymbology";

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

  private static readonly _default = new ClipStyle();

  private constructor(json?: ClipStyleProps) {
    this.produceCutGeometry = json?.produceCutGeometry ?? false;
    this.cutStyle = CutStyle.fromJSON(json?.cutStyle);
  }

  public static fromJSON(props?: ClipStyleProps): ClipStyle {
    return props ? new ClipStyle(props) : this._default;
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

    return props;
  }

  public get matchesDefaults(): boolean {
    if (this === ClipStyle._default)
      return true;

    return !this.produceCutGeometry && this.cutStyle.matchesDefaults;
  }
}
