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
  ColorDef, Gradient, ImageSource, QParams2d, QParams3d, RenderMaterial, RenderTexture, TextureMapping,
} from "@itwin/core-common";
import type { ImdlColorDef, ImdlDocument, ImdlNamedTexture, ImdlTextureMapping } from "../imdl/ImdlSchema";
import type { ImdlModel as Imdl } from "../imdl/ImdlModel";
import type { RenderGraphic } from "../render/RenderGraphic";
import { GraphicBranch } from "../render/GraphicBranch";
import type { CreateRenderMaterialArgs } from "../render/RenderMaterial";
import type { RenderSystem } from "../render/RenderSystem";
import type { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import type { IModelConnection } from "../IModelConnection";
import { createSurfaceMaterial, EdgeParams, VertexIndices, VertexTable } from "../render-primitives";
import { AuxChannelTable } from "../render/primitives/AuxChannelTable";

export interface ImdlDecodeOptions {
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
    const bufferViewJson = 0 !== bufferViewId.length ? options.document.json.bufferViews[bufferViewId] : undefined;

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
  const namedTextures = options.document.json.namedTextures;
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

interface GraphicsOptions extends ImdlDecodeOptions {
  textures: Map<string, RenderTexture>;
}

function constantLodParamPropsFromJson(propsJson: { repetitions?: number, offset?: number[], minDistClamp?: number, maxDistClamp?: number } | undefined): TextureMapping.ConstantLodParamProps | undefined {
  if (undefined === propsJson)
    return undefined;

  const constantLodPops: TextureMapping.ConstantLodParamProps = {
    repetitions: JsonUtils.asDouble(propsJson.repetitions, 1.0),
    offset: { x: propsJson.offset ? JsonUtils.asDouble(propsJson.offset[0]) : 0.0, y: propsJson.offset ? JsonUtils.asDouble(propsJson.offset[1]) : 0.0 },
    minDistClamp: JsonUtils.asDouble(propsJson.minDistClamp, 1.0),
    maxDistClamp: JsonUtils.asDouble(propsJson.maxDistClamp, 4096.0 * 1024.0 * 1024.0),
  };
  return constantLodPops;
}

function textureMappingFromJson(json: ImdlTextureMapping | undefined, options: GraphicsOptions): TextureMapping | undefined {
  if (!json)
    return undefined;

  const texture = options.textures.get(JsonUtils.asString(json.name));
  if (!texture)
    return undefined;

  const paramsJson = json.params;
  const tf = paramsJson.transform;

  const paramProps: TextureMapping.ParamProps = {
    textureMat2x3: new TextureMapping.Trans2x3(tf[0][0], tf[0][1], tf[0][2], tf[1][0], tf[1][1], tf[1][2]),
    textureWeight: JsonUtils.asDouble(paramsJson.weight, 1.0),
    mapMode: JsonUtils.asInt(paramsJson.mode),
    worldMapping: JsonUtils.asBool(paramsJson.worldMapping),
    useConstantLod: JsonUtils.asBool(paramsJson.useConstantLod),
    constantLodProps: constantLodParamPropsFromJson(paramsJson.constantLodParams),
  };

  const textureMapping = new TextureMapping(texture, new TextureMapping.Params(paramProps));

  const normalMapJson = json.normalMapParams;
  if (normalMapJson) {
    let normalMap;
    const normalTexName = JsonUtils.asString(normalMapJson.textureName);
    if (normalTexName.length === 0 || undefined !== (normalMap = options.textures.get(normalTexName))) {
      textureMapping.normalMapParams = {
        normalMap,
        greenUp: JsonUtils.asBool(normalMapJson.greenUp),
        scale: JsonUtils.asDouble(normalMapJson.scale, 1),
        useConstantLod: JsonUtils.asBool(normalMapJson.useConstantLod),
      };
    }
  }

  return textureMapping;
}

function getMaterial(mat: string | Imdl.SurfaceMaterialParams, options: GraphicsOptions): RenderMaterial | undefined {
  if (typeof mat !== "string") {
    const args: CreateRenderMaterialArgs = { alpha: mat.alpha };
    if (mat.diffuse) {
      args.diffuse = {
        weight: mat.diffuse.weight,
        color: undefined !== mat.diffuse.color ? ColorDef.fromJSON(mat.diffuse.color) : undefined,
      };
    }

    if (mat.specular) {
      args.specular = {
        weight: mat.specular.weight,
        exponent: mat.specular.exponent,
        color: undefined !== mat.specular.color ? ColorDef.fromJSON(mat.specular.color) : undefined,
      };
    }

    return options.system.createRenderMaterial(args);
  }

  const material = options.system.findMaterial(mat, options.iModel);
  if (material || !options.document.json.renderMaterials)
    return material;

  const json = options.document.json.renderMaterials[mat];
  if (!json)
    return undefined;

  function colorDefFromJson(json: ImdlColorDef | undefined): ColorDef | undefined {
    return json ? ColorDef.from(json[0] * 255 + 0.5, json[1] * 255 + 0.5, json[2] * 255 + 0.5) : undefined;
  }

  // eslint-disable-next-line deprecation/deprecation
  const params = new RenderMaterial.Params
  params.diffuseColor = colorDefFromJson(json.diffuseColor);
  if (json.diffuse !== undefined)
    params.diffuse = JsonUtils.asDouble(json.diffuse);

  params.specularColor = colorDefFromJson(json.specularColor);
  if (json.specular !== undefined)
    params.specular = JsonUtils.asDouble(json.specular);

  params.reflectColor = colorDefFromJson(json.reflectColor);
  if (json.reflect !== undefined)
    params.reflect = JsonUtils.asDouble(json.reflect);

  if (json.specularExponent !== undefined)
    params.specularExponent = json.specularExponent;

  if (undefined !== json.transparency)
    params.alpha = 1.0 - json.transparency;

  params.refract = JsonUtils.asDouble(json.refract);
  params.shadows = JsonUtils.asBool(json.shadows);
  params.ambient = JsonUtils.asDouble(json.ambient);

  if (undefined !== json.textureMapping)
    params.textureMapping = textureMappingFromJson(json.textureMapping.texture, options);

  // eslint-disable-next-line deprecation/deprecation
  return options.system.createMaterial(params, options.iModel);
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

function convertEdges(imdl: Imdl.EdgeParams): EdgeParams | undefined {
  return {
    ...imdl,
    segments: imdl.segments ? {
      ...imdl.segments,
      indices: new VertexIndices(imdl.segments.indices),
    } : undefined,
    silhouettes: imdl.silhouettes ? {
      ...imdl.silhouettes,
      indices: new VertexIndices(imdl.silhouettes.indices),
    } : undefined,
    polylines: imdl.polylines ? {
      ...imdl.polylines,
      indices: new VertexIndices(imdl.polylines.indices),
      prevIndices: new VertexIndices(imdl.polylines.prevIndices),
    } : undefined,
    indexed: imdl.indexed ? {
      indices: new VertexIndices(imdl.indexed.indices),
      edges: imdl.indexed.edges,
    } : undefined,
  };
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
      case "mesh": {
        const surf = primitive.params.surface;
        let material;
        if (surf.material) {
          if (!surf.material.isAtlas)
            material = createSurfaceMaterial(getMaterial(surf.material.material, options));
          else
            material = surf.material;
        }

        let textureMapping;
        if (surf.textureMapping) {
          let texture;
          if (typeof surf.textureMapping.texture === "string") {
            texture = options.textures.get(surf.textureMapping.texture);
          } else {
            const gradient = Gradient.Symb.fromJSON(surf.textureMapping.texture);
            texture = options.system.getGradientTexture(gradient, options.iModel);
          }

          if (texture)
            textureMapping = { texture, alwaysDisplayed: surf.textureMapping.alwaysDisplayed };
        }

        geometry = options.system.createMeshGeometry({
          ...primitive.params,
          edges: primitive.params.edges ? convertEdges(primitive.params.edges) : undefined,
          vertices: toVertexTable(primitive.params.vertices),
          auxChannels: primitive.params.auxChannels ? AuxChannelTable.fromJSON(primitive.params.auxChannels) : undefined,
          surface: {
            ...primitive.params.surface,
            material,
            textureMapping,
            indices: new VertexIndices(primitive.params.surface.indices),
          },
        }, mods.viOrigin);
        break;
      }
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
  const graphicsOptions = { ...options, textures };

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
