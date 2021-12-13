/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ByteStream, Id64String, JsonUtils, utf8ToString } from "@itwin/core-bentley";
import { Angle, Matrix3d, Point2d, Point3d, Range2d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import {
  BatchType, ColorDef, ElementAlignedBox3d, FeatureTable, FillFlags, GltfBufferData, GltfBufferView, GltfDataType, GltfHeader, GltfMeshMode,
  ImageSource, ImageSourceFormat, LinePixels, MeshEdge, MeshEdges, MeshPolyline, MeshPolylineList, OctEncodedNormal, PackedFeatureTable, QParams2d, QParams3d, QPoint2dList, QPoint3dList,
  Quantization,
  RenderTexture, TextureMapping, TileReadStatus,
} from "@itwin/core-common";
import { getImageSourceFormatForMimeType, imageElementFromImageSource } from "../ImageUtil";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { GraphicBranch } from "../render/GraphicBranch";
import { BatchOptions } from "../render/GraphicBuilder";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { Mesh, MeshGraphicArgs } from "../render/primitives/mesh/MeshPrimitives";
import { RealityMeshPrimitive } from "../render/primitives/mesh/RealityMeshPrimitive";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { TextureTransparency } from "../render/RenderTexture";
import { GltfReader, GltfReaderProps, GltfReaderResult, TileContent } from "./internal";

export interface ReadGlbGraphicsArgs {
  glb: Uint8Array;
  iModel: IModelConnection;
  yAxisUp?: boolean;
  modelId?: Id64String,
  options?: BatchOptions | false,
}

export async function readGlbGraphics(args: ReadGlbGraphicsArgs): Promise<RenderGraphic | undefined> {
  const stream = new ByteStream(args.glb.buffer);
  const props = GltfReaderProps.create(stream, args.yAxisUp);
  const reader = props ? new GlbReader(props, args) : undefined;
  if (!reader)
    return undefined;

  const result = await reader.read();
  return result.graphic;
}

class GlbReader extends GltfReader {
  public constructor(props: GltfReaderProps, args: ReadGlbGraphicsArgs) {
    super(props, args.iModel, args.modelId ?? "0", false, IModelApp.renderSystem);
    // ###TODO FeatureTable
    // ###TODO modelId useless unless feature table, and required if have feature table?
  }

  public async read(): Promise<GltfReaderResult> {
    await this.loadTextures();
    // ###TODO contentRange - produce from meshes while reading...
    return this.readGltfAndCreateGraphics(true, undefined, Range3d.createNull());
  }
}
