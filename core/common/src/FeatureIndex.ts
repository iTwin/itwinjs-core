/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorDef } from "./ColorDef";

/** As part of a [[ColorIndex]], describes per-vertex colors for a [MeshArgs]($frontend) or [PolylineArgs]($frontend).
 * The [[colors]] array holds the set of unique colors. The [[indices]] array describes the color of each vertex as an index into [[colors]].
 * @note A `NonUniformColor` table cannot contain a mix of opaque and translucent colors. If any color in [[colors]] has a transparency greater
 * than zero, all of them must have a transparency greater than zero.
 * @public
 */
export class NonUniformColor {
  /** An array of 32-bit [[ColorDef]] values in `tbgr` format, indexed by [[indices]]. */
  public readonly colors: Uint32Array;
  /** For each vertex, an index into [[colors]] indicating the color of that vertex. */
  public readonly indices: Uint16Array;
  /** If `true`, indicates none of the [[colors]] have a transparency greater than zero; otherwise, all of
   * the colors have a transparency greater than zero.
   */
  public readonly isOpaque: boolean;

  /** Constructor.
   * @param colors See [[colors]].
   * @param indices See [[indices]]
   * @param hasAlpha `true` if all `colors` have a transparency greater than zero, or `false` if they all have a transparency of zero.
   */
  public constructor(colors: Uint32Array, indices: number[], hasAlpha: boolean) {
    this.colors = new Uint32Array(colors.buffer);
    this.indices = Uint16Array.from(indices);
    this.isOpaque = !hasAlpha;
  }
}

/** Describes the color(s) of the vertices of a [MeshArgs]($frontend) or [PolylineArgs]($frontend).
 * This may be a uniform color to be applied to every vertex, or a table specifying individual per-vertex colors.
 * @public
 */
export class ColorIndex {
  private _color: ColorDef | NonUniformColor;

  /** Whether the color(s) in this index have transparency. */
  public get hasAlpha() { return !this._color.isOpaque; }
  /** Whether this index specifies a single uniform color for the entire mesh or polyline. */
  public get isUniform() { return this._color instanceof ColorDef; }
  /** The number of colors in this index. */
  public get numColors(): number { return this.isUniform ? 1 : this.nonUniform!.colors.length; }

  /** Construct a default index specifying a uniform white color. */
  public constructor() { this._color = ColorDef.white; }

  /** Reset this index to specify a uniform white color. */
  public reset() { this._color = ColorDef.white; }

  /** Returns the single color to be applied to all vertices, if [[isUniform]] is `true`; or `undefined` otherwise. */
  public get uniform(): ColorDef | undefined {
    return this.isUniform ? this._color as ColorDef : undefined;
  }

  /** Set the specified color to be applied to all vertices. */
  public initUniform(color: ColorDef | number) {
    this._color = typeof color === "number" ? ColorDef.fromJSON(color) : color;
  }

  /** Returns the per-vertex colors, if [[isUniform]] is `false`; or `undefined` otherwise. */
  public get nonUniform(): NonUniformColor | undefined {
    return !this.isUniform ? this._color as NonUniformColor : undefined;
  }

  /** Set the per-vertex colors.
   * @param colors See [[NonUniformColor.colors]].
   * @param indices See [[NonUniformColor.indices]].
   * @param hasAlpha `true` if all `colors` have a transparency greater than zero, or `false` if they all have a transparency of zero.
   */
  public initNonUniform(colors: Uint32Array, indices: number[], hasAlpha: boolean) {
    this._color = new NonUniformColor(colors, indices, hasAlpha);
  }
}

/** Describes the type of a [[FeatureIndex]].
 * @public
 */
export enum FeatureIndexType {
  /** Indicates that the index contains no features. */
  Empty,
  /** Indicates that the index contains exactly one feature. */
  Uniform,
  /** Indicates that the index contains more than one feature. */
  NonUniform,
}

/** Describes the set of [[Feature]]s associated with a [MeshArgs]($frontend) or [PolylineArgs]($frontend).
 * The mesh or polyline may have zero or one features; or, individual vertices may be associated with different features.
 * The features are expressed as unsigned 32-bit integer Ids of [[Feature]]s within a [[FeatureTable]].
 * @public
 */
export class FeatureIndex {
  /** Describes the quantity (zero, one, or more than one) of features in this index. */
  public type: FeatureIndexType = FeatureIndexType.Empty;

  /** If [[type]] is [[FeatureIndexType.Uniform]], the Id of the single feature. */
  public featureID: number = 0;
  /** If [[type]] is [[FeatureIndexType.NonUniform]], the per-vertex feature Ids, indexed by the mesh or polyline's vertex indices. */
  public featureIDs?: Uint32Array;

  /** True if [[type]] is [[FeatureIndexType.Uniform]]. */
  public get isUniform(): boolean { return FeatureIndexType.Uniform === this.type; }

  /** True if [[type]] is [[FeatureIndexType.Empty]]. */
  public get isEmpty(): boolean { return FeatureIndexType.Empty === this.type; }

  /** Reset to an empty index. */
  public reset(): void {
    this.type = FeatureIndexType.Empty;
    this.featureID = 0;
    this.featureIDs = undefined;
  }
}
