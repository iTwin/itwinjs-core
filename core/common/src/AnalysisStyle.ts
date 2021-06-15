/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { assert } from "@bentley/bentleyjs-core";
import { Range1d, Range1dProps } from "@bentley/geometry-core";
import { ThematicGradientSettings, ThematicGradientSettingsProps } from "./ThematicDisplay";
import { Gradient } from "./Gradient";

/** JSON representation of an [[AnalysisStyleDisplacement]].
 * @see [[AnalysisStyleProps.displacement]].
 * @beta
 */
export interface AnalysisStyleDisplacementProps {
  /** @see [[AnalysisStyleDisplacement.channelName]]. */
  channelName: string;
  /** @see [[AnalysisStyleDisplacement.scale]].
   * Default value: 1.
   */
  scale?: number;
}

/** Describes how an [[AnalysisStyle]] deforms a [Polyface]($geometry-core) by applying translation to its vertices.
 * @see [[AnalysisStyle.displacement]].
 * @beta
 */
export class AnalysisStyleDisplacement {
  /** The name of the [AuxChannel]($geometry-core) supplying the displacements to be applied to the vertices. */
  public readonly channelName: string;
  /** A scale applied to the displacements to adjust the magnitude of the effect.
   * Default value: 1.
   */
  public readonly scale: number;

  /** @internal */
  private constructor(channelName: string, scale = 1) {
    this.channelName = channelName;
    this.scale = scale;
  }

  /** Create from JSON representation. */
  public static fromJSON(props: AnalysisStyleDisplacementProps): AnalysisStyleDisplacement {
    return new this(props.channelName, props.scale);
  }

  /** Convert to JSON representation. */
  public toJSON(): AnalysisStyleDisplacementProps {
    const props: AnalysisStyleDisplacementProps = { channelName: this.channelName };
    if (this.scale !== 1)
      props.scale = this.scale;

    return props;
  }

  /** Return true if `this` is equivalent to `other`. */
  public equals(other: AnalysisStyleDisplacement): boolean {
    return this.channelName === other.channelName && this.scale === other.scale;
  }
}

/** JSON representation of an [[AnalysisStyleScalar]].
 * @see [[AnalysisStyleProps.scalar]].
 * @beta
 */
export interface AnalysisStyleScalarProps {
  /** @see [[AnalysisStyleScalar.channelName]]. */
  channelName: string;
  /** @see [[AnalysisStyleScalar.range]]. */
  range: Range1dProps;
  /** @see [[AnalysisStyleScalar.thematicSettings]].
   * Default value: [[ThematicGradientSettings.defaults]].
   */
  thematicSettings?: ThematicGradientSettingsProps;
}

/** Describes how an [[AnalysisStyle]] recolors [Polyface]($geometry-core) vertices by mapping scalar values supplied
 * by an [AuxChannel]($geometry-core) to colors supplied by a [[Gradient]] image.
 * @see [[AnalysisStyle.scalar]].
 * @beta
 */
export class AnalysisStyleScalar {
  /** The name of the [AuxChannel]($geometry-core) supplying the scalar values from which the vertex colors are computed. */
  public readonly channelName: string;
  /** The minimum and maximum scalar values that map to colors in the [[Gradient]] image. Vertices with values outside of
   * this range are displayed with the gradient's margin color.
   */
  public readonly range: Readonly<Range1d>;
  /** Settings used to produce the [[Gradient]] image. */
  public readonly thematicSettings: ThematicGradientSettings;
  private _gradient?: Gradient.Symb;

  /** @internal */
  private constructor(props: AnalysisStyleScalarProps) {
    this.channelName = props.channelName;
    this.range = Range1d.fromJSON(props.range);
    this.thematicSettings = ThematicGradientSettings.fromJSON(props.thematicSettings);
  }

  /** Create from JSON representation. */
  public static fromJSON(props: AnalysisStyleScalarProps): AnalysisStyleScalar {
    return new this(props);
  }

  /** Convert to JSON representation. */
  public toJSON(): AnalysisStyleScalarProps {
    const props: AnalysisStyleScalarProps = {
      channelName: this.channelName,
      range: this.range.toJSON(),
    };

    if (!this.thematicSettings.equals(ThematicGradientSettings.defaults))
      props.thematicSettings = this.thematicSettings.toJSON();

    return props;
  }

  /** The gradient computed from [[thematicSettings]]. */
  public get gradient(): Gradient.Symb {
    if (!this._gradient)
      this._gradient = Gradient.Symb.createThematic(this.thematicSettings);

    return this._gradient;
  }

  /** Return true if `this` is equivalent to `other`. */
  public equals(other: AnalysisStyleScalar): boolean {
    return this.channelName === other.channelName && this.range.isAlmostEqual(other.range) && this.thematicSettings.equals(other.thematicSettings);
  }
}

