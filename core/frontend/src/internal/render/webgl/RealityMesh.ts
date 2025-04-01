/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, UintArray } from "@itwin/core-bentley";
import { CartographicRange, ColorDef, Quantization } from "@itwin/core-common";
import { Range2d, Range3d, Transform, Vector2d, Vector3d } from "@itwin/core-geometry";
import { GraphicBranch } from "../../../render/GraphicBranch.js";
import { MeshMapLayerGraphicParams } from "../MeshMapLayerGraphicParams.js";
import { RealityMeshParams } from "../../../render/RealityMeshParams.js";
import { RenderGraphic } from "../../../render/RenderGraphic.js";
import { RenderMemory } from "../../../render/RenderMemory.js";
import { RenderSystem, } from "../../../render/RenderSystem.js";
import { BufferHandle, BufferParameters, QBufferHandle2d, QBufferHandle3d } from "./AttributeBuffers.js";
import { AttributeMap } from "./AttributeMap.js";
import { IndexedGeometry, IndexedGeometryParams } from "./CachedGeometry.js";
import { GL } from "./GL.js";
import { Primitive } from "./Primitive.js";
import { RenderOrder } from "./RenderFlags.js";
import { System } from "./System.js";
import { Target } from "./Target.js";
import { TechniqueId } from "./TechniqueId.js";
import { RenderGeometry } from "../../../internal/render/RenderGeometry.js";
import { TerrainTexture } from "../RenderTerrain.js";
import { MapCartoRectangle, PlanarProjection, PlanarTilePatch } from "../../../tile/internal.js";
import { LayerTextureParams, ProjectedTexture } from "./MapLayerParams.js";

const scratchOverlapRange = Range2d.createNull();
type TerrainOrProjectedTexture = TerrainTexture | ProjectedTexture;

/** @internal */

export class RealityMeshGeometryParams extends IndexedGeometryParams {
  public readonly uvParams: QBufferHandle2d;
  public readonly featureID?: number;
  public readonly normals?: BufferHandle;
  public readonly numBytesPerIndex: 1 | 2 | 4;

