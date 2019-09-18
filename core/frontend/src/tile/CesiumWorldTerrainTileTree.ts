
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { IModelConnection } from "../IModelConnection";
import { assert, ClientRequestContext, JsonUtils, Id64String } from "@bentley/bentleyjs-core";
import { TerrainTileLoaderBase, MapTileGeometryAttributionProvider, QuadId, MapTileTreeReference } from "./WebMapTileTree";
import { TileRequest } from "./TileRequest";
import { Tile } from "./Tile";
import { TileIO } from "./TileIO";
import { request, Response, RequestOptions } from "@bentley/imodeljs-clients";
import { Range1d, Range3d, Point3d, BilinearPatch, Vector3d } from "@bentley/geometry-core";
import { QParams3d, QPoint3d, ColorDef, OctEncodedNormal, LinePixels, FillFlags, RenderMaterial, FeatureIndexType } from "@bentley/imodeljs-common";
import { Triangle } from "../render/primitives/Primitives";
import { IModelApp } from "../IModelApp";
import { Mesh, MeshArgs } from "../render/primitives/mesh/MeshPrimitives";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { MeshParams } from "../render/primitives/VertexTable";
import { GeographicTilingScheme } from "./MapTilingScheme";
import { ScreenViewport } from "../Viewport";
import { MapTile } from "./MapTileTree";

/** @internal */
enum QuantizedMeshExtensionIds {
  OctEncodedNormals = 1,
  WaterMask = 2,
  Metadata = 4,
}

/** @internal */
export async function getCesiumWorldTerrainLoader(iModel: IModelConnection, modelId: Id64String, groundBias: number, heightRange: Range1d): Promise<TerrainTileLoaderBase | undefined> {
  const _requestContext = new ClientRequestContext("");
  const _requestTemplate = "https://api.cesium.com/v1/assets/1/endpoint?access_token={CesiumRequestToken}";
  // TBD... this key is generated for RBB personal account - change to enterprise license from Cesium.
  const _requestKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkZWIxNzk1OC0wNmVjLTQ1NDItOTBlYS1lOTViMDljNzQyNWUiLCJpZCI6MTQwLCJzY29wZXMiOlsiYXNsIiwiYXNyIiwiYXN3IiwiZ2MiXSwiaWF0IjoxNTYyMDA0NTYwfQ.VyMP5TPl--eX2bCQjIY7ijfPCd-J0sSPnEFj_mfPC3k";
  let _endPointUrl;
  let _accessToken;
  let layers;
  const apiUrl: string = _requestTemplate.replace("{CesiumRequestToken}", _requestKey);
  const apiRequestOptions: RequestOptions = { method: "GET", responseType: "json" };

  try {
    const apiResponse: Response = await request(_requestContext, apiUrl, apiRequestOptions);
    if (undefined === apiResponse || undefined === apiResponse.body || undefined === apiResponse.body.url) {
      assert(false);
      return undefined;
    }
    _endPointUrl = apiResponse.body.url;
    _accessToken = apiResponse.body.accessToken;

    const layerRequestOptions: RequestOptions = { method: "GET", responseType: "json", headers: { authorization: "Bearer " + _accessToken } };
    const layerUrl = _endPointUrl + "layer.json";
    const layerResponse = await request(_requestContext, layerUrl, layerRequestOptions);
    if (undefined === layerResponse) {
      assert(false);
      return undefined;
    }
    layers = layerResponse.body;

  } catch (error) {
    assert(false);
    return undefined;
  }
  if (undefined === layers.tiles || undefined === layers.version) {
    assert(false);
    return undefined;
  }

  let tileUrlTemplate = _endPointUrl + layers.tiles[0].replace("{version}", layers.version);
  tileUrlTemplate = tileUrlTemplate.replace("?", "?extensions=octvertexnormals-watermask-metadata&");
  const maxDepth = JsonUtils.asInt(layers.maxzoom, 19);

  // TBD -- When we have  an API extract the heights for the project from the terrain tiles - for use temporary Bing elevation.
  return new CesiumWorldTerrainTileLoader(iModel, modelId, groundBias, _requestContext, _accessToken, tileUrlTemplate, maxDepth, heightRange);
}
function zigZagDecode(value: number) {
  return (value >> 1) ^ (-(value & 1));
}
/**
 * Decodes delta and ZigZag encoded vertices. This modifies the buffers in place.
 *
 * @see {@link https://github.com/AnalyticalGraphicsInc/quantized-mesh|quantized-mesh-1.0 terrain format}
 */
