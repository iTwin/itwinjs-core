/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Range1d, Range1dProps } from "@bentley/geometry-core";
import { ThematicGradientSettings, ThematicGradientSettingsProps } from "./ThematicDisplay";

/** JSON representation of an [[AnalysisStyle]].
 * @beta
 */
export interface AnalysisStyleProps {
  /** @see [[AnalysisStyle.displacementChannelName]]. */
  displacementChannelName?: string;
  /** @see [[AnalysisStyle.scalarChannelName]]. */
  scalarChannelName?: string;
  /** @see [[AnalysisStyle.normalChannelName]]. */
  normalChannelName?: string;
  /** @see [[AnalysisStyle.displacementScale]]. */
  displacementScale?: number;
  /** @see [[AnalysisStyle.scalarRange]]. ###TODO delete this? */
  scalarRange?: Range1dProps;
  /** @see [[AnalysisStyle.scalarThematicSettings]]. */
  scalarThematicSettings?: ThematicGradientSettingsProps;
}

/** As part of a [[DisplayStyleSettings]], describes how to animate meshes in the view that have been augmented with
 * [PolyfaceAuxData]($geometry-core). The style specifies which channels to use, and can deform the meshes by
 * translating vertices and/or recolor vertices using [[ThematicDisplay]].
 * @see [[DisplayStyleSettings.analysisStyle]] to define the analysis style for a [DisplayStyle]($backend).
 * @see [Viewport.analysisFraction]($frontend) to control playback of the animation.
 * @beta
 */
export class AnalysisStyle {
  /** If defined, the name of the [AuxChannel]($geometry-core) from which to obtain displacements by which to transform vertices.
   * @see [[displacementScale]] to adjust the magnitude of the displacement.
   */
  public readonly displacementChannelName?: string;
  /** If defined, the name of the [AuxChannel]($geometry-core) from which to obtain scalar values by which to recolor vertices. */
  public readonly scalarChannelName?: string;
  /** If defined, the name of the [AuxChannel]($geometry-core) from which to obtain normal vectors for the vertices. */
  public readonly normalChannelName?: string;
  /** A scale applied to the displacements specified by [[displacementChannelName]] to adjust the magnitude of displacement. */
  public readonly displacementScale: number;
  /** ###TODO delete this? */
  public scalarRange?: Range1d;
  /** Settings that define the gradient used to recolor vertices based on the values specified by [[scalarChannelName]].
   * The scalar values are used to index into the gradient image to obtain the color of each vertex.
   */
  public readonly scalarThematicSettings?: ThematicGradientSettings;

  /** Create an analysis style from its JSON representation.
   * @note AnalysisStyle is an immutable type - use [[clone]] to produce a modified copy.
   */
  public static fromJSON(props?: AnalysisStyleProps): AnalysisStyle {
    if (!props || (!props.displacementChannelName && !props.scalarChannelName && !props.normalChannelName && !props.displacementScale && !props.scalarRange && !props.scalarThematicSettings))
      return this._defaults;

    return new AnalysisStyle(props);
  }

  /** @internal */
  private constructor(props: AnalysisStyleProps) {
    this.displacementChannelName = props.displacementChannelName;
    this.scalarChannelName = props.scalarChannelName;
    this.normalChannelName = props.normalChannelName;
    this.displacementScale = props.displacementScale ?? 1;

    if (props.scalarRange)
      this.scalarRange = Range1d.fromJSON(props.scalarRange);

    if (props.scalarThematicSettings)
      this.scalarThematicSettings = ThematicGradientSettings.fromJSON(props.scalarThematicSettings);
  }

  /** Convert this style to its JSON representation. */
  public toJSON(): AnalysisStyleProps {
    const props: AnalysisStyleProps = { };
    if (this === AnalysisStyle._defaults)
      return props;

    if (undefined !== this.displacementChannelName)
      props.displacementChannelName = this.displacementChannelName;

    if (undefined !== this.scalarChannelName)
      props.scalarChannelName = this.scalarChannelName;

    if (undefined !== this.normalChannelName)
      props.normalChannelName = this.normalChannelName;

    if (1 !== this.displacementScale)
      props.displacementScale = this.displacementScale;

    if (undefined !== this.scalarRange)
      props.scalarRange = this.scalarRange.toJSON();

    if (undefined !== this.scalarThematicSettings)
      props.scalarThematicSettings = this.scalarThematicSettings.toJSON();

    return props;
  }

  /** Produce a copy of this style identical except for properties explicitly specified by `changedProps`. */
  public clone(changedProps: AnalysisStyleProps): AnalysisStyle {
    return AnalysisStyle.fromJSON({
      ...this.toJSON(),
      ...changedProps,
    });
  }

  private static _defaults = new AnalysisStyle({ });
}
