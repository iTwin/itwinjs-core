/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tiles
 */
import { assert, BeDuration, BeTimePoint, ByteStream, JsonUtils, utf8ToString } from "@itwin/core-bentley";
import { Point2d, Point3d, Range1d, Vector3d } from "@itwin/core-geometry";
import { CesiumTerrainAssetId, nextPoint3d64FromByteStream, OctEncodedNormal, QPoint2d } from "@itwin/core-common";
import { MessageSeverity } from "@itwin/appui-abstract";
import { request, RequestOptions } from "../../request/Request";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { IModelApp } from "../../IModelApp";
import { RealityMeshParams, RealityMeshParamsBuilder } from "../../render/RealityMeshParams";
import {
  GeographicTilingScheme, MapTile, MapTilingScheme, QuadId, ReadMeshArgs, RequestMeshDataArgs, TerrainMeshProvider,
  TerrainMeshProviderOptions, Tile, TileAvailability,
} from "../internal";

/** @internal */
enum QuantizedMeshExtensionIds {
  OctEncodedNormals = 1,
  WaterMask = 2,
  Metadata = 4,
}

/** Return the URL for a Cesium ION asset from its asset ID and request Key.
 * @public
 */
export function getCesiumAssetUrl(osmAssetId: number, requestKey: string): string {
  return `$CesiumIonAsset=${osmAssetId}:${requestKey}`;
}
/** @internal */
export function getCesiumOSMBuildingsUrl(): string | undefined {
  const key = IModelApp.tileAdmin.cesiumIonKey;
  if (undefined === key)
    return undefined;

  const osmBuildingAssetId = 96188;
  return getCesiumAssetUrl(osmBuildingAssetId, key);
}

/** @internal */
export async function getCesiumAccessTokenAndEndpointUrl(assetId: string, requestKey?: string): Promise<{ token?: string, url?: string }> {
  if (undefined === requestKey) {
    requestKey = IModelApp.tileAdmin.cesiumIonKey;
    if (undefined === requestKey)
      return {};
  }

  const requestTemplate = `https://api.cesium.com/v1/assets/${assetId}/endpoint?access_token={CesiumRequestToken}`;
  const apiUrl: string = requestTemplate.replace("{CesiumRequestToken}", requestKey);

  try {
    const apiResponse = await request(apiUrl, "json");
    if (undefined === apiResponse || undefined === apiResponse.url) {
      assert(false);
      return {};
    }
    return { token: apiResponse.accessToken, url: apiResponse.url };
  } catch (error) {
    assert(false);
    return {};
  }
}

let notifiedTerrainError = false;

// Notify - once per session - of failure to obtain Cesium terrain provider.
function notifyTerrainError(detailedDescription?: string): void {
  if (notifiedTerrainError)
    return;

  notifiedTerrainError = true;
  IModelApp.notifications.displayMessage(MessageSeverity.Information, IModelApp.localization.getLocalizedString(`iModelJs:BackgroundMap.CannotObtainTerrain`), detailedDescription);
}

