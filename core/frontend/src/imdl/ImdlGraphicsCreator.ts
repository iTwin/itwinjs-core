/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { JsonUtils } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import {
  ColorDef, ImageSource, QParams2d, QParams3d, RenderTexture,
} from "@itwin/core-common";
import { ImdlDocument, ImdlNamedTexture } from "../imdl/ImdlSchema";
import { ImdlModel as Imdl } from "../imdl/ImdlModel";
import { RenderGraphic } from "../render/RenderGraphic";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderSystem } from "../render/RenderSystem";
import { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import type { IModelConnection } from "../IModelConnection";
import { VertexIndices, VertexTable } from "../render-primitives";

export interface ImdlDecodeOptions {
  source: ImdlDocument;
  document: Imdl.Document;
  system: RenderSystem;
  iModel: IModelConnection;
}

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

interface GraphicsOptions {
  textures: Map<string, RenderTexture>;
  system: RenderSystem;
}

function getModifiers(primitive: Imdl.Primitive): { viOrigin?: Point3d, instances?: InstancedGraphicParams } {
  const mod = primitive.modifier;
  switch (mod?.type) {
    case "instances":
      return {
        instances: {
          ...mod,
          transformCenter: Point3d.fromJSON(mod.transformCenter),
          range: mod.range ? Range3d.fromJSON(mod.range) : undefined,
        },
      };
    case "viewIndependentOrigin":
      return {
        viOrigin: Point3d.fromJSON(mod.origin),
      };
    default:
      return { };
  }
}

function toVertexTable(imdl: Imdl.VertexTable): VertexTable {
  return new VertexTable({
    ...imdl,
    qparams: QParams3d.fromJSON(imdl.qparams),
    uniformColor: imdl.uniformColor ? ColorDef.fromJSON(imdl.uniformColor) : undefined,
    uvParams: imdl.uvParams ? QParams2d.fromJSON(imdl.uvParams) : undefined,
  });
}

function createNodeGraphics(node: Imdl.Node, options: GraphicsOptions): RenderGraphic[] {
  const graphics = [];
  for (const primitive of node.primitives) {
    const mods = getModifiers(primitive);

    // ###TODO area patterns...
    let geometry;
    switch (primitive.type) {
      case "point":
        geometry = options.system.createPointStringGeometry({
          ...primitive.params,
          vertices: toVertexTable(primitive.params.vertices),
          indices: new VertexIndices(primitive.params.indices),
        }, mods.viOrigin);
        break;
      case "polyline":
        geometry = options.system.createPolylineGeometry({
          ...primitive.params,
          vertices: toVertexTable(primitive.params.vertices),
          polyline: {
            ...primitive.params.polyline,
            indices: new VertexIndices(primitive.params.polyline.indices),
            prevIndices: new VertexIndices(primitive.params.polyline.prevIndices),
          },
        }, mods.viOrigin);
        break;
      // ###TODO mesh
    }

    if (!geometry)
      continue;

    const graphic = options.system.createRenderGraphic(geometry, mods.instances);
    if (graphic)
      graphics.push(graphic);
  }

  return graphics;
}

export async function decodeImdlGraphics(options: ImdlDecodeOptions): Promise<RenderGraphic | undefined> {
  const textures = await loadNamedTextures(options);
  const graphicsOptions = {
    textures,
    system: options.system,
  };

  const system = options.system;
  const graphics: RenderGraphic[] = [];
  for (const node of options.document.nodes) {
    const nodeGraphics = createNodeGraphics(node, graphicsOptions);
    if (nodeGraphics.length === 0)
      continue;

    if (undefined !== node.layerId) {
      const layerGraphic = 1 === nodeGraphics.length ? nodeGraphics[0] : system.createGraphicList(nodeGraphics);
      graphics.push(system.createGraphicLayer(layerGraphic, node.layerId));
    } else if (undefined !== node.animationNodeId) {
      const branch = new GraphicBranch(true);
      branch.animationId = node.animationId;
      branch.animationNodeId = node.animationNodeId;
      branch.entries.push(...nodeGraphics);
      graphics.push(system.createBranch(branch, Transform.createIdentity()));
    } else {
      graphics.push(...nodeGraphics);
    }
  }

  switch (graphics.length) {
    case 0: return undefined;
    case 1: return graphics[0];
    default: return system.createGraphicList(graphics);
  }
}