function zigZagDeltaDecode(uBuffer: Uint16Array, vBuffer: Uint16Array, heightBuffer: Uint16Array) {
  const count = uBuffer.length;
  let u = 0;
  let v = 0;
  let height = 0;

  for (let i = 0; i < count; ++i) {
    u += zigZagDecode(uBuffer[i]);
    v += zigZagDecode(vBuffer[i]);

    uBuffer[i] = u;
    vBuffer[i] = v;

    height += zigZagDecode(heightBuffer[i]);
    heightBuffer[i] = height;
  }
}

function getIndexArray(vertexCount: number, streamBuffer: TileIO.StreamBuffer, indexCount: number): Uint16Array | Uint32Array {
  const indicesAre32Bit = vertexCount > 64 * 1024;
  const indexArray = (indicesAre32Bit) ? new Uint32Array(streamBuffer.arrayBuffer, streamBuffer.curPos, indexCount) : new Uint16Array(streamBuffer.arrayBuffer, streamBuffer.curPos, indexCount);
  streamBuffer.advance(indexCount * (indicesAre32Bit ? Uint32Array.BYTES_PER_ELEMENT : Uint16Array.BYTES_PER_ELEMENT));
  return indexArray;
}

/** @internal */
export class CesiumWorldTerrainTileLoader extends TerrainTileLoaderBase {
  private readonly _copyrightImagesByViewportId = new Map<number, HTMLImageElement>();
  private static _scratchRange = Range3d.createNull();
  private static _scratchVertex = Point3d.createZero();
  private static _scratchQParams = QParams3d.fromRange(CesiumWorldTerrainTileLoader._scratchRange);
  private static _scratchQPoint = QPoint3d.create(CesiumWorldTerrainTileLoader._scratchVertex, CesiumWorldTerrainTileLoader._scratchQParams);
  private static _scratchMeshArgs = new MeshArgs();
  private static _scratchPoint = Point3d.createZero();
  private static _scratchTriangle = new Triangle();
  private static _scratchNormal = Vector3d.createZero();

  constructor(iModel: IModelConnection, modelId: Id64String, groundBias: number, private _requestContext: ClientRequestContext, private _accessToken: string, private _tileUrlTemplate: string, private _maxDepth: number, heightRange: Range1d) {
    super(iModel, modelId, groundBias, new GeographicTilingScheme(), heightRange);
  }
  public getAttribution(_tileProvider: MapTileTreeReference, _viewport: ScreenViewport): string {
    return (IModelApp.i18n.translate("iModelJs:BackgroundMap.CesiumWorldTerrainAttribution"));
  }
  public addCopyrightImages(images: HTMLImageElement[], _tileProvider: MapTileTreeReference, viewport: ScreenViewport): void {
    let image = this._copyrightImagesByViewportId.get(viewport.viewportId);
    if (undefined === image) {
      image = new Image();
      image.src = "images/ion_color_white.png";
      image.width = 173;
      image.height = 30;
      this._copyrightImagesByViewportId.set(viewport.viewportId, image);
    }

    images.unshift(image);
  }
  public get maxDepth(): number { return this._maxDepth; }
  public get geometryAttributionProvider(): MapTileGeometryAttributionProvider { return this; }
  public async loadTileContent(tile: Tile, data: TileRequest.ResponseData, isCanceled?: () => boolean): Promise<Tile.Content> {
    if (undefined === isCanceled)
      isCanceled = () => !tile.isLoading;

    assert(data instanceof Uint8Array);
    const system = IModelApp.renderSystem;
    const blob = data as Uint8Array;
    const streamBuffer: TileIO.StreamBuffer = new TileIO.StreamBuffer(blob.buffer);
    const center = streamBuffer.nextPoint3d64;
    const quadId = QuadId.createFromContentId(tile.contentId);
    const skirtHeight = this.getLevelMaximumGeometricError(quadId.level) * 10.0;
    const minHeight = this._groundBias + streamBuffer.nextFloat32;
    const maxHeight = this._groundBias + streamBuffer.nextFloat32;
    const boundCenter = streamBuffer.nextPoint3d64;
    const boundRadius = streamBuffer.nextFloat64;
    const horizonOcclusion = streamBuffer.nextPoint3d64;
    const mapTile = tile as MapTile;
    if (undefined !== mapTile) {
      await mapTile.reprojectCorners();
      mapTile.adjustHeights(minHeight, maxHeight);
    }

    if (undefined === center || undefined === boundCenter || undefined === boundRadius || undefined === horizonOcclusion) { }
    const vertexCount = streamBuffer.nextUint32;
    const encodedVertexBuffer = new Uint16Array(blob.buffer, streamBuffer.curPos, vertexCount * 3);
    streamBuffer.advance(vertexCount * 6);

    const uBuffer = encodedVertexBuffer.subarray(0, vertexCount);
    const vBuffer = encodedVertexBuffer.subarray(vertexCount, 2 * vertexCount);
    const heightBuffer = encodedVertexBuffer.subarray(vertexCount * 2, 3 * vertexCount);

    zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer);

