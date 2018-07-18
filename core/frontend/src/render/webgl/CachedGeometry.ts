/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { QPoint3dList, QParams3d, RenderTexture } from "@bentley/imodeljs-common";
import { assert, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { AttributeHandle, BufferHandle, QBufferHandle3d } from "./Handle";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder, CompositeFlags } from "./RenderFlags";
import { LineCode } from "./EdgeOverrides";
import { GL } from "./GL";
import { System } from "./System";
import { ColorInfo } from "./ColorInfo";
import { FeaturesInfo } from "./FeaturesInfo";
import { VertexLUT } from "./VertexLUT";
import { TextureHandle } from "./Texture";
import { Material } from "./Material";
import { SkyBoxCreateParams } from "../System";

/** Represents a geometric primitive ready to be submitted to the GPU for rendering. */
export abstract class CachedGeometry implements IDisposable {
  // Returns true if white portions of this geometry should render as black on white background
  protected abstract _wantWoWReversal(_target: Target): boolean;
  // Returns the edge/line weight used to render this geometry
  protected _getLineWeight(_params: ShaderProgramParams): number { return 0; }
  // Returns the edge/line pattern used to render this geometry
  protected _getLineCode(_params: ShaderProgramParams): number { return LineCode.solid; }

  // Returns the Id of the Technique used to render this geometry
  public abstract getTechniqueId(target: Target): TechniqueId;
  // Returns the pass in which to render this geometry. RenderPass.None indicates it should not be rendered.
  public abstract getRenderPass(target: Target): RenderPass;
  // Returns the 'order' of this geometry, which determines how z-fighting is resolved.
  public abstract get renderOrder(): RenderOrder;
  // Returns true if this is a lit surface
  public get isLitSurface(): boolean { return false; }

  /** Returns the origin of this geometry's quantization parameters. */
  public abstract get qOrigin(): Float32Array;
  /** Returns the scale of this geometry's quantization parameters. */
  public abstract get qScale(): Float32Array;
  /** Binds this geometry's vertex data to the vertex attribute. */
  public abstract bindVertexArray(handle: AttributeHandle): void;
  // Draws this geometry
  public abstract draw(): void;

  public abstract dispose(): void;

  // Intended to be overridden by specific subclasses
  public get material(): Material | undefined { return undefined; }
  public get polylineBuffers(): PolylineBuffers | undefined { return undefined; }
  public set uniformFeatureIndices(value: number) { assert(undefined !== value); } // silence 'unused variable' warning...
  public get featuresInfo(): FeaturesInfo | undefined { return undefined; }
  public get debugString(): string { return ""; }

  public get isEdge(): boolean {
    switch (this.renderOrder) {
      case RenderOrder.Edge:
      case RenderOrder.Silhouette:
      case RenderOrder.PlanarEdge:
      case RenderOrder.PlanarSilhouette:
        return true;
      default:
        return false;
    }
  }
  public wantWoWReversal(params: ShaderProgramParams): boolean {
    return !params.isOverlayPass && this._wantWoWReversal(params.target);
  }
  public getLineCode(params: ShaderProgramParams): number {
    return params.target.currentViewFlags.showStyles() ? this._getLineCode(params) : LineCode.solid;
  }
  public getLineWeight(params: ShaderProgramParams): number {
    if (!params.target.currentViewFlags.showWeights()) {
      return 1.0;
    }

    const minWeight = 1;
    let weight = this._getLineWeight(params);
    weight = Math.max(weight, minWeight);
    weight = Math.min(weight, 31.0);
    assert(Math.floor(weight) === weight);
    return weight;
  }
}

// Geometry which is drawn using indices into a look-up texture of vertex data, via gl.drawArrays()
export abstract class LUTGeometry extends CachedGeometry {
  // The texture containing the vertex data.
  public abstract get lut(): VertexLUT.Data;

  // Override this if your color varies based on the target
  public getColor(_target: Target): ColorInfo { return this.lut.colorInfo; }

  public get qOrigin(): Float32Array { return this.lut.qOrigin; }
  public get qScale(): Float32Array { return this.lut.qScale; }

  protected constructor() { super(); }
}

