/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { Matrix3d, Point2d, Point3d, Range3d, Transform, Vector2d, XAndY, XYAndZ } from "@itwin/core-geometry";
import {
  ColorDef, ColorIndex, Feature, FeatureIndex, FeatureTable, FillFlags, PackedFeatureTable, QParams3d, QPoint3dList, RenderTexture,
} from "@itwin/core-common";
import { Viewport } from "../Viewport";
import { RenderGraphic } from "./RenderGraphic";
import { GraphicBranch } from "./GraphicBranch";
import { DisplayParams } from "../common/internal/render/DisplayParams";
import { MeshParams } from "../common/internal/render/MeshParams";
import { createMeshParams } from "../common/internal/render/VertexTableBuilder";
import { IModelApp } from "../IModelApp";
import { MeshArgs } from "./MeshArgs";

/** Parameters used to construct a [[ParticleCollectionBuilder]].
 * @public
 * @extensions
 */
export interface ParticleCollectionBuilderParams {
  /** The image mapped to each particle quad.
   * @note The texture should be disposed of when no longer needed to free up WebGL resources. For example, if a [[Decorator]] creates the texture, the
   * texture should probably be disposed of when the decorator is removed from the [[ViewManager]].
   */
  texture: RenderTexture;

  /** The default extents of the particle quad. Individual particles may apply a scale to these extents to produce particles of varying dimensions.
   * Must be positive.
   */
  size: XAndY | number;

  /** The initial transparency of the particles as an integer in [0,255]. Defaults to zero if omitted. */
  transparency?: number;

  /** The origin of the particle collection in world coordinates. Defaults to (0, 0, 0). */
  origin?: XYAndZ;

  /** If the particles are to be pickable, a unique identifier to associate with the resultant [[RenderGraphic]].
   * @see [[IModelConnection.transientIdSequence]] to obtain an Id that is unique within an iModel.
   */
  pickableId?: Id64String;

  /** The viewport in which the particles will be drawn. */
  viewport: Viewport;

  /** If true, the finished graphic will be defined in view coordinates, for use as a decoration of type [[GraphicType.ViewBackground]] or [[GraphicType.ViewOverlay]].
   * Defaults to false, indicating the graphic will be defined in world coordinates.
   * @see [[CoordSystem.View]] and [[CoordSystem.World]].
   */
  isViewCoords?: boolean;
}

/** Describes a particle to to add to a particle collection via [[ParticleCollectionBuilder.addParticle]].
 * The x, y, and z coordinates represent the centroid of the particle quad in the collection's coordinate space.
 * @public
 * @extensions
 */
export interface ParticleProps extends XYAndZ {
  /** The size of the particle, in the collection's coordinate space. If omitted, it defaults to the size supplied to the collection by [[ParticleCollectionBuilderParams.size]].
   * Supplying a `number` produces a square; supplying a non-uniform `XAndY` produces a rectangle. Must be positive.
   */
  size?: XAndY | number;

  /** The transparency with which to draw the particle as an integer in [0,255]. If omitted, it defaults to the current value of [[ParticleCollectionBuilder.transparency]]. */
  transparency?: number;

  /** A rotation matrix to orient the particle.  If supplied then the particle will not be automatically oriented towards the camera. */
  rotationMatrix?: Matrix3d;
}

/** Interface for producing a collection of particles suitable for use in particle effects.
 * Particle effects involve animating hundreds or thousands of small particles to simulate phenomena like smoke, fire, snow, etc.
 * A particle collection represents each particle as a quad (rectangle) displaying an image. The position of each particle corresponds to the
 * centroid of its quad. The transparency and size of each particle can be specified individually. By default, the quads will always rotate to face the camera
 * such that the image is fully visible.
 *
 * Creating a particle collection using a ParticleCollectionBuilder is far more efficient (in both CPU and GPU usage) than doing so using a [[GraphicBuilder]].
 * @see interactive demonstrations of [Snow and Rain](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=snow-rain-sample&imodel=Villa) and
   * [Fire and Smoke](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=fire-sample&imodel=Villa) particle effects.
 * @see [SnowEffect]($frontend-devtools) for an example of a particle effect.
 * @public
 * @extensions
 */
