/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ByteStream, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { BatchOptions } from "../render/GraphicBuilder";
import { RenderGraphic } from "../render/RenderGraphic";
import { GltfReader, GltfReaderProps, GltfReaderResult } from "./internal";

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
