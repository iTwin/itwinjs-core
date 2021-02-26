/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Range2d, Range3d, Transform } from "@bentley/geometry-core";
import { ColorDef, PackedFeatureTable, Quantization, RenderTexture } from "@bentley/imodeljs-common";
import { IndexedGeometry, IndexedGeometryParams, Matrix4 } from "../../webgl";
import { GraphicBranch } from "../GraphicBranch";
import { TerrainMeshPrimitive } from "../primitives/mesh/TerrainMeshPrimitive";
import { RenderGraphic } from "../RenderGraphic";
import { RenderMemory } from "../RenderMemory";
import { RenderSystem, RenderTerrainMeshGeometry, TerrainTexture } from "../RenderSystem";
import { BufferHandle, BufferParameters, QBufferHandle2d, QBufferHandle3d } from "./AttributeBuffers";
import { AttributeMap } from "./AttributeMap";
import { GL } from "./GL";
import { Primitive } from "./Primitive";
import { RenderOrder, RenderPass } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";

const scratchOverlapRange = Range2d.createNull();

/** @internal */
export class TerrainTextureParams {

  constructor(public matrices: Matrix4[], public textures: RenderTexture[]) { }
  public static create(terrainTextures: TerrainTexture[]) {
    const maxTexturesPerMesh = System.instance.maxTerrainImageryLayers;
    assert(terrainTextures.length <= maxTexturesPerMesh);

    const renderTextures = [];
    const matrices = new Array<Matrix4>();
    for (const terrainTexture of terrainTextures) {
      const matrix = new Matrix4();      // Published as Mat4.
      renderTextures.push(terrainTexture.texture);
      assert(terrainTexture.texture !== undefined, "Texture not defined in TerrainTextureParams constructor");
      matrix.data[0] = terrainTexture.translate.x;
      matrix.data[1] = terrainTexture.translate.y;
      matrix.data[2] = terrainTexture.scale.x;
      matrix.data[3] = terrainTexture.scale.y;

      if (terrainTexture.clipRectangle) {
        matrix.data[4] = terrainTexture.clipRectangle.low.x;
        matrix.data[5] = terrainTexture.clipRectangle.low.y;
        matrix.data[6] = terrainTexture.clipRectangle.high.x;
        matrix.data[7] = terrainTexture.clipRectangle.high.y;
      } else {
        matrix.data[4] = matrix.data[5] = 0;
        matrix.data[6] = matrix.data[7] = 1;
      }
      matrix.data[8] = (1.0 - terrainTexture.transparency);
      matrix.data[9] = terrainTexture.featureId;
      matrices.push(matrix);
    }

    for (let i = terrainTextures.length; i < maxTexturesPerMesh; i++) {
      const matrix = new Matrix4();
      matrix.data[0] = matrix.data[1] = 0.0;
      matrix.data[2] = matrix.data[3] = 1.0;
      matrix.data[4] = matrix.data[5] = 1;
      matrix.data[6] = matrix.data[7] = -1;
      matrices.push(matrix);
    }
    return new TerrainTextureParams(matrices, renderTextures);
  }
}

/** @internal */
export class TerrainMeshParams extends IndexedGeometryParams {
  public readonly uvParams: QBufferHandle2d;
  public readonly featureID?: number;
  public readonly normals?: BufferHandle;

