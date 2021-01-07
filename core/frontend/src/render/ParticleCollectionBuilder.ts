/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Transform, XY, XYAndZ } from "@bentley/geometry-core";
import { RenderTexture } from "@bentley/imodeljs-common";
import { RenderGraphic } from "./RenderGraphic";
import { RenderSystem } from "./RenderSystem";
import { IModelApp } from "../IModelApp";

/** Parameters used to construct a [[ParticleCollectionBuilder]].
 * @beta
 */
export interface ParticleCollectionBuilderParams {
  /** The image mapped to each particle quad.
   * @note ###TODO ownership and disposal of this texture.
   */
  texture: RenderTexture;
  /** The default extents of the particle quad. Individual particles may apply a scale to these extents to produce particles of varying dimensions. */
  size: XY | number;
  /** The initial transparency of the particles. Defaults to zero if omitted. */
  transparency?: number;
  /** Optional transform from the coordinate space of the particle collection to world coordinates. Defaults to identity. */
  localToWorldTransform?: Transform;
}

/** Describes a particle to to add to a particle collection via [[ParticleCollectionBuilder.addParticle]].
 * The x, y, and z coordinates represent the centroid of the particle quad in the collection's coordinate space.
 * @beta
 */
export interface ParticleProps extends XYAndZ {
  /** The size of the particle, in the collection's coordinate space. If omitted, it defaults to the size supplied to the collection by [[ParticleCollectionBuilderParams.size]].
   * Supplying a `number` produces a square; supplying a non-uniform `XY` produces a rectangle.
   */
  size?: XY | number;
  /** The transparency with which to draw the particle. If omitted, it defaults to the current value of [[ParticleCollectionBuilder.transparency]]. */
  transparency?: number;
}

/** Interface for producing a collection of particles suitable for use in particle effects.
 * Particle effects involve animating hundreds or thousands of small particles to simulate phenomena like smoke, fire, snow, etc.
 * A particle collection represents each particle as a quad (rectangle) displaying an image. The position of each particle corresponds to the
 * centroid of its quad. The transparency and size of each particle can be specified individually. By default, the quads will always rotate to face the camera
 * such that the image is fully visible.
 *
 * Creating a particle collection using a ParticleCollectionBuilder is far more efficient (in both CPU and GPU usage) than doing so using a [[GraphicBuilder]].
 * @see [SnowEffect]($frontend-devtools) and [FireEffect]($frontend-devtools) for examples of particle effects.
 * @beta
 */
export interface ParticleCollectionBuilder {
  /** The default transparency for newly-added particles, used by [[addParticle]] if [[ParticleProps.transparency]] is omitted.
   * Changing this value has no effect on the transparency of previously-added particles.
   */
  transparency: number;

  /** The default size of each particle, used by [[addParticle]] if [[ParticleProps.size]] is omitted. */
  size: XY;

  /** Add a particle to the collection.
   * If `size` is omitted, `this.size` is used.
   * If `transparency` is omitted, `this.transparency` is used.
   */
  addParticle: (particle: ParticleProps) => void;

  /** Produces a finished graphic from the accumulated particles.
   * @param renderSystem The render system that will create the finished graphic. Defaults to [[IModelApp.renderSystem]].
   * @returns The finished graphic, or `undefined` if the collection contains no particles or the [[RenderSystem]] failed to produce the graphic.
   */
  finish: (renderSystem?: RenderSystem) => RenderGraphic | undefined;
}

// /** @beta */
// export namespace ParticleCollectionBuilder {
//   /** Creates a new ParticleCollectionBuilder. */
//   export function create(params: ParticleCollectionBuilderParams): ParticleCollectionBuilder {
//     return new Builder(params);
//   }
// }