export interface ParticleCollectionBuilder {
  /** The default transparency for newly-added particles as an integer in [0,255], used by [[ParticleCollectionBuilder.addParticle]] if [[ParticleProps.transparency]] is omitted.
   * Changing this value has no effect on the transparency of previously-added particles.
   */
  transparency: number;

  /** The default size of each particle, used by [[ParticleCollectionBuilder.addParticle]] if [[ParticleProps.size]] is omitted. */
  size: XAndY;

  /** Add a particle to the collection.
   * If `size` is omitted, `this.size` is used.
   * If `transparency` is omitted, `this.transparency` is used.
   * @throws Error if particle size is defined and not greater than zero.
   */
  addParticle: (particle: ParticleProps) => void;

  /** Produces a finished graphic from the accumulated particles.
   * It returns the finished graphic, or `undefined` if the collection contains no particles or the [[RenderSystem]] failed to produce the graphic.
   * @note After this method returns, the particle collection is empty.
   */
  finish: () => RenderGraphic | undefined;
}

/**
 * @public
 * @extensions
 */
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
  public readonly rotationMatrix?: Matrix3d;

  public constructor(centroid: XYAndZ, width: number, height: number, transparency: number, rotationMatrix?: Matrix3d) {
    this.centroid = Point3d.fromJSON(centroid);
    this.transparency = transparency;
    this.width = width;
    this.height = height;
    this.rotationMatrix = rotationMatrix;
  }
}

class Builder implements ParticleCollectionBuilder {
  private readonly _viewport: Viewport;
  private readonly _isViewCoords: boolean;
  private readonly _pickableId?: Id64String;
  private readonly _texture: RenderTexture;
  private readonly _size: Vector2d;
  private _transparency: number;
  private _hasVaryingTransparency = false;
  private readonly _localToWorldTransform: Transform;
  private readonly _range = Range3d.createNull();
  private _particlesOpaque: Particle[] = [];
  private _particlesTranslucent: Particle[] = [];

  public constructor(params: ParticleCollectionBuilderParams) {
    this._viewport = params.viewport;
    this._isViewCoords = true === params.isViewCoords;
    this._pickableId = params.pickableId;
    this._texture = params.texture;
    this._transparency = undefined !== params.transparency ? clampTransparency(params.transparency) : 0;
    this._localToWorldTransform = params.origin ? Transform.createTranslationXYZ(params.origin.x, params.origin.y, params.origin.z) : Transform.createIdentity();

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
      this._hasVaryingTransparency = this._particlesTranslucent.length > 0;
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
    if (transparency !== this.transparency && this._particlesTranslucent.length > 0)
      this._hasVaryingTransparency = true;

    const particle = new Particle(props, width, height, transparency, props.rotationMatrix);
    if (transparency > 0)
      this._particlesTranslucent.push(particle);
    else
      this._particlesOpaque.push(particle);
    this._range.extendPoint(particle.centroid);
  }