// Parameters used to construct an IndexedGeometry
export class IndexedGeometryParams implements IDisposable {
  public readonly positions: QBufferHandle3d;
  public readonly indices: BufferHandle;
  public readonly numIndices: number;

  protected constructor(positions: QBufferHandle3d, indices: BufferHandle, numIndices: number) {
    this.positions = positions;
    this.indices = indices;
    this.numIndices = numIndices;
  }

  public static create(positions: Uint16Array, qparams: QParams3d, indices: Uint32Array) {
    const posBuf = QBufferHandle3d.create(qparams, positions);
    const indBuf = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indices);
    if (undefined === posBuf || undefined === indBuf) {
      assert(false);
      return undefined;
    }

    assert(!posBuf.isDisposed && !indBuf.isDisposed);
    return new IndexedGeometryParams(posBuf, indBuf, indices.length);
  }
  public static createFromList(positions: QPoint3dList, indices: Uint32Array) {
    return IndexedGeometryParams.create(positions.toTypedArray(), positions.params, indices);
  }

  public dispose() {
    dispose(this.positions);
    dispose(this.indices);
  }
}

/** A geometric primitive which is rendered using gl.drawElements() with one or more vertex buffers indexed by an index buffer. */
export abstract class IndexedGeometry extends CachedGeometry {
  protected readonly _params: IndexedGeometryParams;
  protected _wantWoWReversal(_target: Target): boolean { return false; }
  protected constructor(params: IndexedGeometryParams) {
    super();
    this._params = params;
  }

  public dispose() {
    dispose(this._params);
  }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._params.positions, 3, GL.DataType.UnsignedShort, false, 0, 0);
  }
  public draw(): void {
    this._params.indices.bind(GL.Buffer.Target.ElementArrayBuffer);
    System.instance.context.drawElements(GL.PrimitiveType.Triangles, this._params.numIndices, GL.DataType.UnsignedInt, 0);
  }

  public get qOrigin() { return this._params.positions.origin; }
  public get qScale() { return this._params.positions.scale; }
}

/** A geometric primitive representative of a set of clipping planes to clip a volume of space. */
export class ClipMaskGeometry extends IndexedGeometry {
  public constructor(indices: Uint32Array, vertices: QPoint3dList) {
    super(IndexedGeometryParams.create(vertices.toTypedArray(), vertices.params, indices)!);
  }

  public getTechniqueId(_target: Target): TechniqueId { return TechniqueId.ClipMask; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.None; }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
}

class SkyBoxSides {
  public static readonly front = 0.0;
  public static readonly back = 0.2;
  public static readonly top = 0.4;
  public static readonly bottom = 0.6;
  public static readonly left = 0.8;
  public static readonly right = 1.0;
}

// a cube of quads in normalized device coordinates for skybox rendering techniques
class SkyBoxQuads {
  public readonly vertices: Uint16Array;
  public readonly vertexParams: QParams3d;
  public readonly uvs: Float32Array;
  public readonly sides: Float32Array;

