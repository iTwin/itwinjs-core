/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { TerrainMeshPrimitive } from "../primitives/mesh/TerrainMeshPrimitive";
import { IndexedGeometry, IndexedGeometryParams } from "./CachedGeometry";
import { QBufferHandle3d, QBufferHandle2d, BufferHandle, BufferParameters } from "./Handle";
import { TechniqueId } from "./TechniqueId";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target } from "./Target";
import { GL } from "./GL";
import { dispose, assert } from "@bentley/bentleyjs-core";
import { RenderGraphic } from "../RenderGraphic";
import { GraphicBranch } from "../GraphicBranch";
import { RenderMemory } from "../RenderMemory";
import { RenderSystem, RenderTerrainMeshGeometry, TerrainTexture } from "../RenderSystem";
import { AttributeMap } from "./AttributeMap";
import { System } from "./System";
import { RenderTexture, PackedFeatureTable } from "@bentley/imodeljs-common";
import { Range3d, Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";
import { Matrix4 } from "./Matrix";

/** @internal */
export class TerrainTextureParams {
  public static maxTexturesPerMesh = 2;
  constructor(public matrix: Matrix4, public textures: RenderTexture[]) { }
  public static create(terrainTextures: TerrainTexture[]) {
    assert(terrainTextures.length <= TerrainTextureParams.maxTexturesPerMesh);
    const matrix = new Matrix4();      // Published as Mat4.
    const renderTextures = [];
    for (let i = 0; i < terrainTextures.length; i++) {
      const base = i * 8;
      const terrainTexture = terrainTextures[i];
      renderTextures.push(terrainTexture.texture);
      assert(terrainTexture.texture !== undefined, "Texture not defined in TerrainTextureParams constructor");
      matrix.data[base + 0] = terrainTexture.translate.x;
      matrix.data[base + 1] = terrainTexture.translate.y;
      matrix.data[base + 2] = terrainTexture.scale.x;
      matrix.data[base + 3] = terrainTexture.scale.y;

      if (terrainTexture.clipRectangle) {
        matrix.data[base + 4] = terrainTexture.clipRectangle.low.x;
        matrix.data[base + 5] = terrainTexture.clipRectangle.low.y;
        matrix.data[base + 6] = terrainTexture.clipRectangle.high.x;
        matrix.data[base + 7] = terrainTexture.clipRectangle.high.y;
      } else {
        matrix.data[base + 4] = matrix.data[base + 5] = 0;
        matrix.data[base + 6] = matrix.data[base + 7] = 1;
      }
    }

    for (let i = terrainTextures.length; i < TerrainTextureParams.maxTexturesPerMesh; i++) {
      const base = i * 8;
      matrix.data[base + 4] = matrix.data[base + 5] = 1;
      matrix.data[base + 6] = matrix.data[base + 7] = -1;
    }

    return new TerrainTextureParams(matrix, renderTextures);
  }
}

/** @internal */
export class TerrainMeshParams extends IndexedGeometryParams {
  public readonly uvParams: QBufferHandle2d;
  public readonly featureID?: number;

  protected constructor(positions: QBufferHandle3d, uvParams: QBufferHandle2d, indices: BufferHandle, numIndices: number, featureID?: number) {
    super(positions, indices, numIndices);
    const attrParams = AttributeMap.findAttribute("a_uvParam", TechniqueId.TerrainMesh, false);
    assert(attrParams !== undefined);
    this.buffers.addBuffer(uvParams, [BufferParameters.create(attrParams!.location, 2, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this.uvParams = uvParams;
    this.featureID = featureID;
  }

  public static createFromTerrain(terrainMesh: TerrainMeshPrimitive) {
    const posBuf = QBufferHandle3d.create(terrainMesh.points.params, terrainMesh.points.toTypedArray());
    const uvParamBuf = QBufferHandle2d.create(terrainMesh.uvParams.params, terrainMesh.uvParams.toTypedArray());

    const indArray = new Uint16Array(terrainMesh.indices.length);
    for (let i = 0; i < terrainMesh.indices.length; i++)
      indArray[i] = terrainMesh.indices[i];

    const indBuf = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indArray);
    if (undefined === posBuf || undefined === uvParamBuf || undefined === indBuf)
      return undefined;

    return new TerrainMeshParams(posBuf, uvParamBuf, indBuf, terrainMesh.indices.length, terrainMesh.featureID);
  }

  public get isDisposed(): boolean {
    return super.isDisposed && this.uvParams.isDisposed;
  }
  public get bytesUsed(): number { return this.positions.bytesUsed + this.uvParams.bytesUsed + this.indices.bytesUsed; }

  public dispose() {
    super.dispose;
    dispose(this.uvParams);
  }
}

/** @internal */
export class TerrainMeshGeometry extends IndexedGeometry implements RenderTerrainMeshGeometry {
  public get asTerrainMesh(): TerrainMeshGeometry | undefined { return this; }
  public get isDisposed(): boolean { return this._terrainMeshParams.isDisposed; }
  public get uvQParams() { return this._terrainMeshParams.uvParams.params; }
  public get hasFeatures(): boolean { return this._terrainMeshParams.featureID !== undefined; }

  private constructor(private _terrainMeshParams: TerrainMeshParams, public textureParams?: TerrainTextureParams, private readonly _transform?: Transform) {
    super(_terrainMeshParams);
  }

  public dispose() {
    super.dispose();
    dispose(this._terrainMeshParams);
  }

  public static createGeometry(terrainMesh: TerrainMeshPrimitive, transform?: Transform) {
    const params = TerrainMeshParams.createFromTerrain(terrainMesh);
    return new TerrainMeshGeometry(params!, undefined, transform);
  }

  public static createGraphic(system: RenderSystem, terrainMesh: TerrainMeshGeometry, featureTable: PackedFeatureTable, textures?: TerrainTexture[]): RenderGraphic | undefined {
    const meshes = [];
    if (textures === undefined) {
      // assert(false, "Undefined terrain textures in createTerrainMesh");
      meshes.push(terrainMesh);
    } else {
      const texturesPerMesh = TerrainTextureParams.maxTexturesPerMesh;
      for (let i = 0; i < textures.length;) {
        const meshTextures = [];
        for (let j = 0; j < texturesPerMesh && i < textures.length; j++ , i++)
          meshTextures.push(textures[i]);

        meshes.push(new TerrainMeshGeometry(terrainMesh._terrainMeshParams, TerrainTextureParams.create(meshTextures), terrainMesh._transform));
      }
    }

    if (meshes.length === 0)
      return undefined;

    const branch = new GraphicBranch();
    for (const mesh of meshes) {
      const primitive = Primitive.create(() => mesh);
      branch.add(system.createBatch(primitive!, featureTable, Range3d.createNull()));
    }

    return system.createBranch(branch, terrainMesh._transform ? terrainMesh._transform : Transform.createIdentity());
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addTerrain(this._terrainMeshParams.bytesUsed);
  }

  public get techniqueId(): TechniqueId { return TechniqueId.TerrainMesh; }
  public getRenderPass(target: Target): RenderPass {
    if (target.isDrawingShadowMap)
      return RenderPass.None;

    if (target.terrainTransparency > 0.0)
      return RenderPass.Translucent;

    return RenderPass.OpaqueGeneral;
  }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }

  public draw(): void {
    this._params.buffers.bind();
    System.instance.context.drawElements(GL.PrimitiveType.Triangles, this._params.numIndices, GL.DataType.UnsignedShort, 0);
    this._params.buffers.unbind();
  }
}