/** JSON representation of an [[AnalysisStyle]].
 * @beta
 */
export interface AnalysisStyleProps {
  /** @see [[AnalysisStyle.displacement]]. */
  displacement?: AnalysisStyleDisplacementProps;
  /** @see [[AnalysisStyle.scalar]]. */
  scalar?: AnalysisStyleScalarProps;
  /** @see [[AnalysisStyle.normalChannelName]]. */
  normalChannelName?: string;
}

/** At time of writing, the only iModel in existence that uses AnalysisStyle is the one created by the analysis-importer test app.
 * To avoid breaking existing saved views of that iModel, AnalysisStyle.fromJSON() continues  to accept the old JSON representation -
 * but that representation is not part of the public API.
 * @internal exported strictly for tests.
 */
export interface LegacyAnalysisStyleProps {
  displacementChannelName?: string;
  scalarChannelName?: string;
  normalChannelName?: string;
  displacementScale?: number;
  scalarRange?: Range1dProps;
  scalarThematicSettings?: ThematicGradientSettingsProps;
}

function tryConvertLegacyProps(input: AnalysisStyleProps): AnalysisStyleProps {
  if (input.displacement || input.scalar)
    return input;

  const legacy = input as LegacyAnalysisStyleProps;
  if (undefined === legacy.displacementChannelName && undefined === legacy.scalarChannelName)
    return input;

  const output: AnalysisStyleProps = {
    normalChannelName: input.normalChannelName,
  };

  if (undefined !== legacy.displacementChannelName) {
    output.displacement = {
      channelName: legacy.displacementChannelName,
      scale: legacy.displacementScale,
    };
  }

  if (undefined !== legacy.scalarChannelName && undefined !== legacy.scalarRange) {
    output.scalar = {
      channelName: legacy.scalarChannelName,
      range: legacy.scalarRange,
      thematicSettings: legacy.scalarThematicSettings,
    };
  }

  return output;
}

/** As part of a [[DisplayStyleSettings]], describes how to animate meshes in the view that have been augmented with
 * [PolyfaceAuxData]($geometry-core). The style specifies which channels to use, and can deform the meshes by
 * translating vertices and/or recolor vertices using [[ThematicDisplay]].
 * @see [[DisplayStyleSettings.analysisStyle]] to define the analysis style for a [DisplayStyle]($backend).
 * @see [Viewport.analysisFraction]($frontend) to control playback of the animation.
 * @beta
 */
export class AnalysisStyle {
  public readonly displacement?: AnalysisStyleDisplacement;
  public readonly scalar?: AnalysisStyleScalar;
  /** If defined, the name of the [AuxChannel]($geometry-core) from which to obtain normal vectors for the vertices. */
  public readonly normalChannelName?: string;

  /** Create an analysis style from its JSON representation.
   * @note AnalysisStyle is an immutable type - use [[clone]] to produce a modified copy.
   */
  public static fromJSON(props?: AnalysisStyleProps): AnalysisStyle {
    if (!props)
      return this.defaults;

    props = tryConvertLegacyProps(props);
    if (!props.displacement && !props.scalar && undefined === props.normalChannelName)
      return this.defaults;

    return new AnalysisStyle(props);
  }

  /** @internal */
  private constructor(props: AnalysisStyleProps) {
    this.normalChannelName = props.normalChannelName;
    if (props.displacement)
      this.displacement = AnalysisStyleDisplacement.fromJSON(props.displacement);

    if (props.scalar)
      this.scalar = AnalysisStyleScalar.fromJSON(props.scalar);
  }

  /** Convert this style to its JSON representation. */
  public toJSON(): AnalysisStyleProps {
    const props: AnalysisStyleProps = { };
    if (this === AnalysisStyle.defaults)
      return props;

    if (this.displacement)
      props.displacement = this.displacement.toJSON();

    if (this.scalar)
      props.scalar = this.scalar.toJSON();

    if (undefined !== this.normalChannelName)
      props.normalChannelName = this.normalChannelName;

    return props;
  }

  /** Produce a copy of this style identical except for properties explicitly specified by `changedProps`. */
  public clone(changedProps: AnalysisStyleProps): AnalysisStyle {
    return AnalysisStyle.fromJSON({
      ...this.toJSON(),
      ...changedProps,
    });
  }

  /** Return true if this style is equivalent to `other`. */
  public equals(other: AnalysisStyle): boolean {
    if (this.normalChannelName !== other.normalChannelName)
      return false;

    if ((undefined === this.displacement) !== (undefined === other.displacement))
      return false;
    else if (this.displacement && !this.displacement.equals(other.displacement!))
      return false;

    if ((undefined === this.scalar) !== (undefined === other.scalar))
      return false;

    return undefined === this.scalar || this.scalar.equals(other.scalar!);
  }

  public static readonly defaults = new AnalysisStyle({ });
}