  public constructor() {
    const skyBoxSz = 1.0;

    const qVerts = new QPoint3dList(QParams3d.fromNormalizedRange());
    this.sides = new Float32Array(36);
    this.uvs = new Float32Array(36 * 2);

    // NB: After applying the rotation matrix in the shader, Back becomes (Bottom), etc.
    // See the notes in the parens below.

    // Back (Bottom after rotation)
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([1, 0], 0);  // back upper left - 0
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 2);   // back upper right - 1
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 0], 4); // back lower left - 2
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 6);   // back upper right - 1
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 8);  // back lower right - 3
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 0], 10); // back lower left - 2
    this.sides.set([SkyBoxSides.bottom, SkyBoxSides.bottom, SkyBoxSides.bottom, SkyBoxSides.bottom, SkyBoxSides.bottom, SkyBoxSides.bottom], 0);

    // Front (Top after rotation)
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([1, 1], 12);  // front upper left - 4
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 14);   // front upper right - 5
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([0, 1], 16); // front lower left - 6
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 18);   // front upper right - 5
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 20);  // front lower right - 7
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([0, 1], 22); // front lower left - 6
    this.sides.set([SkyBoxSides.top, SkyBoxSides.top, SkyBoxSides.top, SkyBoxSides.top, SkyBoxSides.top, SkyBoxSides.top], 6);

    // Top (Front after rotation)
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 24); // front upper left - 4
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 26);  // front upper right - 5
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 28);   // back upper right - 1
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 30); // front upper left - 4
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 32);  // back upper left - 0
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 34);   // back upper right - 1
    this.sides.set([SkyBoxSides.front, SkyBoxSides.front, SkyBoxSides.front, SkyBoxSides.front, SkyBoxSides.front, SkyBoxSides.front], 12);

    // Bottom (Back after rotation)
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 36);  // back lower left - 2
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 38);   // back lower right - 3
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 40); // front lower left - 6
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 42);   // back lower right - 3
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 44);  // front lower right - 7
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 46); // front lower left - 6
    this.sides.set([SkyBoxSides.back, SkyBoxSides.back, SkyBoxSides.back, SkyBoxSides.back, SkyBoxSides.back, SkyBoxSides.back], 18);

    // Left (Right after rotation)
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 48);   // back upper left - 0
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 50);  // front upper left - 4
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 52);  // back lower left - 2
    qVerts.add(new Point3d(-skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 54);  // front upper left - 4
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 56); // front lower left - 6
    qVerts.add(new Point3d(-skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 58);  // back lower left - 2
    this.sides.set([SkyBoxSides.right, SkyBoxSides.right, SkyBoxSides.right, SkyBoxSides.right, SkyBoxSides.right, SkyBoxSides.right], 24);

    // Right (Left after rotation)
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, skyBoxSz)); this.uvs.set([0, 1], 60);   // back upper right - 1
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 62);  // front upper right - 5
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 64);  // back lower right - 3
    qVerts.add(new Point3d(skyBoxSz, skyBoxSz, -skyBoxSz)); this.uvs.set([0, 0], 66);  // front upper right - 5
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, -skyBoxSz)); this.uvs.set([1, 0], 68); // front lower right - 7
    qVerts.add(new Point3d(skyBoxSz, -skyBoxSz, skyBoxSz)); this.uvs.set([1, 1], 70);  // back lower right - 3
    this.sides.set([SkyBoxSides.left, SkyBoxSides.left, SkyBoxSides.left, SkyBoxSides.left, SkyBoxSides.left, SkyBoxSides.left], 30);

    this.vertices = qVerts.toTypedArray();
    this.vertexParams = qVerts.params;
  }

  public createParams() {
    return SkyBoxGeometryParams.create(this.vertices, this.vertexParams, this.uvs, this.sides);
  }
}

// Parameters used to construct an SkyBox
export class SkyBoxGeometryParams implements IDisposable {
  public readonly positions: QBufferHandle3d;
  public readonly uvs: BufferHandle;
  public readonly sides: BufferHandle;

  protected constructor(positions: QBufferHandle3d, uvs: BufferHandle, sides: BufferHandle) {
    this.positions = positions;
    this.uvs = uvs;
    this.sides = sides;
  }

  public static create(positions: Uint16Array, qparams: QParams3d, uvs: Float32Array, sides: Float32Array) {
    const posBuf = QBufferHandle3d.create(qparams, positions);
    const uvBuf = BufferHandle.createBuffer(GL.Buffer.Target.ArrayBuffer, uvs);
    const sideBuf = BufferHandle.createBuffer(GL.Buffer.Target.ArrayBuffer, sides);
    if (undefined === posBuf || undefined === uvBuf || undefined === sideBuf) {
      assert(false);
      return undefined;
    }

    assert(!posBuf.isDisposed && !sideBuf.isDisposed);
    return new SkyBoxGeometryParams(posBuf, uvBuf, sideBuf);
  }

  public dispose() {
    dispose(this.positions);
    dispose(this.sides);
  }
}

namespace SkyBoxQuads {
  let _skyBoxQuads: SkyBoxQuads | undefined;

  export function getInstance(): SkyBoxQuads {
    if (undefined === _skyBoxQuads)
      _skyBoxQuads = new SkyBoxQuads();

    return _skyBoxQuads;
  }
}

