/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { base64StringToUint8Array, Id64String, IDisposable } from "@itwin/core-bentley";
import {
  ColorDef, ColorIndex, ElementAlignedBox3d, FeatureIndex, FeatureIndexType, FillFlags, Frustum, Gradient, ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat,
  isValidImageSourceFormat, PackedFeatureTable, QParams3d, QPoint3dList, RenderFeatureTable, RenderMaterial, RenderTexture, SkyGradient, TextureProps, TextureTransparency,
} from "@itwin/core-common";
import { ClipVector, Matrix3d, Point2d, Point3d, Range2d, Range3d, Transform, Vector2d, XAndY, XYAndZ } from "@itwin/core-geometry";
import { WebGLExtensionName } from "@itwin/webgl-compatibility";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createGraphicFromDescription, createGraphicTemplateFromDescription, MapTileTreeReference, TileTreeReference } from "../tile/internal";
import { ToolAdmin } from "../tools/ToolAdmin";
import { SceneContext } from "../ViewContext";
import { Viewport } from "../Viewport";
import { imageElementFromImageSource, tryImageElementFromUrl } from "../common/ImageUtil";
import { MeshParams } from "../common/internal/render/MeshParams";
import { createPointStringParams, PointStringParams } from "../common/internal/render/PointStringParams";
import { createPolylineParams, PolylineParams } from "../common/internal/render/PolylineParams";
import { TextureCacheKey } from "../common/render/TextureParams";
import { ViewRect } from "../common/ViewRect";
import { GraphicBranch, GraphicBranchOptions } from "./GraphicBranch";
import { CustomGraphicBuilderOptions, GraphicBuilder, ViewportGraphicBuilderOptions } from "./GraphicBuilder";
import { InstancedGraphicParams, PatternGraphicParams } from "../common/render/InstancedGraphicParams";
import { Mesh } from "../common/internal/render/MeshPrimitives";
import { RealityMeshGraphicParams } from "./RealityMeshGraphicParams";
import { RealityMeshParams } from "./RealityMeshParams";
import { PointCloudArgs } from "../common/internal/render/PointCloudPrimitive";
import { RenderClipVolume } from "./RenderClipVolume";
import { RenderGraphic, RenderGraphicOwner } from "./RenderGraphic";
import { CreateRenderMaterialArgs } from "./CreateRenderMaterialArgs";
import { RenderMemory } from "./RenderMemory";
import { RenderPlanarClassifier } from "./RenderPlanarClassifier";
import { RenderTarget } from "./RenderTarget";
import { CreateTextureArgs, CreateTextureFromSourceArgs } from "./CreateTextureArgs";
import { ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams } from "./ScreenSpaceEffectBuilder";
import { createMeshParams } from "../common/internal/render/VertexTableBuilder";
import { GraphicType } from "../common/render/GraphicType";
import { BatchOptions } from "../common/render/BatchOptions";
import { GraphicDescription } from "../common/render/GraphicDescriptionBuilder";
import { GraphicDescriptionContextPropsImpl, WorkerGraphicDescriptionContextPropsImpl } from "../common/internal/render/GraphicDescriptionContextImpl";
import { _featureTable, _implementationProhibited, _renderSystem, _textures, _transformCenter, _transforms } from "../common/internal/Symbols";
import { GraphicDescriptionContext, GraphicDescriptionContextProps, WorkerGraphicDescriptionContextProps } from "../common/render/GraphicDescriptionContext";
import { MeshArgs } from "./MeshArgs";
import { PolylineArgs } from "./PolylineArgs";
import { RenderGeometry } from "../internal/render/RenderGeometry";
import { RenderInstancesParams } from "../common/render/RenderInstancesParams";
import { GraphicTemplate } from "./GraphicTemplate";

// cSpell:ignore deserializing subcat uninstanced wiremesh qorigin trimesh

/** An opaque representation of a texture draped on geometry within a [[Viewport]].
 * @internal
 */
export abstract class RenderTextureDrape implements IDisposable {
  public abstract dispose(): void;

  /** @internal */
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
  public abstract collectGraphics(context: SceneContext): void;
}

/** @internal */
export type TextureDrapeMap = Map<Id64String, RenderTextureDrape>;

/** @internal */
export type MapLayerClassifiers = Map<number, RenderPlanarClassifier>;

/** Describes a texture loaded from an HTMLImageElement
 * ###TODO Replace with TextureImage from RenderTexture.ts after we start returning transparency info from the backend.
 * @internal
 */
export interface OldTextureImage {
  /** The HTMLImageElement containing the texture's image data */
  image: HTMLImageElement;
  /** The format of the texture's image data */
  format: ImageSourceFormat;
}

/** @internal */
export enum RenderDiagnostics {
  /** No diagnostics enabled. */
  None = 0,
  /** Debugging output to browser console enabled. */
  DebugOutput = 1 << 1,
  /** Potentially expensive checks of WebGL state enabled. */
  WebGL = 1 << 2,
  /** All diagnostics enabled. */
  All = DebugOutput | WebGL,
}

/** @internal */
export interface GLTimerResult {
  /** Label from GLTimer.beginOperation */
  label: string;
  /** Time elapsed in nanoseconds, inclusive of child result times.
   *  @note no-op queries seem to have 32ns of noise.
   */
  nanoseconds: number;
  /** Child results if GLTimer.beginOperation calls were nested */
  children?: GLTimerResult[];
}

/** @internal */
export type GLTimerResultCallback = (result: GLTimerResult) => void;

/** Default implementation of RenderGraphicOwner. */
class GraphicOwner extends RenderGraphicOwner {
  public constructor(private readonly _graphic: RenderGraphic) { super(); }
  public get graphic(): RenderGraphic { return this._graphic; }
}

/** An interface optionally exposed by a RenderSystem that allows control of various debugging features.
 * @beta
 */