    let bytesPerIndex = Uint16Array.BYTES_PER_ELEMENT;
    const triangleElements = 3;

    if (vertexCount > 64 * 1024) {
      // More than 64k vertices, so indices are 32-bit.
      bytesPerIndex = Uint32Array.BYTES_PER_ELEMENT;
    }

    // skip over any additional padding that was added for 2/4 byte alignment
    if (streamBuffer.curPos % bytesPerIndex !== 0)
      streamBuffer.advance(bytesPerIndex - (streamBuffer.curPos % bytesPerIndex));

    const triangleCount = streamBuffer.nextUint32;
    const indexCount = triangleCount * triangleElements;

    const indices = getIndexArray(vertexCount, streamBuffer, indexCount);
    // High water mark decoding based on decompressIndices_ in webgl-loader's loader.js.
    // https://code.google.com/p/webgl-loader/source/browse/trunk/samples/loader.js?r=99#55
    // Copyright 2012 Google Inc., Apache 2.0 license.
    let highest = 0;
    const length = indices.length;
    for (let i = 0; i < length; ++i) {
      const code = indices[i];
      indices[i] = highest - code;
      if (code === 0) {
        ++highest;
      }
    }
    const corners = (tile as any).corners;
    const patch = new BilinearPatch(corners[0], corners[1], corners[2], corners[3]);
    const materialParams = new RenderMaterial.Params();
    const color = ColorDef.white.clone();
    materialParams.diffuseColor = materialParams.specularColor = color;
    materialParams.diffuse = 0.8;
    materialParams.specular = 0.0;

    const material = system.createMaterial(materialParams, this._iModel);
    const displayParams = new DisplayParams(DisplayParams.Type.Mesh, color, color, 0.0, LinePixels.Solid, FillFlags.None, material);
    CesiumWorldTerrainTileLoader._scratchRange.setNull();
    CesiumWorldTerrainTileLoader._scratchRange.extendArray(corners);
    CesiumWorldTerrainTileLoader._scratchRange.low.z = minHeight - skirtHeight;
    CesiumWorldTerrainTileLoader._scratchRange.high.z = maxHeight;

    CesiumWorldTerrainTileLoader._scratchQParams.setFromRange(CesiumWorldTerrainTileLoader._scratchRange);
    const mesh = Mesh.create({ displayParams, type: Mesh.PrimitiveType.Mesh, range: CesiumWorldTerrainTileLoader._scratchRange, isPlanar: false, is2d: false });
    for (let i = 0; i < indexCount;)
      this.addTriangle(mesh, indices[i++], indices[i++], indices[i++]);

    const uvScale = 1.0 / 32767.0;
    const heightScale = uvScale * (maxHeight - minHeight);