  public finish(): RenderGraphic | undefined {
    if (0 === this._particlesTranslucent.length + this._particlesOpaque.length)
      return undefined;

    // Order-independent transparency doesn't work well with opaque geometry - it will look semi-transparent.
    // If we have a mix of opaque and transparent particles, put them in separate graphics to be rendered in separate passes.
    const opaque = this.createGraphic(this._particlesOpaque, 0);
    const transparent = this.createGraphic(this._particlesTranslucent, this._hasVaryingTransparency ? undefined : this._transparency);

    // Empty the collection before any return statements.
    const range = this._range.clone();
    this._range.setNull();
    this._particlesOpaque.length = 0;
    this._particlesTranslucent.length = 0;
    this._hasVaryingTransparency = false;

    if (!transparent && !opaque)
      return undefined;

    // Transform from origin to collection, then to world.
    const toCollection = Transform.createTranslation(range.center);
    const toWorld = toCollection.multiplyTransformTransform(this._localToWorldTransform);
    const branch = new GraphicBranch(true);
    if (opaque)
      branch.add(opaque);

    if (transparent)
      branch.add(transparent);

    let graphic = this._viewport.target.renderSystem.createGraphicBranch(branch, toWorld);

    // If we have a pickable Id, produce a batch.
    // NB: We pass this._pickableId as the FeatureTable's modelId so that it will be treated like a reality model or a map -
    // specifically, it can be located and display a tooltip, but can't be selected.
    const featureTable = this._pickableId ? new FeatureTable(1, this._pickableId) : undefined;
    if (featureTable) {
      this._localToWorldTransform.multiplyRange(range, range);
      featureTable.insert(new Feature(this._pickableId));
      graphic = this._viewport.target.renderSystem.createBatch(graphic, PackedFeatureTable.pack(featureTable), range);
    }

    return graphic;
  }

  private createGraphic(particles: Particle[], uniformTransparency: number | undefined): RenderGraphic | undefined {
    const numParticles = particles.length;
    if (numParticles <= 0)
      return undefined;

    // To keep scale values close to 1, compute mean size to use as size of quad.
    const meanSize = new Vector2d();
    let maxSize = 0;
    for (const particle of particles) {
      meanSize.x += particle.width;
      meanSize.y += particle.height;
      if (particle.width > maxSize)
        maxSize = particle.width;
      if (particle.height > maxSize)
        maxSize = particle.height;
    }
    meanSize.x /= numParticles;
    meanSize.y /= numParticles;

    // Define InstancedGraphicParams for particles.
    const rangeCenter = this._range.center;
    const floatsPerTransform = 12;
    const transforms = new Float32Array(floatsPerTransform * numParticles);
    const bytesPerOverride = 8;
    const symbologyOverrides = undefined === uniformTransparency ? new Uint8Array(bytesPerOverride * numParticles) : undefined;

    const viewToWorld = this._viewport.view.getRotation().transpose();
    let tfIndex = 0;
    let ovrIndex = 0;
    for (const particle of particles) {
      const scaleX = particle.width / meanSize.x;
      const scaleY = particle.height / meanSize.y;
      if (this._isViewCoords) {
        // Particles already face the camera in view coords - just apply the scale.
        transforms[tfIndex + 0] = scaleX;
        transforms[tfIndex + 5] = scaleY;
        transforms[tfIndex + 10] = 1;
      } else if (undefined !== particle.rotationMatrix) {
        // Scale rotation matrix relative to size of quad.
        transforms[tfIndex + 0] = particle.rotationMatrix.coffs[0] * scaleX;
        transforms[tfIndex + 1] = particle.rotationMatrix.coffs[1] * scaleY;
        transforms[tfIndex + 2] = particle.rotationMatrix.coffs[2];
        transforms[tfIndex + 4] = particle.rotationMatrix.coffs[3] * scaleX;
        transforms[tfIndex + 5] = particle.rotationMatrix.coffs[4] * scaleY;
        transforms[tfIndex + 6] = particle.rotationMatrix.coffs[5];
        transforms[tfIndex + 8] = particle.rotationMatrix.coffs[6] * scaleX;
        transforms[tfIndex + 9] = particle.rotationMatrix.coffs[7] * scaleY;
        transforms[tfIndex + 10] = particle.rotationMatrix.coffs[8];
      } else {
        // Rotate about origin by inverse view matrix so quads always face the camera and scale relative to size of quad.
        transforms[tfIndex + 0] = viewToWorld.coffs[0] * scaleX;
        transforms[tfIndex + 1] = viewToWorld.coffs[1] * scaleY;
        transforms[tfIndex + 2] = viewToWorld.coffs[2];
        transforms[tfIndex + 4] = viewToWorld.coffs[3] * scaleX;
        transforms[tfIndex + 5] = viewToWorld.coffs[4] * scaleY;
        transforms[tfIndex + 6] = viewToWorld.coffs[5];
        transforms[tfIndex + 8] = viewToWorld.coffs[6] * scaleX;
        transforms[tfIndex + 9] = viewToWorld.coffs[7] * scaleY;
        transforms[tfIndex + 10] = viewToWorld.coffs[8];
      }

      // Translate relative to center of particles range.
      transforms[tfIndex + 3] = particle.centroid.x - rangeCenter.x;
      transforms[tfIndex + 7] = particle.centroid.y - rangeCenter.y;
      transforms[tfIndex + 11] = particle.centroid.z - rangeCenter.z;

      tfIndex += floatsPerTransform;

      if (symbologyOverrides) {
        // See FeatureOverrides.buildLookupTable() for layout.
        symbologyOverrides[ovrIndex + 0] = 1 << 2; // OvrFlags.Alpha
        symbologyOverrides[ovrIndex + 7] = 0xff - particle.transparency;

        ovrIndex += bytesPerOverride;
      }
    }

    // Produce instanced quads.
    // Note: We do not need to allocate an array of featureIds. If we have a pickableId, all particles refer to the same Feature, with index 0.
    // So we leave the vertex attribute disabled causing the shader to receive the default (0, 0, 0) which happens to correspond to our feature index.
    const quad = createQuad(meanSize, this._texture, uniformTransparency ?? 0x7f, this._viewport);
    const transformCenter = new Point3d(0, 0, 0);
    const range = computeRange(this._range, rangeCenter, maxSize);
    const instances = { count: numParticles, transforms, transformCenter, symbologyOverrides, range };
    return this._viewport.target.renderSystem.createMesh(quad, instances);
  }
}