export interface RenderSystemDebugControl {
  /** Destroy this system's webgl context. Returns false if this behavior is not supported. */
  loseContext(): boolean;

  /** Overrides [[RenderSystem.dpiAwareLOD]].
   * @internal
   */
  dpiAwareLOD: boolean;

  /** Record GPU profiling information for each frame drawn. Check isGLTimerSupported before using.
   * @internal
   */
  resultsCallback?: GLTimerResultCallback;

  /** Returns true if the browser supports GPU profiling queries.
   * @internal
   */
  readonly isGLTimerSupported: boolean;

  /** Attempts to compile all shader programs and returns true if all were successful. May throw exceptions on errors.
   * This is useful for debugging shader compilation on specific platforms - especially those which use neither ANGLE nor SwiftShader (e.g., linux, mac, iOS)
   * because our unit tests which also compile all shaders run in software mode and therefore may not catch some "errors" (especially uniforms that have no effect on
   * program output).
   * @internal
   */
  compileAllShaders(): boolean;

  /** Obtain accumulated debug info collected during shader compilation. See `RenderSystem.Options.debugShaders`.
   * @internal
   */
  debugShaderFiles?: DebugShaderFile[];
}

/** @internal */
export abstract class RenderTerrainGeometry implements IDisposable, RenderMemory.Consumer {
  public abstract dispose(): void;
  public abstract get transform(): Transform | undefined;
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
}

/** @internal */
export class TerrainTexture {
  public constructor(
    public readonly texture: RenderTexture,
    public featureId: number,
    public readonly scale: Vector2d,
    public readonly translate: Vector2d,
    public readonly targetRectangle: Range2d,
    public readonly layerIndex: number,
    public transparency: number,
    public readonly clipRectangle?: Range2d,
  ) { }

  public cloneWithClip(clipRectangle: Range2d) {
    return new TerrainTexture (this.texture, this.featureId, this.scale, this.translate, this.targetRectangle, this.layerIndex, this.transparency, clipRectangle);
  }
}
/** @internal */
export class DebugShaderFile {
  public constructor(
    public readonly filename: string,
    public readonly src: string,
    public isVS: boolean,
    public isGL: boolean,
    public isUsed: boolean,
  ) { }
}
/** Transparency settings for planar grid display.
 * @alpha
 */
export class PlanarGridTransparency {
  /** Transparency for the grid plane.   This should generally be fairly high to avoid obscuring other geometry */
  public readonly planeTransparency = .9;
  /** Transparency of the grid lines.  This should be higher than the plane, but less than reference line transparency */
  public readonly lineTransparency = .75;
  /** Transparency of the reference lines.   This should be less than plane or line transparency so that reference lines are more prominent */
  public readonly refTransparency = .5;
}

/** Settings for planar grid display.
 * @alpha
 */
export interface PlanarGridProps {
  /**  The grid origin */
  origin: Point3d;
  /** The grid orientation. The grid X and Y direction are the first and second matrix rows */
  rMatrix: Matrix3d;
  /** The spacing between grid liens in the X and Y direction */
  spacing: XAndY;
  /** Grid lines per reference. If zero no reference lines are displayed. */
  gridsPerRef: number;
  /** Grid color.   [[Use Viewport.getContrastToBackgroundColor]] to get best constrast color based on current background. */
  color: ColorDef;
  /** Transparency settings.  If omitted then the [[PlanarGridTransparency]] defaults are used. */
  transparency?: PlanarGridTransparency;
}

/** An opaque representation of instructions for repeatedly drawing a [[RenderGeometry]] to pattern a planar region, to be supplied to [[RenderSystem.createRenderGraphic]].
 * @internal
 */
export interface RenderAreaPattern extends IDisposable, RenderMemory.Consumer {
  readonly [_implementationProhibited]: "renderAreaPattern";
}

/** Contains the WebGL resources necessary to draw multiple [[Instance]]s of a [[GraphicTemplate]] using [instanced rendering](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html).
 * Use [[RenderSystem.createRenderInstances]] to create one.
 * The instances may be associated with [Feature]($common)s, in which case those features override any defined in the template itself.
 * Example usage:
 * ```ts
 * [[include:Gltf_Instancing]]
 * ```
 * @beta
 */
export interface RenderInstances {
  /** @internal */
  readonly [_implementationProhibited]: "renderInstances";
  /** @internal */
  readonly [_transformCenter]: XYAndZ;
  /** @internal */
  readonly [_transforms]: Float32Array;
  /** @internal */
  readonly [_featureTable]?: PackedFeatureTable;
}

/** @internal */
export interface RenderSkyGradientParams {
  type: "gradient";
  gradient: SkyGradient;
  zOffset: number;
}

/** @internal */
export interface RenderSkySphereParams {
  type: "sphere";
  texture: RenderTexture;
  rotation: number;
  zOffset: number;
}

/** @internal */
export interface RenderSkyCubeParams {
  type: "cube";
  texture: RenderTexture;
}

/** @internal */
export type RenderSkyBoxParams = RenderSkyGradientParams | RenderSkySphereParams | RenderSkyCubeParams;

/** Arguments supplied to [[RenderSystem.createGraphicFromDescription]].
 * @beta
 */
export interface CreateGraphicFromDescriptionArgs {
  /** A description of the [[RenderGraphic]] to create, obtained from a [[GraphicDescriptionBuilder]]. */
  description: GraphicDescription;
  /** The context that was used to create the graphic description, obtained from [[RenderSystem.resolveGraphicDescriptionContext]]. */
  context: GraphicDescriptionContext;
}

/** Arguments supplied to [[RenderSystem.createGraphicFromTemplate]].
 * @beta
 */
