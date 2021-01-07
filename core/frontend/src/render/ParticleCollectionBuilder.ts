/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Point2d, Point3d, Range3d, Transform, TransformProps, Vector2d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { QParams3d, QPoint3dList, RenderTexture } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { RenderGraphic } from "./RenderGraphic";
import { GraphicBranch } from "./GraphicBranch";
import { RenderSystem } from "./RenderSystem";
import { MeshParams} from "./primitives/VertexTable";
import { MeshArgs } from "./primitives/mesh/MeshPrimitives";

/** Parameters used to construct a [[ParticleCollectionBuilder]].
 * @beta
 */
export interface ParticleCollectionBuilderParams {
  /** The image mapped to each particle quad.
   * @note ###TODO ownership and disposal of this texture.
   */
  texture: RenderTexture;
  /** The default extents of the particle quad. Individual particles may apply a scale to these extents to produce particles of varying dimensions. */
  size: XAndY | number;
  /** The initial transparency of the particles as an integer in [0,255]. Defaults to zero if omitted. */
  transparency?: number;
  /** Optional transform from the coordinate space of the particle collection to world coordinates. Defaults to identity. */
  localToWorldTransform?: TransformProps;
  /** If the particles are to be pickable, a unique identifier to associate with the resultant [[RenderGraphic]].
   * @see [[IModelConnection.transientIdSequence]] to obtain an Id that is unique within an iModel.
   */
  pickableId?: Id64String;
}

/** Describes a particle to to add to a particle collection via [[ParticleCollectionBuilder.addParticle]].
 * The x, y, and z coordinates represent the centroid of the particle quad in the collection's coordinate space.
 * @beta
 */
export interface ParticleProps extends XYAndZ {
  /** The size of the particle, in the collection's coordinate space. If omitted, it defaults to the size supplied to the collection by [[ParticleCollectionBuilderParams.size]].
   * Supplying a `number` produces a square; supplying a non-uniform `XAndY` produces a rectangle.
   */
  size?: XAndY | number;
  /** The transparency with which to draw the particle as an integer in [0,255]. If omitted, it defaults to the current value of [[ParticleCollectionBuilder.transparency]]. */
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
  /** The default transparency for newly-added particles as an integer in [0,255], used by [[addParticle]] if [[ParticleProps.transparency]] is omitted.
   * Changing this value has no effect on the transparency of previously-added particles.
   */
  transparency: number;

  /** The default size of each particle, used by [[addParticle]] if [[ParticleProps.size]] is omitted. */
  size: XAndY;

  /** Add a particle to the collection.
   * If `size` is omitted, `this.size` is used.
   * If `transparency` is omitted, `this.transparency` is used.
   * @throws Error if particle size is defined and not greater than zero.
   */
  addParticle: (particle: ParticleProps) => void;

  /** Produces a finished graphic from the accumulated particles.
   * @param renderSystem The render system that will create the finished graphic. Defaults to [[IModelApp.renderSystem]].
   * @returns The finished graphic, or `undefined` if the collection contains no particles or the [[RenderSystem]] failed to produce the graphic.
   * @note After this method returns, the particle collection is empty.
   */
  finish: (renderSystem?: RenderSystem) => RenderGraphic | undefined;
}

/** @beta */
export namespace ParticleCollectionBuilder {
  /** Creates a new ParticleCollectionBuilder.
   * @throws Error if size is not greater than zero.
   */
  export function create(params: ParticleCollectionBuilderParams): ParticleCollectionBuilder {
    return new Builder(params);
  }
}

class Particle {
  public readonly centroid: Point3d;
  public readonly transparency: number;
  public readonly width: number;
  public readonly height: number;

  public constructor(centroid: XYAndZ, width: number, height: number, transparency: number) {
    this.centroid = Point3d.fromJSON(centroid);
    this.transparency = transparency;
    this.width = width;
    this.height = height;
  }
}

class Builder implements ParticleCollectionBuilder {
  private readonly _pickableId?: Id64String;
  private readonly _texture: RenderTexture;
  private readonly _size: Vector2d;
  private _transparency: number;
  private _hasVaryingTransparency = false;
  private readonly _localToWorldTransform: Transform;
  private readonly _range = Range3d.createNull();
  private readonly _particles: Particle[] = [];

  public constructor(params: ParticleCollectionBuilderParams) {
    this._pickableId = params.pickableId;
    this._texture = params.texture;
    this._transparency = undefined !== params.transparency ? clampTransparency(params.transparency) : 0;
    this._localToWorldTransform = Transform.fromJSON(params.localToWorldTransform);

    if ("number" === typeof params.size)
      this._size = new Vector2d(params.size, params.size);
    else
      this._size = Vector2d.fromJSON(params.size);

    if (this._size.x <= 0 || this._size.y <= 0)
      throw new Error("Particle size must be greater than zero");
  }

