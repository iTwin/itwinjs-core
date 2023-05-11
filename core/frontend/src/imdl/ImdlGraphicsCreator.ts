/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { JsonUtils } from "@itwin/core-bentley";
import { ImageSource, RenderMaterial, RenderTexture, TileReadStatus } from "@itwin/core-common";
import { ImdlDocument, ImdlNamedTexture } from "../imdl/ImdlSchema";
import { ImdlModel as Imdl } from "../imdl/ImdlModel";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { IModelConnection } from "../IModelConnection";

export interface ImdlDecodeOptions {
  source: ImdlDocument;
  document: Imdl.Document;
  system: RenderSystem;
  iModel: IModelConnection;
}

export type ImdlDecodeError = Exclude<TileReadStatus, TileReadStatus.Success>;

async function loadNamedTexture(name: string, namedTex: ImdlNamedTexture, options: ImdlDecodeOptions): Promise<RenderTexture | undefined> {
  // Reasons a texture could be embedded in the tile content instead of requested separately from the backend:
  // - external textures are disabled
  // - the texture name is not a valid Id64 string
  // - the texture is below a certain backend-hardcoded size threshold
  // The bufferViewJson being defined signifies any of the above conditions. In that case, the image content
  // has been embedded in the tile contents. Otherwise, we will attempt to request the image content separately
  // from the backend.

  try {
    let textureType = RenderTexture.Type.Normal;
    const isGlyph = JsonUtils.asBool(namedTex.isGlyph);
    const isTileSection = !isGlyph && JsonUtils.asBool(namedTex.isTileSection);
    if (isGlyph)
      textureType = RenderTexture.Type.Glyph;
    else if (isTileSection)
      textureType = RenderTexture.Type.TileSection;

    // We produce unique tile sections for very large (> 8 megapixel) textures, and unique glyph atlases for raster text.
    // Neither should be cached.
    const cacheable = !isGlyph && !isTileSection;
    const ownership = cacheable ? { iModel: options.iModel, key: name } : undefined;

    const bufferViewId = JsonUtils.asString(namedTex.bufferView);
    const bufferViewJson = 0 !== bufferViewId.length ? options.source.bufferViews[bufferViewId] : undefined;

    if (undefined !== bufferViewJson) { // presence of bufferViewJson signifies we should read the texture from the tile content
      const byteOffset = JsonUtils.asInt(bufferViewJson.byteOffset);
      const byteLength = JsonUtils.asInt(bufferViewJson.byteLength);
      if (0 === byteLength)
        return undefined;

      const texBytes = options.document.binaryData.subarray(byteOffset, byteOffset + byteLength);
      const format = namedTex.format;
      const source = new ImageSource(texBytes, format);
      return options.system.createTextureFromSource({ source, ownership, type: textureType, transparency: namedTex.transparency });
    }

    // bufferViewJson was undefined, so attempt to request the texture directly from the backend
    // eslint-disable-next-line deprecation/deprecation
    const params = new RenderTexture.Params(cacheable ? name : undefined, textureType);
    return options.system.createTextureFromElement(name, options.iModel, params, namedTex.format);
  } catch (_) {
    return undefined;
  }
}

async function loadNamedTextures(options: ImdlDecodeOptions): Promise<Map<string, RenderTexture>> {
  const result = new Map<string, RenderTexture>();
  const namedTextures = options.source.namedTextures;
  if (!namedTextures)
    return result;

  const promises = new Array<Promise<void>>();
  for (const [name, namedTexture] of Object.entries(namedTextures)) {
    let texture = options.system.findTexture(name, options.iModel);
    if (texture) {
      result.set(name, texture);
      continue;
    } else if (namedTexture) {
      promises.push(loadNamedTexture(name, namedTexture, options).then((tx) => {
        if (tx)
          result.set(name, tx);
      }));
    }
  }

  if (promises.length > 0)
    await Promise.all(promises);

  return result;
}

export async function decodeImdlContent(options: ImdlDecodeOptions): Promise<RenderGraphic | undefined | ImdlDecodeError> {
  const namedTextures = await loadNamedTextures(options);

  const graphics: RenderGraphic[] = [];
  for (const node of options.document.nodes) {
  }

  return undefined; // ###TODO
}