export interface CreateGraphicFromTemplateArgs {
  /** Describes how to draw the graphic. */
  template: GraphicTemplate;
  /** Optionally describes how to draw multiple repetitions of the graphic. */
  instances?: RenderInstances;
}

/** A RenderSystem provides access to resources used by the internal WebGL-based rendering system.
 * An application rarely interacts directly with the RenderSystem; instead it interacts with types like [[Viewport]] which
 * coordinate with the RenderSystem on the application's behalf.
 * @see [Display system overview]($docs/learning/display/index.md)
 * @see [[IModelApp.renderSystem]].
 * @public
 * @extensions
 */
export abstract class RenderSystem implements IDisposable {
  /** Options used to initialize the RenderSystem. These are primarily used for feature-gating.
   * This object is frozen and cannot be modified after the RenderSystem is created.
   * @internal
   */
  public readonly options: RenderSystem.Options;

  /** Antialias samples to use on all subsequently created render targets.
   * Default value: undefined (no antialiasing)
   * @beta
   */
  public antialiasSamples?: number;

  /** Initialize the RenderSystem with the specified options.
   * @note The RenderSystem takes ownership of the supplied Options and freezes it.
   * @internal
   */
  protected constructor(options?: RenderSystem.Options) {
    this.options = undefined !== options ? options : {};
    Object.freeze(this.options);
    if (undefined !== this.options.disabledExtensions)
      Object.freeze(this.options.disabledExtensions);
  }

  /** @internal */
  public abstract get isValid(): boolean;

  /** @internal */
  public abstract dispose(): void;

  /** The maximum permitted width or height of a texture supported by this render system. */
  public get maxTextureSize(): number { return 0; }

  /** @internal */
  public get supportsCreateImageBitmap(): boolean { return false; }

  /** @internal */
  public get dpiAwareLOD(): boolean { return true === this.options.dpiAwareLOD; }

  /** @internal */
  public get isMobile(): boolean { return false; }

  /** @internal */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;
  /** @internal */
  public abstract createOffscreenTarget(rect: ViewRect): RenderTarget;

  /** Perform a small unit of idle work and return true if more idle work remains to be done. This function is invoked on each tick of the javascript event loop as long as no viewports are registered with the ViewManager, until it returns false to indicate all idle work has been completed.
   * @internal
   */
  public abstract doIdleWork(): boolean;

  /** Find a previously-created [RenderMaterial]($common) by its ID.
   * @param _key The unique ID of the material within the context of the IModelConnection. Typically an element ID.
   * @param _imodel The IModelConnection with which the material is associated.
   * @returns A previously-created material matching the specified ID, or undefined if no such material exists.
   */
  public findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a [RenderMaterial]($common) from parameters
   * If the parameters include a non-empty key, and no previously-created material already exists with that key, the newly-created material will be cached on the IModelConnection such
   * that it can later be retrieved by the same key using [[RenderSystem.findMaterial]].
   * @param _params A description of the material's properties.
   * @param _imodel The IModelConnection associated with the material.
   * @returns the newly-created material, or undefined if the material could not be created or if a material with the same key as that specified in the params already exists.
   * @deprecated in 3.x. Use [[createRenderMaterial]].
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a [RenderMaterial]($common).
   * @see [[CreateRenderMaterialArgs]] for a description of the material parameters.
   */
  public createRenderMaterial(_args: CreateRenderMaterialArgs): RenderMaterial | undefined {
    return undefined;
  }