// Geometry used for view-space rendering techniques.
export class SkyBoxQuadsGeometry extends CachedGeometry {
  protected _techniqueId: TechniqueId;
  public readonly front: RenderTexture;
  public readonly back: RenderTexture;
  public readonly top: RenderTexture;
  public readonly bottom: RenderTexture;
  public readonly left: RenderTexture;
  public readonly right: RenderTexture;
  protected readonly _params: SkyBoxGeometryParams;

  protected constructor(ndxGeomParams: SkyBoxGeometryParams, sbxCreateParams: SkyBoxCreateParams) {
    super();
    this.front = sbxCreateParams.front!;
    this.back = sbxCreateParams.back!;
    this.top = sbxCreateParams.top!;
    this.bottom = sbxCreateParams.bottom!;
    this.left = sbxCreateParams.left!;
    this.right = sbxCreateParams.right!;
    this._techniqueId = TechniqueId.SkyBox;
    this._params = ndxGeomParams;
  }

  public static create(sbxCreateParams: SkyBoxCreateParams): SkyBoxQuadsGeometry | undefined {
    const sbxGeomParams = SkyBoxQuads.getInstance().createParams();
    return undefined !== sbxGeomParams ? new SkyBoxQuadsGeometry(sbxGeomParams, sbxCreateParams) : undefined;
  }

  public getTechniqueId(_target: Target) { return this._techniqueId; }
  public getRenderPass(_target: Target) { return RenderPass.SkyBox; }
  public get renderOrder() { return RenderOrder.Surface; }

  public bindVertexArray(attr: AttributeHandle): void {
    attr.enableArray(this._params.positions, 3, GL.DataType.UnsignedShort, false, 0, 0);
  }

  public bindTexCoordArray(attr: AttributeHandle): void {
    attr.enableArray(this._params.uvs, 2, GL.DataType.Float, false, 0, 0);
  }

  public bindSideArray(attr: AttributeHandle): void {
    attr.enableArray(this._params.sides, 1, GL.DataType.Float, false, 0, 0);
  }

  public draw(): void {
    System.instance.context.drawArrays(GL.PrimitiveType.Triangles, 0, 36);
  }

  public get qOrigin() { return this._params.positions.origin; }
  public get qScale() { return this._params.positions.scale; }

  public dispose() {
    dispose(this._params);
  }

  protected _wantWoWReversal(_target: Target): boolean { return false; }
}

// A quad with its corners mapped to the dimensions as the viewport, used for special rendering techniques.
class ViewportQuad {
  public readonly vertices: Uint16Array;
  public readonly vertexParams: QParams3d;
  public readonly indices = new Uint32Array(6);

  public constructor() {
    const pt = new Point3d(-1, -1, 0);
    const vertices = new QPoint3dList(QParams3d.fromNormalizedRange());
    vertices.add(pt);
    pt.x = 1;
    vertices.add(pt);
    pt.y = 1;
    vertices.add(pt);
    pt.x = -1;
    vertices.add(pt);

    this.vertices = vertices.toTypedArray();
    this.vertexParams = vertices.params;

    this.indices[0] = 0;
    this.indices[1] = 1;
    this.indices[2] = 2;
    this.indices[3] = 0;
    this.indices[4] = 2;
    this.indices[5] = 3;
  }

  public createParams() {
    return IndexedGeometryParams.create(this.vertices, this.vertexParams, this.indices);
  }
}

namespace ViewportQuad {
  let _viewportQuad: ViewportQuad | undefined;

  export function getInstance(): ViewportQuad {
    if (undefined === _viewportQuad)
      _viewportQuad = new ViewportQuad();

    return _viewportQuad;
  }
}

// Geometry used for view-space rendering techniques.
export class ViewportQuadGeometry extends IndexedGeometry {
  protected _techniqueId: TechniqueId;

  protected constructor(params: IndexedGeometryParams, techniqueId: TechniqueId) {
    super(params);
    this._techniqueId = techniqueId;
  }
  public static create(techniqueId: TechniqueId) {
    const params = ViewportQuad.getInstance().createParams();
    return undefined !== params ? new ViewportQuadGeometry(params, techniqueId) : undefined;
  }

  public getTechniqueId(_target: Target) { return this._techniqueId; }
  public getRenderPass(_target: Target) { return RenderPass.OpaqueGeneral; }
  public get renderOrder() { return RenderOrder.Surface; }
}