    const westVertexCount = streamBuffer.nextUint32;
    const westIndices = getIndexArray(vertexCount, streamBuffer, westVertexCount);

    const southVertexCount = streamBuffer.nextUint32;
    const southIndices = getIndexArray(vertexCount, streamBuffer, southVertexCount);

    const eastVertexCount = streamBuffer.nextUint32;
    const eastIndices = getIndexArray(vertexCount, streamBuffer, eastVertexCount);

    const northVertexCount = streamBuffer.nextUint32;
    const northIndices = getIndexArray(vertexCount, streamBuffer, northVertexCount);

    // Extensions...
    let encodedNormalsBuffer;
    let waterMaskBuffer;
    while (streamBuffer.curPos < streamBuffer.length) {
      const extensionId = streamBuffer.nextUint8;
      const extensionLength = streamBuffer.nextUint32;
      switch (extensionId) {
        case QuantizedMeshExtensionIds.OctEncodedNormals:
          assert(vertexCount * 2 === extensionLength);
          encodedNormalsBuffer = new Uint8Array(streamBuffer.arrayBuffer, streamBuffer.curPos, extensionLength);
          break;

        case QuantizedMeshExtensionIds.WaterMask:
          waterMaskBuffer = new Uint8Array(streamBuffer.arrayBuffer, streamBuffer.curPos, extensionLength);
          break;
        default:
          break;
      }
      streamBuffer.advance(extensionLength);
    }
    if (undefined !== encodedNormalsBuffer) {
    }

    if (undefined !== waterMaskBuffer) {
    }

    const worldToEcef = tile.iModel.getEcefTransform().matrix;
    const fillColor = 0xffffff;
    for (let i = 0; i < vertexCount; i++) {
      patch.uvFractionToPoint(uvScale * uBuffer[i], uvScale * vBuffer[i], CesiumWorldTerrainTileLoader._scratchPoint);
      CesiumWorldTerrainTileLoader._scratchPoint.z = minHeight + heightBuffer[i] * heightScale;
      CesiumWorldTerrainTileLoader._scratchQPoint.init(CesiumWorldTerrainTileLoader._scratchPoint, CesiumWorldTerrainTileLoader._scratchQParams);
      if (encodedNormalsBuffer) {
        const normalIndex = i * 2;
        OctEncodedNormal.decodeValue(encodedNormalsBuffer[normalIndex + 1] << 8 | encodedNormalsBuffer[normalIndex], CesiumWorldTerrainTileLoader._scratchNormal);
        worldToEcef.multiplyTransposeVector(CesiumWorldTerrainTileLoader._scratchNormal, CesiumWorldTerrainTileLoader._scratchNormal);
        CesiumWorldTerrainTileLoader._scratchNormal.negate(CesiumWorldTerrainTileLoader._scratchNormal);
        mesh.addVertex({ position: CesiumWorldTerrainTileLoader._scratchQPoint, fillColor, normal: OctEncodedNormal.fromVector(CesiumWorldTerrainTileLoader._scratchNormal) });
      } else {
        mesh.addVertex({ position: CesiumWorldTerrainTileLoader._scratchQPoint, fillColor });
      }
    }
    westIndices.sort((a, b) => vBuffer[a] - vBuffer[b]);
    eastIndices.sort((a, b) => vBuffer[a] - vBuffer[b]);
    northIndices.sort((a, b) => uBuffer[a] - uBuffer[b]);
    southIndices.sort((a, b) => uBuffer[a] - uBuffer[b]);
    this.generateSkirts(mesh, westIndices, skirtHeight);
    this.generateSkirts(mesh, eastIndices, skirtHeight);
    this.generateSkirts(mesh, southIndices, skirtHeight);
    this.generateSkirts(mesh, northIndices, skirtHeight);