  protected constructor(positions: QBufferHandle3d, normals: BufferHandle | undefined, uvParams: QBufferHandle2d, indices: BufferHandle, numIndices: number, numBytesPerIndex: 1 | 2 | 4, featureID?: number) {
    super(positions, indices, numIndices);
    this.numBytesPerIndex = numBytesPerIndex;
    let attrParams = AttributeMap.findAttribute("a_uvParam", TechniqueId.RealityMesh, false);
    assert(attrParams !== undefined);
    this.buffers.addBuffer(uvParams, [BufferParameters.create(attrParams.location, 2, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this.uvParams = uvParams;

    if (undefined !== normals) {
      attrParams = AttributeMap.findAttribute("a_norm", TechniqueId.RealityMesh, false);
      assert(attrParams !== undefined);
      if (normals.bytesUsed > 0)
        this.buffers.addBuffer(normals, [BufferParameters.create(attrParams.location, 2, GL.DataType.UnsignedByte, false, 0, 0, false)]);
      this.normals = normals;
    }
    this.featureID = featureID;
  }

  private static createFromBuffers(posBuf: QBufferHandle3d, uvParamBuf: QBufferHandle2d, indices: UintArray, normBuf: BufferHandle | undefined, featureID: number) {
    const indBuf = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indices);

    if (undefined === indBuf)
      return undefined;

    const bytesPerIndex = indices.BYTES_PER_ELEMENT;
    assert(1 === bytesPerIndex || 2 === bytesPerIndex || 4 === bytesPerIndex);
    return new RealityMeshGeometryParams(posBuf, normBuf, uvParamBuf, indBuf, indices.length, bytesPerIndex, featureID);

  }

  public static fromRealityMesh(params: RealityMeshParams) {
    const posBuf = QBufferHandle3d.create(params.positions.params, params.positions.points);
    const uvParamBuf = QBufferHandle2d.create(params.uvs.params, params.uvs.points);
    const normalBuf = params.normals ? BufferHandle.createArrayBuffer(params.normals) : undefined;
    return (undefined === posBuf || undefined === uvParamBuf) ? undefined : this.createFromBuffers(posBuf, uvParamBuf, params.indices, normalBuf, params.featureID ?? 0);
  }

  public override get isDisposed(): boolean {
    return super.isDisposed && this.uvParams.isDisposed;
  }
  public get bytesUsed(): number { return this.positions.bytesUsed + (undefined === this.normals ? 0 : this.normals.bytesUsed) + this.uvParams.bytesUsed + this.indices.bytesUsed; }

  public override[Symbol.dispose]() {
    super[Symbol.dispose]();
    dispose(this.uvParams);
  }
}

/** @internal */
export class RealityMeshGeometry extends IndexedGeometry implements RenderGeometry {
  public readonly renderGeometryType: "reality-mesh" = "reality-mesh" as const;
  public readonly isInstanceable = false;
  public noDispose = false;
  public readonly hasTextures: boolean;
  public override get asRealityMesh(): RealityMeshGeometry | undefined { return this; }
  public override get isDisposed(): boolean { return this._realityMeshParams.isDisposed; }
  public get uvQParams() { return this._realityMeshParams.uvParams.params; }
  public override get hasFeatures(): boolean { return this._realityMeshParams.featureID !== undefined; }
  public override get supportsThematicDisplay() { return true; }
  public get overrideColorMix() { return .5; }     // This could be a setting from either the mesh or the override if required.
  public get transform(): Transform | undefined { return this._transform; }

  private _realityMeshParams: RealityMeshGeometryParams;
  private readonly _indexType: GL.DataType;
  public textureParams: LayerTextureParams | undefined;
  private readonly _transform: Transform | undefined;
  public readonly baseColor: ColorDef | undefined;
  private _baseIsTransparent: boolean;
  private _isTerrain: boolean;
  private _disableTextureDisposal: boolean;

  private constructor(props: {
    realityMeshParams: RealityMeshGeometryParams;
    textureParams?: LayerTextureParams;
    transform?: Transform;
    baseColor?: ColorDef;
    baseIsTransparent: boolean;
    isTerrain: boolean;
    disableTextureDisposal: boolean;
  }) {
    super(props.realityMeshParams);
    this._realityMeshParams = props.realityMeshParams;
    this.textureParams = props.textureParams;
    this._transform = props.transform;
    this.baseColor = props.baseColor;
    this._baseIsTransparent = props.baseIsTransparent;
    this._isTerrain = props.isTerrain;
    this._disableTextureDisposal = props.disableTextureDisposal;
    this.hasTextures = undefined !== this.textureParams && this.textureParams.params.some((x) => undefined !== x.texture);

    const bytesPerIndex = props.realityMeshParams.numBytesPerIndex;
    this._indexType = 1 === bytesPerIndex ? GL.DataType.UnsignedByte : (2 === bytesPerIndex ? GL.DataType.UnsignedShort : GL.DataType.UnsignedInt);
  }

  public override[Symbol.dispose]() {
    if (this.noDispose) {
      return;
    }

    super[Symbol.dispose]();
    dispose(this._realityMeshParams);
    if (true !== this._disableTextureDisposal)
      dispose(this.textureParams);
  }

  public static createForTerrain(mesh: RealityMeshParams, transform: Transform | undefined, disableTextureDisposal = false) {
    const params = RealityMeshGeometryParams.fromRealityMesh(mesh);

    if (!params)
      return undefined;

    return new RealityMeshGeometry({
      realityMeshParams: params,
      transform,
      baseIsTransparent: false,
      isTerrain: true,
      disableTextureDisposal,
    });
  }

  public static createFromRealityMesh(realityMesh: RealityMeshParams, disableTextureDisposal = false): RealityMeshGeometry | undefined {
    const params = RealityMeshGeometryParams.fromRealityMesh(realityMesh);
    if (!params) return undefined;

    const { texture: meshTexture, featureID } = realityMesh;
    const tile = realityMesh.tileData;
    const layerClassifiers = tile?.layerClassifiers;
    const texture = meshTexture ? new TerrainTexture(meshTexture, featureID ?? 0, Vector2d.create(1.0, -1.0), Vector2d.create(0.0, 1.0), Range2d.createXYXY(0, 0, 1, 1), 0, 0) : undefined;

    if (!layerClassifiers?.size || !tile) return new RealityMeshGeometry({ realityMeshParams: params, textureParams: texture ? LayerTextureParams.create([texture]) : undefined, baseIsTransparent: false, isTerrain: false, disableTextureDisposal });

    const transformECEF = tile.ecefTransform

    const tileEcefRange = transformECEF.multiplyRange(tile.range);
    const cartographicRange = new  CartographicRange(tileEcefRange, transformECEF);
    const boundingBox = cartographicRange.getLongitudeLatitudeBoundingBox();
    const mapCartoRectangle = MapCartoRectangle.fromRadians(
      boundingBox.low.x,
      boundingBox.low.y,
      boundingBox.high.x,
      boundingBox.high.y
    );

    const corners = tile.range.corners();

    const normal = Vector3d.createCrossProductToPoints(corners[0], corners[1], corners[2])?.normalize();
    if (!normal) {
      return new RealityMeshGeometry({ realityMeshParams: params, textureParams: texture ? LayerTextureParams.create([texture]) : undefined, baseIsTransparent: false, isTerrain: false, disableTextureDisposal });
    }
    const chordHeight = corners[0].distance(corners[3]) / 2;

    const realityPlanarTilePatch = new PlanarTilePatch(corners, normal, chordHeight);
    const realityProjection = new PlanarProjection(realityPlanarTilePatch);

    const realityMeshParams: MeshMapLayerGraphicParams = {
      projection: realityProjection,
      tileRectangle: mapCartoRectangle,
      tileId: undefined,
      baseColor: undefined,
      baseTransparent: false,
      layerClassifiers
    };

    const layerTextures: TerrainOrProjectedTexture[] = texture ? [texture] : [];

    layerClassifiers?.forEach((layerClassifier, layerIndex) => layerTextures[layerIndex] = new ProjectedTexture(layerClassifier, realityMeshParams, realityMeshParams.tileRectangle));

    return new RealityMeshGeometry({ realityMeshParams: params, textureParams: layerTextures.length > 0 ? LayerTextureParams.create(layerTextures) : undefined, baseIsTransparent: false, isTerrain: false, disableTextureDisposal });
  }

  public getRange(): Range3d {
    return Range3d.createXYZXYZ(this.qOrigin[0], this.qOrigin[1], this.qOrigin[2], this.qOrigin[0] + Quantization.rangeScale16 * this.qScale[0], this.qOrigin[1] + Quantization.rangeScale16 * this.qScale[1], this.qOrigin[2] + Quantization.rangeScale16 * this.qScale[2]);
  }

  public static createGraphic(system: RenderSystem, params: MeshMapLayerGraphicParams, disableTextureDisposal = false): RenderGraphic | undefined {
    const meshes = [];
    const textures = params.textures ?? [];
    const realityMesh = params.realityMesh as RealityMeshGeometry;
    const { baseColor, baseTransparent, featureTable, tileId, layerClassifiers } = params;

    const texturesPerMesh = System.instance.maxRealityImageryLayers;
    const layers = new Array<(TerrainTexture | ProjectedTexture)[]>();
    // Collate the textures and classifiers layers into a single array.
    for (const texture of textures) {
      const layer = layers[texture.layerIndex];
      if (layer) {
        (layer as TerrainTexture[]).push(texture);
      } else {
        layers[texture.layerIndex] = [texture];
      }
    }
    params.layerClassifiers?.forEach((layerClassifier, layerIndex) => layers[layerIndex] = [new ProjectedTexture(layerClassifier, params, params.tileRectangle)]);

    if (layers.length < 2 && !layerClassifiers?.size && textures.length < texturesPerMesh) {
      // If only there is not more than one layer then we can group all of the textures into a single draw call.
      meshes.push(new RealityMeshGeometry({ realityMeshParams: realityMesh._realityMeshParams, textureParams: LayerTextureParams.create(textures), transform: realityMesh._transform, baseColor, baseIsTransparent: baseTransparent, isTerrain: realityMesh._isTerrain, disableTextureDisposal }));
    } else {
      let primaryLayer;
      while (primaryLayer === undefined)
        primaryLayer = layers.shift();
      if (!primaryLayer)
        return undefined;
      for (const primaryTexture of primaryLayer) {
        const targetRectangle = primaryTexture.targetRectangle;
        const overlapMinimum = 1.0E-5 * (targetRectangle.high.x - targetRectangle.low.x) * (targetRectangle.high.y - targetRectangle.low.y);
        let layerTextures = [primaryTexture];
        for (const secondaryLayer of layers) {
          if (!secondaryLayer)
            continue;
          for (const secondaryTexture of secondaryLayer) {
            if (secondaryTexture instanceof ProjectedTexture) {
              layerTextures.push(secondaryTexture.clone(targetRectangle));
            } else {
              const secondaryRectangle = secondaryTexture.targetRectangle;
              const overlap = targetRectangle.intersect(secondaryRectangle, scratchOverlapRange);
              if (!overlap.isNull && (overlap.high.x - overlap.low.x) * (overlap.high.y - overlap.low.y) > overlapMinimum) {
                const textureRange = Range2d.createXYXY(overlap.low.x, overlap.low.y, overlap.high.x, overlap.high.y);
                secondaryRectangle.worldToLocal(textureRange.low, textureRange.low);
                secondaryRectangle.worldToLocal(textureRange.high, textureRange.high);

                if (secondaryTexture.clipRectangle)
                  textureRange.intersect(secondaryTexture.clipRectangle, textureRange);

                if (!textureRange.isNull && textureRange) {
                  layerTextures.push(secondaryTexture.cloneWithClip(textureRange));
                }
              }
            }
          }
        }
        while (layerTextures.length > texturesPerMesh) {
          meshes.push(new RealityMeshGeometry({ realityMeshParams: realityMesh._realityMeshParams, textureParams: LayerTextureParams.create(layerTextures.slice(0, texturesPerMesh)), transform: realityMesh._transform, baseColor, baseIsTransparent: baseTransparent, isTerrain: realityMesh._isTerrain, disableTextureDisposal }));
          layerTextures = layerTextures.slice(texturesPerMesh);
        }
        meshes.push(new RealityMeshGeometry({ realityMeshParams: realityMesh._realityMeshParams, textureParams: LayerTextureParams.create(layerTextures), transform: realityMesh._transform, baseColor, baseIsTransparent: baseTransparent, isTerrain: realityMesh._isTerrain, disableTextureDisposal }));
      }
    }

    if (meshes.length === 0)
      return undefined;

    const branch = new GraphicBranch(true);
    for (const mesh of meshes) {
      const primitive = Primitive.create(mesh);
      if (featureTable) {
        branch.add(system.createBatch(primitive!, featureTable, mesh.getRange(), { tileId }));
      }
    }

    return system.createBranch(branch, realityMesh._transform ? realityMesh._transform : Transform.createIdentity(), { disableClipStyle: params.disableClipStyle });
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._isTerrain ? stats.addTerrain(this._realityMeshParams.bytesUsed) : stats.addRealityMesh(this._realityMeshParams.bytesUsed);
    if (this.textureParams?.params) {
      for (const param of this.textureParams.params) {
        if (param.texture?.bytesUsed)
          stats.addTexture(param.texture.bytesUsed);
      }
    }
  }

  public get techniqueId(): TechniqueId { return TechniqueId.RealityMesh; }

  public override getPass(target: Target) {
    if (this._baseIsTransparent || (target.wantThematicDisplay && target.uniforms.thematic.wantIsoLines))
      return "translucent";

    return "opaque";
  }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }

  public override draw(): void {
    this._params.buffers.bind();
    System.instance.context.drawElements(GL.PrimitiveType.Triangles, this._params.numIndices, this._indexType, 0);
    this._params.buffers.unbind();
  }
}