// Geometry used for view-space rendering techniques which involve sampling one or more textures.
export class TexturedViewportQuadGeometry extends ViewportQuadGeometry {
  protected readonly _textures: WebGLTexture[];

  protected constructor(params: IndexedGeometryParams, techniqueId: TechniqueId, textures: WebGLTexture[]) {
    super(params, techniqueId);
    this._textures = textures;

    // TypeScript compiler will happily accept TextureHandle (or any other type) in place of WebGLTexture.
    // There is no such 'type' as WebGLTexture at run-time.
    for (const texture of this._textures) {
      assert(!(texture instanceof TextureHandle));
    }
  }
}

// Geometry used during the 'composite' pass to apply transparency and/or hilite effects.
export class CompositeGeometry extends TexturedViewportQuadGeometry {
  public static createGeometry(opaque: WebGLTexture, accum: WebGLTexture, reveal: WebGLTexture, hilite: WebGLTexture) {
    const params = ViewportQuad.getInstance().createParams();
    if (undefined === params) {
      return undefined;
    }

    return new CompositeGeometry(params, [opaque, accum, reveal, hilite]);
  }

  public get opaque() { return this._textures[0]; }
  public get accum() { return this._textures[1]; }
  public get reveal() { return this._textures[2]; }
  public get hilite() { return this._textures[3]; }

  // Invoked each frame to determine the appropriate Technique to use.
  public update(flags: CompositeFlags): void { this._techniqueId = this.determineTechnique(flags); }
  private determineTechnique(flags: CompositeFlags): TechniqueId {
    switch (flags) {
      case CompositeFlags.Hilite: return TechniqueId.CompositeHilite;
      case CompositeFlags.Translucent: return TechniqueId.CompositeTranslucent;
      default: return TechniqueId.CompositeHiliteAndTranslucent;
    }
  }

  private constructor(params: IndexedGeometryParams, textures: WebGLTexture[]) {
    super(params, TechniqueId.CompositeHilite, textures);
    assert(4 === this._textures.length);
  }
}

// Geometry used to ping-pong the pick buffer data in between opaque passes.
export class CopyPickBufferGeometry extends TexturedViewportQuadGeometry {
  public static createGeometry(idLow: WebGLTexture, idHigh: WebGLTexture, depthAndOrder: WebGLTexture) {
    const params = ViewportQuad.getInstance().createParams();
    if (undefined !== params) {
      return new CopyPickBufferGeometry(params, [idLow, idHigh, depthAndOrder]);
    } else {
      return undefined;
    }
  }

  public get elemIdLow() { return this._textures[0]; }
  public get elemIdHigh() { return this._textures[1]; }
  public get depthAndOrder() { return this._textures[2]; }

  private constructor(params: IndexedGeometryParams, textures: WebGLTexture[]) {
    super(params, TechniqueId.CopyPickBuffers, textures);
  }
}

export class SingleTexturedViewportQuadGeometry extends TexturedViewportQuadGeometry {
  public static createGeometry(texture: WebGLTexture, techId: TechniqueId) {
    const params = ViewportQuad.getInstance().createParams();
    if (undefined === params) {
      return undefined;
    }

    return new SingleTexturedViewportQuadGeometry(params, texture, techId);
  }

  public get texture(): WebGLTexture { return this._textures[0]; }
  public set texture(texture: WebGLTexture) { this._textures[0] = texture; }

  protected constructor(params: IndexedGeometryParams, texture: WebGLTexture, techId: TechniqueId) {
    super(params, techId, [texture]);
  }
}

export class PolylineBuffers implements IDisposable {
  public indices: BufferHandle;
  public prevIndices: BufferHandle;
  public nextIndicesAndParams: BufferHandle;
  public distances: BufferHandle;

  public constructor(indices: BufferHandle, prevIndices: BufferHandle, nextIndicesAndParams: BufferHandle, distances: BufferHandle) {
    this.indices = indices;
    this.prevIndices = prevIndices;
    this.nextIndicesAndParams = nextIndicesAndParams;
    this.distances = distances;
  }

  public dispose() {
    dispose(this.indices);
    dispose(this.prevIndices);
    dispose(this.nextIndicesAndParams);
    dispose(this.distances);
  }
}