  public get size(): XAndY {
    return this._size;
  }

  public get transparency() {
    return this._transparency;
  }

  public set transparency(transparency: number) {
    transparency = clampTransparency(transparency);
    if (transparency !== this._transparency) {
      this._transparency = transparency;
      this._hasVaryingTransparency = this._particles.length > 0;
    }
  }

  public addParticle(props: ParticleProps): void {
    const size = props.size ?? this._size;
    let width, height;
    if ("number" === typeof size) {
      width = height = size;
    } else {
      width = size.x;
      height = size.y;
    }

    if (width <= 0 || height <= 0)
      throw new Error("A particle must have a size greater than zero");

    const transparency = undefined !== props.transparency ? clampTransparency(props.transparency) : this.transparency;
    if (transparency !== this.transparency && this._particles.length > 0)
      this._hasVaryingTransparency = true;

    const particle = new Particle(props, width, height, transparency);
    this._particles.push(particle);
    this._range.extendPoint(particle.centroid);
  }

  public finish(system?: RenderSystem): RenderGraphic | undefined {
    if (0 === this._particles.length)
      return undefined;

    // To keep scale values close to 1, compute mean size to use as size of quad.
    const numParticles = this._particles.length;
    let meanSize = new Vector2d();
    for (const particle of this._particles) {
      meanSize.x += particle.width / numParticles;
      meanSize.y += particle.height / numParticles;
    }

    // Define InstancedGraphicParams for particles.
    const transformCenter = this._range.center;
    const floatsPerTransform = 12;
    const transforms = new Float32Array(floatsPerTransform * numParticles);
    const bytesPerOverride = 8;
    const symbologyOverrides = this._hasVaryingTransparency ? new Uint8Array(bytesPerOverride * numParticles) : undefined;
    for (let i = 0; i < numParticles; i++) {
      const particle = this._particles[i];
      const tfIndex = i * floatsPerTransform;

      // Scale relative to size of quad.
      transforms[tfIndex + 0] = particle.width / meanSize.x;
      transforms[tfIndex + 5] = particle.height / meanSize.y;
      transforms[tfIndex + 10] = 1;

      // Translation relative to center of particles range.
      transforms[tfIndex + 3] = particle.centroid.x - transformCenter.x;
      transforms[tfIndex + 7] = particle.centroid.y - transformCenter.y;

      if (symbologyOverrides) {
        // See FeatureOverrides.buildLookupTable() for layout.
        const ovrIndex = bytesPerOverride * numParticles;
        symbologyOverrides[ovrIndex + 0] = 1 << 2; // OvrFlags.Alpha
        symbologyOverrides[ovrIndex + 7] = particle.transparency;
      }
    }

    // Empty the collection.
    this._particles.length = 0;
    this._hasVaryingTransparency = false;
    this._range.setNull();

    // Produce instanced quads.
    // ###TODO handle pickableId
    system = system ?? IModelApp.renderSystem;
    const quad = this.createQuad(meanSize);
    const instances = { count: numParticles, transforms, transformCenter, symbologyOverrides };
    let graphic = system.createMesh(quad,instances);
    if (!graphic)
      return undefined;

    // Transform from origin to collection, then to world.
    const toCollection = Transform.createTranslation(transformCenter);
    const toWorld = toCollection.multiplyTransformTransform(this._localToWorldTransform);
    const branch = new GraphicBranch(true);
    branch.add(graphic);
    return system.createGraphicBranch(branch, toWorld);
  }

  private createQuad(size: XAndY): MeshParams {
    const halfWidth = size.x / 2;
    const halfHeight = size.y / 2;
    const corners = [
      new Point3d(-halfWidth, -halfHeight, 0), new Point3d(halfWidth, -halfHeight, 0),
      new Point3d(-halfWidth, halfHeight, 0), new Point3d(halfWidth,halfHeight, 0),
    ];

    const quadArgs = new MeshArgs();
    const range = new Range3d();
    range.low = corners[0];
    range.high = corners[3];
    quadArgs.points = new QPoint3dList(QParams3d.fromRange(range));
    for (const corner of corners)
      quadArgs.points.add(corner);

    quadArgs.vertIndices = [0, 1, 2, 2, 1, 3];
    quadArgs.textureUv = [ new Point2d(0, 0), new Point2d(1, 0), new Point2d(0, 1), new Point2d(1, 1) ];
    quadArgs.texture = this._texture;
    quadArgs.isPlanar = true;

    return MeshParams.create(quadArgs);
  }
}

function clampTransparency(transparency: number): number {
  transparency = Math.min(255, transparency, Math.max(0, transparency));
  return Math.floor(transparency);
}