/** @internal */
export async function getCesiumTerrainProvider(opts: TerrainMeshProviderOptions): Promise<TerrainMeshProvider | undefined> {
  const accessTokenAndEndpointUrl = await getCesiumAccessTokenAndEndpointUrl(opts.dataSource || CesiumTerrainAssetId.Default);
  if (!accessTokenAndEndpointUrl.token || !accessTokenAndEndpointUrl.url) {
    notifyTerrainError(IModelApp.localization.getLocalizedString(`iModelJs:BackgroundMap.MissingCesiumToken`));
    return undefined;
  }

  let layers;
  try {
    const layerRequestOptions: RequestOptions = { headers: { authorization: `Bearer ${accessTokenAndEndpointUrl.token}` } };
    const layerUrl = `${accessTokenAndEndpointUrl.url}layer.json`;
    layers = await request(layerUrl, "json", layerRequestOptions);
  } catch (error) {
    notifyTerrainError();
    return undefined;
  }

  if (undefined === layers || undefined === layers.tiles || undefined === layers.version) {
    notifyTerrainError();
    return undefined;
  }

  const tilingScheme = new GeographicTilingScheme();
  let tileAvailability;
  if (undefined !== layers.available) {
    const availableTiles = layers.available;
    tileAvailability = new TileAvailability(tilingScheme, availableTiles.length);
    for (let level = 0; level < layers.available.length; level++) {
      const rangesAtLevel = availableTiles[level];
      for (const range of rangesAtLevel) {
        tileAvailability.addAvailableTileRange(level, range.startX, range.startY, range.endX, range.endY);
      }
    }
  }

  let tileUrlTemplate = accessTokenAndEndpointUrl.url + layers.tiles[0].replace("{version}", layers.version);
  if (opts.wantNormals)
    tileUrlTemplate = tileUrlTemplate.replace("?", "?extensions=octvertexnormals-watermask-metadata&");

  const maxDepth = JsonUtils.asInt(layers.maxzoom, 19);

  // TBD -- When we have  an API extract the heights for the project from the terrain tiles - for use temporary Bing elevation.
  return new CesiumTerrainProvider(opts, accessTokenAndEndpointUrl.token, tileUrlTemplate, maxDepth, tilingScheme, tileAvailability, layers.metadataAvailability);
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

/** @internal */
class CesiumTerrainProvider extends TerrainMeshProvider {
  private _accessToken: string;
  private readonly _tileUrlTemplate: string;
  private readonly _maxDepth: number;
  private readonly _wantSkirts: boolean;
  private readonly _tilingScheme: MapTilingScheme;
  private readonly _tileAvailability?: TileAvailability;
  private readonly _metaDataAvailableLevel?: number;
  private readonly _exaggeration: number;
  private readonly _assetId: string;

  private static _scratchQPoint2d = QPoint2d.fromScalars(0, 0);
  private static _scratchPoint2d = Point2d.createZero();
  private static _scratchPoint = Point3d.createZero();
  private static _scratchNormal = Vector3d.createZero();
  private static _scratchHeightRange = Range1d.createNull();
  private static _tokenTimeoutInterval = BeDuration.fromSeconds(60 * 30);      // Request a new access token every 30 minutes...
  private _tokenTimeOut: BeTimePoint;

  public override forceTileLoad(tile: Tile): boolean {
    // Force loading of the metadata availability tiles as these are required for determining the availability of descendants.
    const mapTile = tile as MapTile;
    return undefined !== this._metaDataAvailableLevel && mapTile.quadId.level === this._metaDataAvailableLevel && !mapTile.everLoaded;
  }

  constructor(opts: TerrainMeshProviderOptions, accessToken: string, tileUrlTemplate: string, maxDepth: number, tilingScheme: MapTilingScheme,
    tileAvailability: TileAvailability | undefined, metaDataAvailableLevel: number | undefined) {
    super();
    this._wantSkirts = opts.wantSkirts;
    this._exaggeration = opts.exaggeration;

    this._accessToken = accessToken;
    this._tileUrlTemplate = tileUrlTemplate;
    this._maxDepth = maxDepth;
    this._tilingScheme = tilingScheme;
    this._tileAvailability = tileAvailability;
    this._metaDataAvailableLevel = metaDataAvailableLevel;
    this._assetId = opts.dataSource || CesiumTerrainAssetId.Default;

    this._tokenTimeOut = BeTimePoint.now().plus(CesiumTerrainProvider._tokenTimeoutInterval);
  }

  public override addLogoCards(cards: HTMLTableElement): void {
    if (cards.dataset.cesiumIonLogoCard)
      return;

    cards.dataset.cesiumIonLogoCard = "true";
    let notice = IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap.CesiumWorldTerrainAttribution");
    if (this._assetId === CesiumTerrainAssetId.Bathymetry)
      notice = `${notice}\n${IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap.CesiumBathymetryAttribution")}`;

    const card = IModelApp.makeLogoCard({ iconSrc: `${IModelApp.publicPath}images/cesium-ion.svg`, heading: "Cesium Ion", notice });
    cards.appendChild(card);
  }

  public get maxDepth(): number { return this._maxDepth; }
  public get tilingScheme(): MapTilingScheme { return this._tilingScheme; }

  public override isTileAvailable(quadId: QuadId) {
    if (quadId.level > this.maxDepth)
      return false;

    return this._tileAvailability ? this._tileAvailability.isTileAvailable(quadId.level, quadId.column, quadId.row) : true;
  }

  public override async requestMeshData(args: RequestMeshDataArgs): Promise<Uint8Array | undefined> {
    const tile = args.tile;
    const quadId = tile.quadId;
    const tileUrl = this.constructUrl(quadId.row, quadId.column, quadId.level);
    const requestOptions: RequestOptions = {
      headers: {
        authorization: `Bearer ${this._accessToken}`,
        accept: "application/vnd.quantized-mesh;" /* extensions=octvertexnormals, */ + "application/octet-stream;q=0.9,*/*;q=0.01",
      },
    };

    try {
      const response = await request(tileUrl, "arraybuffer", requestOptions);
      return new Uint8Array(response);
    } catch (_) {
      return undefined;
    }
  }

  public override async readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined> {
    // ###TODO why does he update the access token when reading the mesh instead of when requesting it?
    // This function only returns undefined if it fails to acquire token - but it doesn't need the token...
    if (BeTimePoint.now().milliseconds > this._tokenTimeOut.milliseconds) {
      const accessTokenAndEndpointUrl = await getCesiumAccessTokenAndEndpointUrl(this._assetId);
      if (!accessTokenAndEndpointUrl.token || args.isCanceled())
        return undefined;

      this._accessToken = accessTokenAndEndpointUrl.token;
      this._tokenTimeOut = BeTimePoint.now().plus(CesiumTerrainProvider._tokenTimeoutInterval);
    }

    const { data, tile } = args;
    assert(data instanceof Uint8Array);
    assert(tile instanceof MapTile);

    const blob = data;
    const streamBuffer = ByteStream.fromUint8Array(blob);
    const center = nextPoint3d64FromByteStream(streamBuffer);
    const quadId = QuadId.createFromContentId(tile.contentId);
    const skirtHeight = this.getLevelMaximumGeometricError(quadId.level + 1) * 10.0;  // Add 1 to level to restore height calculation to before the quadId level was from root. (4326 unification)
    const minHeight = this._exaggeration * streamBuffer.readFloat32();
    const maxHeight = this._exaggeration * streamBuffer.readFloat32();
    const boundCenter = nextPoint3d64FromByteStream(streamBuffer);
    const boundRadius = streamBuffer.readFloat64();
    const horizonOcclusion = nextPoint3d64FromByteStream(streamBuffer);
    const terrainTile = tile;

    terrainTile.adjustHeights(minHeight, maxHeight);

    if (undefined === center || undefined === boundCenter || undefined === boundRadius || undefined === horizonOcclusion) { }
    const pointCount = streamBuffer.readUint32();
    const encodedVertexBuffer = new Uint16Array(blob.buffer, streamBuffer.curPos, pointCount * 3);
    streamBuffer.advance(pointCount * 6);

    const uBuffer = encodedVertexBuffer.subarray(0, pointCount);
    const vBuffer = encodedVertexBuffer.subarray(pointCount, 2 * pointCount);
    const heightBuffer = encodedVertexBuffer.subarray(pointCount * 2, 3 * pointCount);

    zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer);

    // ###TODO: This alleges to handle 32-bit indices, but RealityMeshParams uses a Uint16Array to store indices...
    const typedArray = pointCount > 0xffff ? Uint32Array : Uint16Array;
    const bytesPerIndex = typedArray.BYTES_PER_ELEMENT;
    const triangleElements = 3;

    // skip over any additional padding that was added for 2/4 byte alignment
    if (streamBuffer.curPos % bytesPerIndex !== 0)
      streamBuffer.advance(bytesPerIndex - (streamBuffer.curPos % bytesPerIndex));

    const triangleCount = streamBuffer.readUint32();
    const indexCount = triangleCount * triangleElements;

    const getIndexArray = (numIndices: number) => {
      const indexArray = new typedArray(streamBuffer.arrayBuffer, streamBuffer.curPos, numIndices);
      streamBuffer.advance(numIndices * bytesPerIndex);
      return indexArray;
    };

    const indices = getIndexArray(indexCount);

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

    CesiumTerrainProvider._scratchHeightRange.low = minHeight - skirtHeight;
    CesiumTerrainProvider._scratchHeightRange.high = maxHeight;
    const projection = terrainTile.getProjection(CesiumTerrainProvider._scratchHeightRange);
    const uvScale = 1.0 / 32767.0;
    const heightScale = uvScale * (maxHeight - minHeight);

    const westCount = streamBuffer.readUint32(),
      westIndices = getIndexArray(westCount),
      southCount = streamBuffer.readUint32(),
      southIndices = getIndexArray(southCount),
      eastCount = streamBuffer.readUint32(),
      eastIndices = getIndexArray(eastCount),
      northCount = streamBuffer.readUint32(),
      northIndices = getIndexArray(northCount);

    // Extensions...
    let encodedNormalsBuffer;
    while (streamBuffer.curPos < streamBuffer.length) {
      const extensionId = streamBuffer.readUint8();
      const extensionLength = streamBuffer.readUint32();
      switch (extensionId) {
        case QuantizedMeshExtensionIds.OctEncodedNormals:
          assert(pointCount * 2 === extensionLength);
          encodedNormalsBuffer = new Uint8Array(streamBuffer.arrayBuffer, streamBuffer.curPos, extensionLength);
          streamBuffer.advance(extensionLength);
          break;

        case QuantizedMeshExtensionIds.Metadata:
          const stringLength = streamBuffer.readUint32();
          if (stringLength > 0) {
            const strData = streamBuffer.nextBytes(stringLength);
            const str = utf8ToString(strData);
            if (undefined !== str) {
              const metaData = JSON.parse(str);
              if (undefined !== metaData.available && undefined !== this._tileAvailability) {
                const availableTiles = metaData.available;
                for (let offset = 0; offset < availableTiles.length; ++offset) {
                  const availableLevel = tile.depth + offset;     // Our depth is includes root (1 + cesium Depth)
                  const rangesAtLevel = availableTiles[offset];

                  for (const range of rangesAtLevel)
                    this._tileAvailability.addAvailableTileRange(availableLevel, range.startX, range.startY, range.endX, range.endY);
                }
              }
            }
          }

          break;
        default:
          streamBuffer.advance(extensionLength);
          break;
      }
    }

    let initialIndexCapacity = indexCount;
    let initialVertexCapacity = pointCount;
    if (this._wantSkirts) {
      initialIndexCapacity += 6 * (Math.max(0, northCount - 1) + Math.max(0, southCount - 1) + Math.max(0, eastCount - 1) + Math.max(0, westCount - 1));
      initialVertexCapacity += (northCount + southCount + eastCount + westCount);
    }

    const wantNormals = undefined !== encodedNormalsBuffer;
    const builder = new RealityMeshParamsBuilder({
      positionRange: projection.localRange,
      initialIndexCapacity,
      initialVertexCapacity,
      wantNormals,
    });

    for (let i = 0; i < indexCount; i += 3)
      builder.addTriangle(indices[i], indices[i + 1], indices[i + 2]);

    const position = new Point3d();
    const uv = new QPoint2d();
    const normal = new Vector3d();
    const worldToEcef = tile.iModel.getEcefTransform().matrix;
    for (let i = 0; i < pointCount; i++) {
      const u = uBuffer[i];
      const v = vBuffer[i];
      projection.getPoint(uvScale * u, uvScale * v, minHeight + heightBuffer[i] * heightScale, position);
      uv.setFromScalars(u * 2, v * 2);
      let oen;
      if (encodedNormalsBuffer) {
        const normalIndex = i * 2;
        OctEncodedNormal.decodeValue(encodedNormalsBuffer[normalIndex + 1] << 8 | encodedNormalsBuffer[normalIndex], normal);
        worldToEcef.multiplyTransposeVector(normal, normal);
        oen = OctEncodedNormal.encode(normal);
      }

      builder.addVertex(position, uv, oen);
    }

    if (!this._wantSkirts)
      return builder.finish();

    westIndices.sort((a, b) => vBuffer[a] - vBuffer[b]);
    eastIndices.sort((a, b) => vBuffer[a] - vBuffer[b]);
    northIndices.sort((a, b) => uBuffer[a] - uBuffer[b]);
    southIndices.sort((a, b) => uBuffer[a] - uBuffer[b]);

    const generateSkirts = (indexes: Uint16Array | Uint32Array) => {
      const quv = new QPoint2d();
      const param = new Point2d();
      for (let i = 0; i < indexes.length; i++) {
        const index = indexes[i];
        const uvIndex = index * 2;
        const height = minHeight + heightBuffer[index] * heightScale;

        quv.setFromScalars(builder.uvs.buffer.at(uvIndex), builder.uvs.buffer.at(uvIndex + 1));
        builder.uvs.params.unquantize(quv.x, quv.y, param);

        const oen = wantNormals && builder.normals ? builder.normals.at(index) : undefined;
        builder.addVertex(projection.getPoint(param.x, param.y, height - skirtHeight), quv, oen);

        if (i !== 0) {
          const nextPointIndex = builder.positions.length;
          builder.addTriangle(index, indexes[i - 1], nextPointIndex - 2);
          builder.addTriangle(index, nextPointIndex - 2, nextPointIndex - 1);
        }
      }
    };

    generateSkirts(westIndices);
    generateSkirts(eastIndices);
    generateSkirts(southIndices);
    generateSkirts(northIndices);

    return builder.finish();
  }

  public constructUrl(row: number, column: number, zoomLevel: number): string {
    return this._tileUrlTemplate.replace("{z}", zoomLevel.toString()).replace("{x}", column.toString()).replace("{y}", row.toString());
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

  public getHeightRange(parentRange: Range1d, quadId: QuadId): Range1d {
    const heightRange = quadId.level <= 6 ? ApproximateTerrainHeights.instance.getTileHeightRange(quadId) : undefined;

    return undefined === heightRange ? parentRange : heightRange;
  }
}