  protected constructor(positions: QBufferHandle3d, normals: BufferHandle | undefined, uvParams: QBufferHandle2d, indices: BufferHandle, numIndices: number, featureID?: number) {
    super(positions, indices, numIndices);
    let attrParams = AttributeMap.findAttribute("a_uvParam", TechniqueId.TerrainMesh, false);
    assert(attrParams !== undefined);
    this.buffers.addBuffer(uvParams, [BufferParameters.create(attrParams.location, 2, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this.uvParams = uvParams;

    if (undefined !== normals) {
      attrParams = AttributeMap.findAttribute("a_norm", TechniqueId.TerrainMesh, false);
      assert(attrParams !== undefined);
      if (normals.bytesUsed > 0)
        this.buffers.addBuffer(normals, [BufferParameters.create(attrParams.location, 2, GL.DataType.UnsignedByte, false, 0, 0, false)]);
      this.normals = normals;
    }

    this.featureID = featureID;
  }

  public static createFromTerrain(terrainMesh: TerrainMeshPrimitive) {
    const posBuf = QBufferHandle3d.create(terrainMesh.points.params, terrainMesh.points.toTypedArray());
    const uvParamBuf = QBufferHandle2d.create(terrainMesh.uvParams.params, terrainMesh.uvParams.toTypedArray());

    const indArray = new Uint16Array(terrainMesh.indices.length);
    for (let i = 0; i < terrainMesh.indices.length; i++)
      indArray[i] = terrainMesh.indices[i];

    const indBuf = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indArray);

    let normBuf: BufferHandle | undefined;
    if (terrainMesh.normals.length > 0) {
      const normalBytes = new Uint8Array(terrainMesh.normals.length * 2);
      const normalShorts = new Uint16Array(normalBytes.buffer);
      for (let i = 0; i < terrainMesh.normals.length; i++)
        normalShorts[i] = terrainMesh.normals[i].value;
      normBuf = BufferHandle.createArrayBuffer(normalBytes);
    }

    if (undefined === posBuf || undefined === uvParamBuf || undefined === indBuf || (terrainMesh.normals.length > 0 && undefined === normBuf))
      return undefined;

    return new TerrainMeshParams(posBuf, normBuf, uvParamBuf, indBuf, terrainMesh.indices.length, terrainMesh.featureID);
  }

  public get isDisposed(): boolean {
    return super.isDisposed && this.uvParams.isDisposed;
  }
  public get bytesUsed(): number { return this.positions.bytesUsed + (undefined === this.normals ? 0 : this.normals.bytesUsed) + this.uvParams.bytesUsed + this.indices.bytesUsed; }

  public dispose() {
    super.dispose();
    dispose(this.uvParams);
  }
}

/** @internal */
export class TerrainMeshGeometry extends IndexedGeometry implements RenderTerrainMeshGeometry {
  public get asTerrainMesh(): TerrainMeshGeometry | undefined { return this; }
  public get isDisposed(): boolean { return this._terrainMeshParams.isDisposed; }
  public get uvQParams() { return this._terrainMeshParams.uvParams.params; }
  public get hasFeatures(): boolean { return this._terrainMeshParams.featureID !== undefined; }
  public get supportsThematicDisplay() { return true; }

  private constructor(private _terrainMeshParams: TerrainMeshParams, public textureParams: TerrainTextureParams | undefined, private readonly _transform: Transform | undefined, public readonly baseColor: ColorDef | undefined, private _baseIsTransparent: boolean) {
    super(_terrainMeshParams);
  }

  public dispose() {
    super.dispose();
    dispose(this._terrainMeshParams);
  }

  public static createGeometry(terrainMesh: TerrainMeshPrimitive, transform: Transform | undefined) {
    const params = TerrainMeshParams.createFromTerrain(terrainMesh);
    return new TerrainMeshGeometry(params!, undefined, transform, undefined, false);
  }
  public getRange(): Range3d {
    return Range3d.createXYZXYZ(this.qOrigin[0], this.qOrigin[1], this.qOrigin[2], this.qOrigin[0] + Quantization.rangeScale16 * this.qScale[0], this.qOrigin[1] + Quantization.rangeScale16 * this.qScale[1], this.qOrigin[2] + Quantization.rangeScale16 * this.qScale[2]);
  }

  public static createGraphic(system: RenderSystem, terrainMesh: TerrainMeshGeometry, featureTable: PackedFeatureTable, tileId: string, baseColor: ColorDef | undefined, baseTransparent: boolean, textures?: TerrainTexture[]): RenderGraphic | undefined {
    const meshes = [];
    if (textures === undefined)
      textures = [];

    const texturesPerMesh = System.instance.maxTerrainImageryLayers;
    const layers = new Array<TerrainTexture[]>();
    let layerCount = 0;
    for (const texture of textures) {
      const layer = layers[texture.layerIndex];
      if (layer) {
        layer.push(texture);
      } else {
        layerCount++;
        layers[texture.layerIndex] = [texture];
      }
    }
    if (layerCount < 2) {
      // If only there is not more than one layer then we can group all of the textures into a single draw call.
      meshes.push(new TerrainMeshGeometry(terrainMesh._terrainMeshParams, TerrainTextureParams.create(textures), terrainMesh._transform, baseColor, baseTransparent));
    } else {
      const primaryLayer = layers.shift()!;
      for (const primaryTexture of primaryLayer) {
        const targetRectangle = primaryTexture.targetRectangle;
        const overlapMinimum = 1.0E-5 * (targetRectangle.high.x - targetRectangle.low.x) * (targetRectangle.high.y - targetRectangle.low.y);
        const layerTextures = [primaryTexture];
        for (const secondaryLayer of layers) {
          if (!secondaryLayer)
            continue;
          for (const secondaryTexture of secondaryLayer) {
            const secondaryRectangle = secondaryTexture.targetRectangle;
            const overlap = targetRectangle.intersect(secondaryRectangle, scratchOverlapRange);
            if (!overlap.isNull && (overlap.high.x - overlap.low.x) * (overlap.high.y - overlap.low.y) > overlapMinimum) {
              const textureRange = Range2d.createXYXY(overlap.low.x, overlap.low.y, overlap.high.x, overlap.high.y);
              secondaryRectangle.worldToLocal(textureRange.low, textureRange.low);
              secondaryRectangle.worldToLocal(textureRange.high, textureRange.high);

              if (secondaryTexture.clipRectangle)
                textureRange.intersect(secondaryTexture.clipRectangle, textureRange);

              if (!textureRange.isNull)
                layerTextures.push(new TerrainTexture(secondaryTexture.texture, secondaryTexture.featureId, secondaryTexture.scale, secondaryTexture.translate, secondaryTexture.targetRectangle, secondaryTexture.layerIndex, secondaryTexture.transparency, textureRange));
            }
            layerTextures.length = Math.min(layerTextures.length, texturesPerMesh);
            meshes.push(new TerrainMeshGeometry(terrainMesh._terrainMeshParams, TerrainTextureParams.create(layerTextures), terrainMesh._transform, baseColor, baseTransparent));
          }
        }
      }
    }

    if (meshes.length === 0)
      return undefined;

    const branch = new GraphicBranch(true);
    for (const mesh of meshes) {
      const primitive = Primitive.create(() => mesh);
      branch.add(system.createBatch(primitive!, featureTable, mesh.getRange(), tileId));
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

    if (target.nonLocatableTerrain && !target.drawNonLocatable)
      return RenderPass.None;

    if (target.terrainTransparency > 0.0 || this._baseIsTransparent || target.currentPlanarClassifier?.anyTranslucent  ||
      (target.wantThematicDisplay && target.uniforms.thematic.wantIsoLines))
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