  /** Creates a [[GraphicBuilder]] for creating a [[RenderGraphic]].
   * @param placement The local-to-world transform in which the builder's geometry is to be defined.
   * @param type The type of builder to create.
   * @param viewport The viewport in which the resultant [[RenderGraphic]] will be rendered.
   * @param pickableId If the decoration is to be pickable, a unique identifier to associate with the resultant [[RenderGraphic]].
   * @returns A builder for creating a [[RenderGraphic]] of the specified type appropriate for rendering within the specified viewport.
   * @see [[IModelConnection.transientIds]] for obtaining an ID for a pickable decoration.
   * @see [[RenderContext.createGraphicBuilder]].
   * @see [[Decorator]]
   */
  public createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String): GraphicBuilder {
    const pickable = undefined !== pickableId ? { id: pickableId } : undefined;
    return this.createGraphic({ type, viewport, placement, pickable });
  }

  /** Obtain a [[GraphicBuilder]] from which to produce a [[RenderGraphic]].
   * @param options Options describing how to create the builder.
   * @returns A builder that produces a [[RenderGraphic]].
   */
  public abstract createGraphic(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions): GraphicBuilder;

  /** Obtain an object capable of producing a custom screen-space effect to be applied to the image rendered by a [[Viewport]].
   * @returns undefined if screen-space effects are not supported by this RenderSystem.
   */
  public createScreenSpaceEffectBuilder(_params: ScreenSpaceEffectBuilderParams): ScreenSpaceEffectBuilder | undefined {
    return undefined;
  }

  /** Create a graphic from a low-level representation of a triangle mesh.
   * @param args A description of the mesh.
   * @param instances Repetitions of the mesh to be drawn.
   * @see [[createGraphic]] to obtain a [[GraphicBuilder]] that can assemble a mesh from higher-level primitives.
   */
  public createTriMesh(args: MeshArgs, instances?: InstancedGraphicParams): RenderGraphic | undefined;
  /** @internal */
  public createTriMesh(args: MeshArgs, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined; // eslint-disable-line @typescript-eslint/unified-signatures
  /** @internal */
  public createTriMesh(args: MeshArgs, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined {
    const params = createMeshParams(args, this.maxTextureSize, IModelApp.tileAdmin.edgeOptions.type !== "non-indexed");
    return this.createMesh(params, instances);
  }

  /** @internal */
  public createMeshGraphics(mesh: Mesh, instances?: InstancedGraphicParams | Point3d): RenderGraphic | undefined {
    const meshArgs = mesh.toMeshArgs();
    if (meshArgs) {
      return this.createTriMesh(meshArgs, instances);
    }

    const polylineArgs = mesh.toPolylineArgs();
    return polylineArgs ? this.createIndexedPolylines(polylineArgs, instances) : undefined;
  }

  /** @internal */
  public createGeometryFromMesh(mesh: Mesh, viOrigin: Point3d | undefined): RenderGeometry | undefined {
    const meshArgs = mesh.toMeshArgs();
    if (meshArgs) {
      const meshParams = createMeshParams(meshArgs, this.maxTextureSize, IModelApp.tileAdmin.edgeOptions.type !== "non-indexed");
      return this.createMeshGeometry(meshParams, viOrigin);
    }

    const plArgs = mesh.toPolylineArgs();
    if (!plArgs) {
      return undefined;
    }

    if (plArgs.flags.isDisjoint) {
      const psParams = createPointStringParams(plArgs, this.maxTextureSize);
      return psParams ? this.createPointStringGeometry(psParams, viOrigin) : undefined;
    }

    const plParams = createPolylineParams(plArgs, this.maxTextureSize);
    return plParams ? this.createPolylineGeometry(plParams, viOrigin) : undefined;
  }

  /** Create a graphic from a low-level representation of a set of line strings.
   * @param args A description of the line strings.
   * @param instances Repetitions of the line strings to be drawn.
   */
  public createIndexedPolylines(args: PolylineArgs, instances?: InstancedGraphicParams): RenderGraphic | undefined;
  /** @internal */
  public createIndexedPolylines(args: PolylineArgs, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined; // eslint-disable-line @typescript-eslint/unified-signatures
  /** @internal */
  public createIndexedPolylines(args: PolylineArgs, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined {
    if (args.flags.isDisjoint) {
      const pointStringParams = createPointStringParams(args, this.maxTextureSize);
      return undefined !== pointStringParams ? this.createPointString(pointStringParams, instances) : undefined;
    } else {
      const polylineParams = createPolylineParams(args, this.maxTextureSize);
      return undefined !== polylineParams ? this.createPolyline(polylineParams, instances) : undefined;
    }
  }

  /** @internal */
  public createMeshGeometry(_params: MeshParams, _viewIndependentOrigin?: Point3d): RenderGeometry | undefined { return undefined; }
  /** @internal */
  public createPolylineGeometry(_params: PolylineParams, _viewIndependentOrigin?: Point3d): RenderGeometry | undefined { return undefined; }
  /** @internal */
  public createPointStringGeometry(_params: PointStringParams, _viewIndependentOrigin?: Point3d): RenderGeometry | undefined { return undefined; }
  /** @internal */
  public createPointCloudGeometry(_args: PointCloudArgs): RenderGeometry | undefined { return undefined; }
  /** @internal */
  public createRealityMeshGeometry(_params: RealityMeshParams, _disableTextureDisposal = false): RenderGeometry | undefined { return undefined; }

  /** @internal */
  public createAreaPattern(_params: PatternGraphicParams): RenderAreaPattern | undefined { return undefined; }

  /** Create a [[RenderInstances]] from a [[RenderInstancesParams]], to be supplied to [[createGraphicFromTemplate]] via [[CreateGraphicFromTempalateArgs.instances]].
   * @beta
   */
  public createRenderInstances(_params: RenderInstancesParams): RenderInstances | undefined { return undefined; }

  /** Creates a graphic that draws any number of repetitions of a [[GraphicTemplate]].
   * @beta
   */
  public abstract createGraphicFromTemplate(args: CreateGraphicFromTemplateArgs): RenderGraphic;

  /** Create a RenderGraphic from a RenderGeometry produced by this RenderSystem.
   * @internal
   */
  public abstract createRenderGraphic(_geometry: RenderGeometry, instances?: InstancedGraphicParams | RenderAreaPattern): RenderGraphic | undefined;

  private createGraphicFromGeometry(
    createGeometry: (viewIndependentOrigin?: Point3d) => RenderGeometry | undefined,
    instancesOrOrigin?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined {
    let viOrigin;
    let instances;
    if (instancesOrOrigin instanceof Point3d)
      viOrigin = instancesOrOrigin;
    else
      instances = instancesOrOrigin;

    const geom = createGeometry(viOrigin);
    return geom ? this.createRenderGraphic(geom, instances) : undefined;
  }

  /** @internal */
  public createMesh(params: MeshParams, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined {
    return this.createGraphicFromGeometry((viOrigin) => this.createMeshGeometry(params, viOrigin), instances);
  }

  /** @internal */
  public createPolyline(params: PolylineParams, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined {
    return this.createGraphicFromGeometry((origin) => this.createPolylineGeometry(params, origin), instances);
  }

  /** @internal */
  public createPointString(params: PointStringParams, instances?: InstancedGraphicParams | RenderAreaPattern | Point3d): RenderGraphic | undefined {
    return this.createGraphicFromGeometry((origin) => this.createPointStringGeometry(params, origin), instances);
  }

  /** @internal */
  public createTerrainMesh(_params: RealityMeshParams, _transform?: Transform, _disableTextureDisposal = false): RenderTerrainGeometry | undefined {
    return undefined;
  }

  /** @internal */
  public createRealityMeshGraphic(_params: RealityMeshGraphicParams, _disableTextureDisposal = false): RenderGraphic | undefined { return undefined; }
  /** @internal */
  public createRealityMesh(realityMesh: RealityMeshParams, disableTextureDisposal = false): RenderGraphic | undefined {
    const geom = this.createRealityMeshGeometry(realityMesh, disableTextureDisposal);
    return geom ? this.createRenderGraphic(geom) : undefined;
  }

  /** @internal */
  public get maxRealityImageryLayers() { return 0; }
  /** @internal */
  public createPointCloud(args: PointCloudArgs, _imodel: IModelConnection): RenderGraphic | undefined {
    const geom = this.createPointCloudGeometry(args);
    return geom ? this.createRenderGraphic(geom) : undefined;
  }

  /** Create a clip volume to clip geometry.
   * @note The clip volume takes ownership of the ClipVector, which must not be subsequently mutated.
   * @param _clipVector Defines how the volume clips geometry.
   * @returns A clip volume, or undefined if, e.g., the clip vector does not clip anything.
   */
  public createClipVolume(_clipVector: ClipVector): RenderClipVolume | undefined { return undefined; }

  /** @internal */
  public createPlanarGrid(_frustum: Frustum, _grid: PlanarGridProps): RenderGraphic | undefined { return undefined; }
  /** @internal */
  public createBackgroundMapDrape(_drapedTree: TileTreeReference, _mapTree: MapTileTreeReference): RenderTextureDrape | undefined { return undefined; }
  /** @internal */
  public createTile(tileTexture: RenderTexture, corners: Point3d[], featureIndex?: number): RenderGraphic | undefined {
    // corners
    // [0] [1]
    // [2] [3]
    // Quantize the points according to their range
    const points = new QPoint3dList(QParams3d.fromRange(Range3d.create(...corners)));
    for (let i = 0; i < 4; i++)
      points.add(corners[i]);

    // Now remove the translation from the quantized points and put it into a transform instead.
    // This prevents graphical artifacts when quantization origin is large relative to quantization scale.
    // ###TODO: Would be better not to create a branch for every tile.
    const qorigin = points.params.origin;
    const transform = Transform.createTranslationXYZ(qorigin.x, qorigin.y, qorigin.z);
    qorigin.setZero();

    const features = new FeatureIndex();
    if (undefined !== featureIndex) {
      features.featureID = featureIndex;
      features.type = FeatureIndexType.Uniform;
    }

    const rasterTile: MeshArgs = {
      points,
      vertIndices: [0, 1, 2, 2, 1, 3],
      isPlanar: true,
      features,
      colors: new ColorIndex(),
      fillFlags: FillFlags.None,
      textureMapping: {
        uvParams: [new Point2d(0, 0), new Point2d(1, 0), new Point2d(0, 1), new Point2d(1, 1)],
        texture: tileTexture,
      },
    };

    const trimesh = this.createTriMesh(rasterTile);
    if (undefined === trimesh)
      return undefined;

    const branch = new GraphicBranch(true);
    branch.add(trimesh);
    return this.createBranch(branch, transform);
  }

  /** Create a Graphic for a [[SkyBox]] which encompasses the entire scene, rotating with the camera.
   * @internal
   */
  public createSkyBox(_params: RenderSkyBoxParams): RenderGraphic | undefined { return undefined; }

  /** Create a RenderGraphic consisting of a list of Graphics to be drawn together. */
  public abstract createGraphicList(primitives: RenderGraphic[]): RenderGraphic;

  /** Create a RenderGraphic consisting of a list of Graphics, with optional transform and symbology overrides applied to the list */
  public createBranch(branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions): RenderGraphic {
    return this.createGraphicBranch(branch, transform, options);
  }

  /** Create a graphic from a [[GraphicBranch]]. */
  public abstract createGraphicBranch(branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions): RenderGraphic;

  /** Create a node in the scene graph corresponding to a transform node in the scene's schedule script.
   * Nodes under this branch will only be drawn if they belong to the specified transform node.
   * This allows the graphics in a single Tile to be efficiently drawn with different transforms applied by different nodes.
   * The node Id is either the Id of a single transform node in the script, of 0xffffffff to indicate all nodes that have no transform applied to them.
   * @internal
   */
  public createAnimationTransformNode(graphic: RenderGraphic, _nodeId: number): RenderGraphic {
    return graphic;
  }

  /** Create a "batch" of graphics containing individual [Feature]($common)s.
   * @param graphic The graphic representing the contents of the batch.
   * @param features The features contained within the batch.
   * @param range A volume fully encompassing the batch's geometry.
   * @param options Options customizing the behavior of the batch.
   */
  public abstract createBatch(graphic: RenderGraphic, features: RenderFeatureTable, range: ElementAlignedBox3d, options?: BatchOptions): RenderGraphic;

  /** Return a Promise which when resolved indicates that all pending external textures have finished loading from the backend. */
  public async waitForAllExternalTextures(): Promise<void> { return Promise.resolve(); }
  /** @internal */
  public get hasExternalTextureRequests(): boolean { return false; }

  /** Create a graphic that assumes ownership of another graphic.
   * @param ownedGraphic The RenderGraphic to be owned.
   * @returns The owning graphic that exposes a `disposeGraphic` method for explicitly disposing of the owned graphic.
   * @see [[RenderGraphicOwner]] for details regarding ownership semantics.
   * @public
   */
  public createGraphicOwner(ownedGraphic: RenderGraphic): RenderGraphicOwner { return new GraphicOwner(ownedGraphic); }

  /** Create a "layer" containing the graphics belonging to it. A layer has a unique identifier and all of its geometry lies in an XY plane.
   * Different layers can be drawn coincident with one another; their draw order can be controlled by a per-layer priority value so that one layer draws
   * on top of another. Layers cannot nest inside other layers. Multiple GraphicLayers can exist with the same ID; they are treated as belonging to the same layer.
   * A GraphicLayer must be contained (perhaps indirectly) inside a GraphicLayerContainer.
   * @see [[createGraphicLayerContainer]]
   * @internal
   */
  public createGraphicLayer(graphic: RenderGraphic, _layerId: string): RenderGraphic { return graphic; }

  /** Create a graphic that can contain [[GraphicLayer]]s.
   * @internal
   */
  public createGraphicLayerContainer(graphic: RenderGraphic, _drawAsOverlay: boolean, _transparency: number, _elevation: number): RenderGraphic { return graphic; }

  /** Find a previously-created [[RenderTexture]] by its key.
   * @param _key The unique key of the texture within the context of the IModelConnection. Typically an element Id.
   * @param _imodel The IModelConnection with which the texture is associated.
   * @returns A previously-created texture matching the specified key, or undefined if no such texture exists.
   */
  public findTexture(_key: TextureCacheKey, _imodel: IModelConnection): RenderTexture | undefined {
    return undefined;
  }

  /** Find or create a [[RenderTexture]] from a persistent texture element.
   * @param id The ID of the texture element.
   * @param iModel The IModel containing the texture element.
   * @returns A Promise resolving to the created RenderTexture or to undefined if the texture could not be created.
   * @note If the texture is successfully created, it will be cached on the IModelConnection such that it can later be retrieved by its ID using [[RenderSystem.findTexture]].
   * @see [[RenderSystem.loadTextureImage]].
   */
  public async loadTexture(id: Id64String, iModel: IModelConnection): Promise<RenderTexture | undefined> {
    let texture = this.findTexture(id.toString(), iModel);
    if (undefined === texture) {
      const image = await this.loadTextureImage(id, iModel);
      if (undefined !== image) {
        // This will return a pre-existing RenderTexture if somebody else loaded it while we were awaiting the image.
        texture = this.createTexture({
          type: RenderTexture.Type.Normal,
          ownership: { key: id, iModel },
          image: {
            source: image.image,
            transparency: ImageSourceFormat.Png === image.format ? TextureTransparency.Mixed : TextureTransparency.Opaque,
          },
        });
      }
    }

    return texture;
  }

  /**
   * Load a texture image given the ID of a texture element.
   * @param id The ID of the texture element.
   * @param iModel The IModel containing the texture element.
   * @returns A Promise resolving to a TextureImage created from the texture element's data, or to undefined if the TextureImage could not be created.
   * @see [[RenderSystem.loadTexture]]
   * @internal
   */
  public async loadTextureImage(id: Id64String, iModel: IModelConnection): Promise<OldTextureImage | undefined> {
    const elemProps = await iModel.elements.getProps(id);
    if (1 !== elemProps.length)
      return undefined;

    const textureProps = elemProps[0] as TextureProps;
    if (undefined === textureProps.data || "string" !== typeof (textureProps.data) || undefined === textureProps.format || "number" !== typeof (textureProps.format))
      return undefined;

    const format = textureProps.format;
    if (!isValidImageSourceFormat(format))
      return undefined;

    const imageSource = new ImageSource(base64StringToUint8Array(textureProps.data), format);
    const image = await imageElementFromImageSource(imageSource);
    return { image, format };
  }

  /** Obtain a texture created from a gradient.
   * @param _symb The description of the gradient.
   * @param _imodel The IModelConnection with which the texture is associated.
   * @returns A texture created from the gradient image, or undefined if the texture could not be created.
   * @note If a texture matching the specified gradient is already cached on the iModel, it will be returned.
   * Otherwise, if an iModel is supplied, the newly-created texture will be cached on the iModel such that subsequent calls with an equivalent gradient and the
   * same iModel will return the cached texture instead of creating a new one.
   */
  public getGradientTexture(_symb: Gradient.Symb, _imodel?: IModelConnection): RenderTexture | undefined {
    return undefined;
  }

  /** Create a new texture from an [[ImageBuffer]].
   * @deprecated in 3.x. Use [[createTexture]].
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public createTextureFromImageBuffer(image: ImageBuffer, iModel: IModelConnection, params: RenderTexture.Params): RenderTexture | undefined {
    const ownership = params.key ? { key: params.key, iModel } : (params.isOwned ? "external" : undefined);
    return this.createTexture({
      type: params.type,
      ownership,
      image: {
        source: image,
        transparency: ImageBufferFormat.Rgba === image.format ? TextureTransparency.Mixed : TextureTransparency.Opaque,
      },
    });
  }

  /** Create a new texture from an HTML image. Typically the image was extracted from a binary representation of a jpeg or png via [[imageElementFromImageSource]].
   * @deprecated in 3.x. Use [[createTexture]].
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public createTextureFromImage(image: HTMLImageElement, hasAlpha: boolean, iModel: IModelConnection | undefined, params: RenderTexture.Params): RenderTexture | undefined {
    const ownership = params.key && iModel ? { key: params.key, iModel } : (params.isOwned ? "external" : undefined);
    return this.createTexture({
      type: params.type,
      ownership,
      image: {
        source: image,
        transparency: hasAlpha ? TextureTransparency.Mixed : TextureTransparency.Opaque,
      },
    });
  }

  /** Create a new texture from an ImageSource.
   * @deprecated in 3.x. Use RenderSystem.createTextureFromSource.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public async createTextureFromImageSource(source: ImageSource, iModel: IModelConnection | undefined, params: RenderTexture.Params): Promise<RenderTexture | undefined> {
    const ownership = iModel && params.key ? { iModel, key: params.key } : (params.isOwned ? "external" : undefined);
    return this.createTextureFromSource({
      type: params.type,
      source,
      ownership,
      transparency: source.format === ImageSourceFormat.Jpeg ? TextureTransparency.Opaque : TextureTransparency.Mixed,
    });
  }

  /** Create a texture from an ImageSource. */
  public async createTextureFromSource(args: CreateTextureFromSourceArgs): Promise<RenderTexture | undefined> {
    try {
      // JPEGs don't support transparency.
      const transparency = ImageSourceFormat.Jpeg === args.source.format ? TextureTransparency.Opaque : (args.transparency ?? TextureTransparency.Mixed);
      const image = await imageElementFromImageSource(args.source);
      if (!IModelApp.hasRenderSystem)
        return undefined;

      return this.createTexture({
        type: args.type,
        ownership: args.ownership,
        image: {
          source: image,
          transparency,
        },
      });
    } catch {
      return undefined;
    }
  }

  /** Create a new texture by its element ID. This texture will be retrieved asynchronously from the backend. A placeholder image will be associated with the texture until the requested image data loads. */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public createTextureFromElement(_id: Id64String, _imodel: IModelConnection, _params: RenderTexture.Params, _format: ImageSourceFormat): RenderTexture | undefined {
    return undefined;
  }

  public createTexture(_args: CreateTextureArgs): RenderTexture | undefined {
    return undefined;
  }

  /** Create a new texture from a cube of HTML images.
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public createTextureFromCubeImages(_posX: HTMLImageElement, _negX: HTMLImageElement, _posY: HTMLImageElement, _negY: HTMLImageElement, _posZ: HTMLImageElement, _negZ: HTMLImageElement, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined {
    return undefined;
  }

  /** @internal */
  public onInitialized(): void { }

  /** @internal */
  public enableDiagnostics(_enable: RenderDiagnostics): void { }

  /** @internal */
  public get supportsLogZBuffer(): boolean { return false !== this.options.logarithmicDepthBuffer; }

  /** Obtain an object that can be used to control various debugging features. Returns `undefined` if debugging features are unavailable for this `RenderSystem`.
   * @beta
   */
  public get debugControl(): RenderSystemDebugControl | undefined { return undefined; }

  /** @internal */
  public collectStatistics(_stats: RenderMemory.Statistics): void { }

  /** A function that is invoked after the WebGL context is lost. Context loss is almost always caused by excessive consumption of GPU memory.
   * After context loss occurs, the RenderSystem will be unable to interact with WebGL by rendering viewports, creating graphics and textures, etc.
   * By default, this function invokes [[ToolAdmin.exceptionHandler]] with a brief message describing what occurred.
   * An application can override this behavior as follows:
   * ```ts
   * RenderSystem.contextLossHandler = (): Promise<any> => {
   *  // your implementation here.
   * }
   * ```
   * @note Context loss is reported by the browser some short time *after* it has occurred. It is not possible to determine the specific cause.
   * @see [[TileAdmin.gpuMemoryLimit]] to limit the amount of GPU memory consumed thereby reducing the likelihood of context loss.
   * @see [[TileAdmin.totalTileContentBytes]] for the amount of GPU memory allocated for tile graphics.
   */
  public static async contextLossHandler(): Promise<any> {
    const msg = IModelApp.localization.getLocalizedString("iModelJs:Errors.WebGLContextLost");
    return ToolAdmin.exceptionHandler(msg);
  }

  /** Convert a [[GraphicDescription]] produced by a [[GraphicDescriptionBuilder]] into a [[RenderGraphic]].
   * @beta
   */
  public createGraphicFromDescription(args: CreateGraphicFromDescriptionArgs): RenderGraphic | undefined {
    return createGraphicFromDescription(args.description, args.context, this);
  }

  /** Convert a [[GraphicDescription]] produced by a [[GraphicDescriptionBuilder]] into a [[GraphicTemplate]].
   * @beta
   */
  public createTemplateFromDescription(args: CreateGraphicFromDescriptionArgs): GraphicTemplate {
    return createGraphicTemplateFromDescription(args.description, args.context, this);
  }

  /** Obtain the JSON representation of a [[WorkerGraphicDescriptionContext]] for the specified `iModel` that can be forwarded to a Worker for use with a [[GraphicDescriptionBuilder]].
   * @beta
   */
  public createWorkerGraphicDescriptionContextProps(iModel: IModelConnection): WorkerGraphicDescriptionContextProps {
    const props: WorkerGraphicDescriptionContextPropsImpl = {
      [_implementationProhibited]: undefined,
      transientIds: iModel.transientIds.fork(),
      constraints: {
        [_implementationProhibited]: undefined,
        maxTextureSize: this.maxTextureSize,
      },
    };

    return props;
  }

  /** Synchronize changes made to a [[WorkerGraphicDescriptionContext]] on a Worker with the state of the `iModel` from which it was created.
   * @beta
   */
  public async resolveGraphicDescriptionContext(props: GraphicDescriptionContextProps, iModel: IModelConnection): Promise<GraphicDescriptionContext> {
    const impl = props as GraphicDescriptionContextPropsImpl;
    if (typeof impl.transientIds !== "object" || !Array.isArray(impl.textures)) {
      throw new Error("Invalid GraphicDescriptionContextProps");
    }

    if (impl.resolved) {
      throw new Error("resolveGraphicDescriptionContext can only be called once for a given GraphicDescriptionContextProps");
    }

    const textures = new Map<string, RenderTexture>();

    await Promise.allSettled(impl.textures.map(async (tex, i) => {
      let texture: RenderTexture | undefined;
      if (tex.source.gradient) {
        texture = this.getGradientTexture(Gradient.Symb.fromJSON(tex.source.gradient));
      } else if (tex.source.imageSource) {
        texture = await this.createTextureFromSource({
          source: new ImageSource(tex.source.imageSource, tex.source.format),
          type: tex.type,
          transparency: tex.transparency,
        });
      } else if (tex.source.imageBuffer) {
        texture = this.createTexture({
          type: tex.type,
          image: {
            source: ImageBuffer.create(tex.source.imageBuffer, tex.source.format, tex.source.width),
            transparency: tex.transparency,
          },
        });
      } else if (tex.source.url) {
        const image = await tryImageElementFromUrl(tex.source.url);
        if (image) {
          texture = this.createTexture({
            type: tex.type,
            image: {
              source: image,
              transparency: tex.transparency,
            },
          });
        }
      }

      if (texture) {
        textures.set(i.toString(10), texture);
      }
    }));

    const remap = iModel.transientIds.merge(impl.transientIds);
    impl.resolved = true;
    return {
      [_implementationProhibited]: undefined,
      remapTransientLocalId: (source) => remap(source),
      [_textures]: textures,
    };
  }
}

/** A RenderSystem provides access to resources used by the internal WebGL-based rendering system.
 * An application rarely interacts directly with the RenderSystem; instead it interacts with types like [[Viewport]] which
 * coordinate with the RenderSystem on the application's behalf.
 * @see [[IModelApp.renderSystem]].
 * @public
 */
export namespace RenderSystem {
  /** Options passed to [[IModelApp.supplyRenderSystem]] to configure the [[RenderSystem]] on startup. Many of these options serve as "feature flags" used to enable newer, experimental features. As such they typically begin life tagged as "alpha" or "beta" and are subsequently deprecated when the feature is declared stable.
   *
   * @public
   */
  export interface Options {
    /** WebGL extensions to be explicitly disabled, regardless of whether or not the WebGL implementation supports them.
     * This is chiefly useful for testing code that only executes in the absence of particular extensions, while running on a system that supports those extensions.
     *
     * Default value: undefined
     *
     * @public
     */
    disabledExtensions?: WebGLExtensionName[];

    /** If true, preserve the shader source code as internal strings, useful for debugging purposes.
     *
     * Default value: false
     *
     * @public
     */
    preserveShaderSourceCode?: boolean;

    /** If true, display solar shadows when enabled by [ViewFlags.shadows]($common).
     *
     * Default value: true
     *
     * @beta
     */
    displaySolarShadows?: boolean;

    /** If the view frustum is sufficiently large, and the EXT_frag_depth WebGL extension is available, use a logarithmic depth buffer to improve depth buffer resolution. Framerate may degrade to an extent while the logarithmic depth buffer is in use. If this option is disabled, or the extension is not supported, the near and far planes of very large view frustums will instead be moved to reduce the draw distance.
     *
     * Default value: true
     *
     * @public
     */
    logarithmicDepthBuffer?: boolean;

    /** If true, [[ScreenViewport]]s will respect the DPI of the display.  See [[Viewport.devicePixelRatio]] and [[Viewport.cssPixelsToDevicePixels]].
     * @see [[dpiAwareLOD]] to control whether device pixel ratio affects the level of detail for tile graphics and decorations.
     * @see [[Viewport.cssPixelsToDevicePixels]] to convert CSS pixels to device pixels.
     * @see [[Viewport.devicePixelRatio]].
     *
     * Default value: true
     *
     * @public
     */
    dpiAwareViewports?: boolean;

    /** If defined, this will be used as the device pixel ratio instead of the system's actual device pixel ratio.
     * This can be helpful for situations like running in the iOS Simulator where forcing a lower resolution by setting a sub-1 device pixel ratio would increase performance.
     * @note If this setting is used to decrease the effective device pixel ratio, the view will appear pixelated.
     * @note This setting should only be used to increase performance in situations like the iOS Simulator for testing purposes only. It should not be used in a production situation.
     * @note This setting has no effect if [[dpiAwareViewports]] is `false`.
     *
     * Default value: undefined
     *
     * @public
     */
    devicePixelRatioOverride?: number;

    /** If true, [[ScreenViewport]]s will take into account the DPI of the display when computing the level of detail for tile graphics and decorations.
     * This can result in sharper-looking images on high-DPI devices like mobile phones, but may reduce performance on such devices.
     * @note This setting has no effect if [[dpiAwareViewports]] is `false`.
     * @see [[Viewport.devicePixelRatio]].
     *
     * Default value: false
     *
     * @public
     */
    dpiAwareLOD?: boolean;

    /** Previously, this property dictated whether to attempt to use a WebGL 2 rendering context before falling back to WebGL 1.
     * WebGL 1 is no longer supported, so this property is now ignored.
     * @public
     * @deprecated in 4.x. WebGL 1 is no longer supported.
     */
    useWebGL2?: boolean;

    /** If true, plan projection models will be rendered using [PlanProjectionSettings]($common) defined by the [[DisplayStyle3dState]].
     * Default value: true
     * @public
     */
    planProjections?: boolean;

    /** To help prevent delays when a user interacts with a [[Viewport]], the WebGL render system can precompile shader programs before any Viewport is opened.
     * This particularly helps applications when they do not open a Viewport immediately upon startup - for example, if the user is first expected to select an iModel and a view through the user interface.
     * Shader precompilation will cease once all shader programs have been compiled, or when a Viewport is opened (registered with the [[ViewManager]]).
     * @note Enabling this feature can slow UI interactions before a [[Viewport]] is opened.
     * To enable this feature, set this to `true`.
     *
     * Default value: false
     *
     * @beta
     */
    doIdleWork?: boolean;

    /** WebGL context attributes to explicitly set when initializing [[IModelApp.renderSystem]].
     * Exposed chiefly for OpenCities Planner.
     * @internal
     */
    contextAttributes?: WebGLContextAttributes;

    /** If true, will cause exception when a shader uniform is missing (usually optimized out), otherwise will only log these.
     * Default value: false
     * @public
     */
    errorOnMissingUniform?: boolean;

    /** If true, and the `WEBGL_debug_shaders` extension is available, accumulate debug information during shader compilation.
     * This information can be accessed via `RenderSystemDebugControl.debugShaderFiles`.
     * Default value: false
     * @internal
     */
    debugShaders?: boolean;

    /** Initial antialias setting.
     * If antialiasing is supported, a value greater than 1 enables it using that many samples, and a value less than or equal to 1 disables antialiasing.
     * Default value: 1
     * @public
     */
    antialiasSamples?: number;
  }
}