function createQuad(size: XAndY, texture: RenderTexture, transparency: number, viewport: Viewport): MeshParams {
  const halfWidth = size.x / 2;
  const halfHeight = size.y / 2;
  const corners = [
    new Point3d(-halfWidth, -halfHeight, 0), new Point3d(halfWidth, -halfHeight, 0),
    new Point3d(-halfWidth, halfHeight, 0), new Point3d(halfWidth, halfHeight, 0),
  ];

  const range = new Range3d();
  range.low = corners[0];
  range.high = corners[3];

  const points = new QPoint3dList(QParams3d.fromRange(range));
  for (const corner of corners)
    points.add(corner);

  const colors = new ColorIndex();
  colors.initUniform(ColorDef.white.withTransparency(transparency));

  const quadArgs: MeshArgs = {
    points,
    vertIndices: [0, 1, 2, 2, 1, 3],
    fillFlags: FillFlags.None,
    isPlanar: true,
    colors,
    features: new FeatureIndex(),
    textureMapping: {
      texture,
      uvParams: [new Point2d(0, 1), new Point2d(1, 1), new Point2d(0, 0), new Point2d(1, 0)],
    },
  };

  return createMeshParams(quadArgs, viewport.target.renderSystem.maxTextureSize, "non-indexed" !== IModelApp.tileAdmin.edgeOptions.type);
}

function clampTransparency(transparency: number): number {
  transparency = Math.min(255, transparency, Math.max(0, transparency));
  transparency = Math.floor(transparency);
  if (transparency < DisplayParams.minTransparency)
    transparency = 0;

  return transparency;
}

function computeRange(centroidRange: Range3d, center: Point3d, maxSize: number): Range3d {
  const range2 = centroidRange.clone();
  range2.low.subtractInPlace(center);
  range2.high.subtractInPlace(center);
  const halfSize = maxSize * 0.5;
  range2.low.x -= halfSize;
  range2.low.y -= halfSize;
  range2.low.z -= halfSize;
  range2.high.x += halfSize;
  range2.high.y += halfSize;
  range2.high.z += halfSize;
  return range2;
}