    CesiumWorldTerrainTileLoader._scratchMeshArgs.init(mesh);
    CesiumWorldTerrainTileLoader._scratchMeshArgs.features.featureID = 0;
    CesiumWorldTerrainTileLoader._scratchMeshArgs.features.type = FeatureIndexType.Uniform;
    CesiumWorldTerrainTileLoader._scratchMeshArgs.hasFixedNormals = true;
    let graphic = system.createMesh(MeshParams.create(CesiumWorldTerrainTileLoader._scratchMeshArgs));
    if (graphic)
      graphic = system.createBatch(graphic, this._featureTable, Range3d.createNull());

    const content: Tile.Content = { graphic, contentRange: CesiumWorldTerrainTileLoader._scratchRange.clone() };
    return content;
  }
  private addTriangle(mesh: Mesh, i0: number, i1: number, i2: number) {
    CesiumWorldTerrainTileLoader._scratchTriangle.setIndices(i0, i1, i2);
    mesh.addTriangle(CesiumWorldTerrainTileLoader._scratchTriangle);
  }
  private generateSkirts(mesh: Mesh, indices: Uint16Array | Uint32Array, skirtHeight: number) {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      mesh.points.unquantize(index, CesiumWorldTerrainTileLoader._scratchPoint);
      const normal = mesh.normals.length ? mesh.normals[index] : undefined;
      CesiumWorldTerrainTileLoader._scratchPoint.z -= skirtHeight;
      CesiumWorldTerrainTileLoader._scratchQPoint.init(CesiumWorldTerrainTileLoader._scratchPoint, CesiumWorldTerrainTileLoader._scratchQParams);
      mesh.addVertex({ position: CesiumWorldTerrainTileLoader._scratchQPoint, fillColor: 0xffffff, normal });

      if (i) {
        this.addTriangle(mesh, index, indices[i - 1], mesh.points.length - 2);
        this.addTriangle(mesh, index, mesh.points.length - 2, mesh.points.length - 1);
      }
    }
  }

  public async requestTileContent(tile: Tile, _isCanceled: () => boolean): Promise<TileRequest.Response> {
    const quadId = QuadId.createFromContentId(tile.contentId);
    const terrainLevel = quadId.level - 1;
    if (terrainLevel < 0) return undefined;     // Root...

    const tileUrl = this._tileUrlTemplate.replace("{z}", (quadId.level - 1).toString()).replace("{x}", quadId.column.toString()).replace("{y}", quadId.row.toString());
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer", headers: { authorization: "Bearer " + this._accessToken }, accept: "application/vnd.quantized-mesh;extensions=octvertexnormals,application/octet-stream;q=0.9,*/*;q=0.01" };

    try {
      const response = await request(this._requestContext, tileUrl, tileRequestOptions);
      if (response.status === 200)
        return new Uint8Array(response.body);

      return undefined;

    } catch (error) {
      return undefined;
    }
  }
  /**
   * Specifies the quality of terrain created from heightmaps.  A value of 1.0 will
   * ensure that adjacent heightmap vertices are separated by no more than
   * screen pixels and will probably go very slowly.
   * A value of 0.5 will cut the estimated level zero geometric error in half, allowing twice the
   * screen pixels between adjacent heightmap vertices and thus rendering more quickly.
   * @type {Number}
   */
  public readonly heightmapTerrainQuality = 0.25;

  /**
   * Determines an appropriate geometric error estimate when the geometry comes from a heightmap.
   *
   * @param {Ellipsoid} ellipsoid The ellipsoid to which the terrain is attached.
   * @param {Number} tileImageWidth The width, in pixels, of the heightmap associated with a single tile.
   * @param {Number} numberOfTilesAtLevelZero The number of tiles in the horizontal direction at tile level zero.
   * @returns {Number} An estimated geometric error.
   */
  public getEstimatedLevelZeroGeometricErrorForAHeightmap(ellipsoidMaximumRadius = 6378137, tileImageWidth = 65, numberOfTilesAtLevelZero = 2) {
    return ellipsoidMaximumRadius * 2 * Math.PI * this.heightmapTerrainQuality / (tileImageWidth * numberOfTilesAtLevelZero);
  }

  public getLevelMaximumGeometricError(level: number) {
    return this.getEstimatedLevelZeroGeometricErrorForAHeightmap() / (1 << level);
  }
}
