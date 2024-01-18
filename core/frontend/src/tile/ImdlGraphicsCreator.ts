/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { JsonUtils } from "@itwin/core-bentley";
import { ClipVector, Point2d, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import {
  ColorDef, Gradient, ImageSource, RenderMaterial, RenderTexture, TextureMapping,
} from "@itwin/core-common";
import { AuxChannelTable } from "../common/render/primitives/AuxChannelTable";
import { createSurfaceMaterial } from "../common//render/primitives/SurfaceParams";
import { ImdlModel as Imdl } from "../common/imdl/ImdlModel";
import { ImdlColorDef, ImdlNamedTexture, ImdlTextureMapping } from "../common/imdl/ImdlSchema";
import { edgeParamsFromImdl, toMaterialParams, toVertexTable } from "../common/imdl/ParseImdlDocument";
import { VertexIndices } from "../common/render/primitives/VertexIndices";
import type { RenderGraphic } from "../render/RenderGraphic";
import { GraphicBranch } from "../render/GraphicBranch";
import type { RenderGeometry, RenderSystem } from "../render/RenderSystem";
import type { InstancedGraphicParams } from "../render/InstancedGraphicParams";
import type { IModelConnection } from "../IModelConnection";

/** Options provided to [[decodeImdlContent]].
 * @internal
 */
export interface ImdlDecodeOptions {
  document: Imdl.Document;
  system: RenderSystem;
  iModel: IModelConnection;
  isCanceled?: () => boolean;
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
      return await options.system.createTextureFromSource({ source, ownership, type: textureType, transparency: namedTex.transparency });
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
    const texture = options.system.findTexture(name, options.iModel);
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
  patterns: Map<string, RenderGeometry[]>;
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
    const args = toMaterialParams(mat);
    return options.system.createRenderMaterial(args);
  }

  const material = options.system.findMaterial(mat, options.iModel);
  if (material || !options.document.json.renderMaterials)
    return material;

  const json = options.document.json.renderMaterials[mat];
  if (!json)
    return undefined;

  function colorDefFromJson(col: ImdlColorDef | undefined): ColorDef | undefined {
    return col ? ColorDef.from(col[0] * 255 + 0.5, col[1] * 255 + 0.5, col[2] * 255 + 0.5) : undefined;
  }

  // eslint-disable-next-line deprecation/deprecation
  const params = new RenderMaterial.Params(mat);
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

function createPrimitiveGeometry(primitive: Imdl.Primitive, options: GraphicsOptions, viOrigin: Point3d | undefined): RenderGeometry | undefined {
  switch (primitive.type) {
    case "point":
      return options.system.createPointStringGeometry({
        ...primitive.params,
        vertices: toVertexTable(primitive.params.vertices),
        indices: new VertexIndices(primitive.params.indices),
      }, viOrigin);
    case "polyline":
      return options.system.createPolylineGeometry({
        ...primitive.params,
        vertices: toVertexTable(primitive.params.vertices),
        polyline: {
          ...primitive.params.polyline,
          indices: new VertexIndices(primitive.params.polyline.indices),
          prevIndices: new VertexIndices(primitive.params.polyline.prevIndices),
        },
      }, viOrigin);
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

      return options.system.createMeshGeometry({
        ...primitive.params,
        edges: primitive.params.edges ? edgeParamsFromImdl(primitive.params.edges) : undefined,
        vertices: toVertexTable(primitive.params.vertices),
        auxChannels: primitive.params.auxChannels ? AuxChannelTable.fromJSON(primitive.params.auxChannels) : undefined,
        surface: {
          ...primitive.params.surface,
          material,
          textureMapping,
          indices: new VertexIndices(primitive.params.surface.indices),
        },
      }, viOrigin);
    }
  }
}

function createPrimitiveGraphic(primitive: Imdl.Primitive, options: GraphicsOptions): RenderGraphic | undefined {
  const mods = getModifiers(primitive);
  const geometry = createPrimitiveGeometry(primitive, options, mods.viOrigin);
  return geometry ? options.system.createRenderGraphic(geometry, mods.instances) : undefined;
}

function createPatternGeometries(primitives: Imdl.Primitive[], options: GraphicsOptions): RenderGeometry[] {
  const geometries = [];
  for (const primitive of primitives) {
    const geometry = createPrimitiveGeometry(primitive, options, undefined);
    if (geometry)
      geometries.push(geometry);
  }

  return geometries;
}

function createPatternGraphic(params: Imdl.AreaPatternParams, options: GraphicsOptions): RenderGraphic | undefined {
  const geometries = options.patterns.get(params.symbolName);
  if (!geometries || geometries.length === 0)
    return undefined;

  const clip = ClipVector.fromJSON(params.clip);
  const clipVolume = clip?.isValid ? options.system.createClipVolume(clip) : undefined;
  if (!clipVolume)
    return undefined;

  const viewIndependentOrigin = params.viewIndependentOrigin ? Point3d.fromJSON(params.viewIndependentOrigin) : undefined;
  const pattern = options.system.createAreaPattern({
    xyOffsets: params.xyOffsets,
    featureId: params.featureId,
    orgTransform: Transform.fromJSON(params.orgTransform),
    origin: Point2d.fromJSON(params.origin),
    scale: params.scale,
    spacing: Point2d.fromJSON(params.spacing),
    patternToModel: Transform.fromJSON(params.modelTransform),
    range: Range3d.fromJSON(params.range),
    symbolTranslation: Point3d.fromJSON(params.symbolTranslation),
    viewIndependentOrigin,
  });

  if (!pattern)
    return undefined;

  const branch = new GraphicBranch(true);
  for (const geometry of geometries) {
    const graphic = options.system.createRenderGraphic(geometry, pattern);
    if (graphic)
      branch.add(graphic);
  }

  return branch.isEmpty ? undefined : options.system.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume });
}

function createNodeGraphics(node: Imdl.Node, options: GraphicsOptions): RenderGraphic[] {
  if (undefined === node.groupId)
    return createPrimitivesNodeGraphics(node, options);

  const graphics: RenderGraphic[] = [];
  for (const child of node.nodes) {
    graphics.push(...createPrimitivesNodeGraphics(child, options));
  }

  if (graphics.length === 0)
    return graphics;

  const branch = new GraphicBranch(true);
  branch.groupNodeId = node.groupId;
  branch.entries.push(...graphics);
  return [options.system.createBranch(branch, Transform.createIdentity())];
}

function createPrimitivesNodeGraphics(node: Imdl.PrimitivesNode, options: GraphicsOptions): RenderGraphic[] {
  let graphics = [];
  for (const primitive of node.primitives) {
    const graphic = primitive.type === "pattern" ? createPatternGraphic(primitive.params, options) : createPrimitiveGraphic(primitive, options);
    if (graphic)
      graphics.push(graphic);
  }

  if (!graphics.length)
    return graphics;

  if (undefined !== node.layerId) {
    const layerGraphic = 1 === graphics.length ? graphics[0] : options.system.createGraphicList(graphics);
    graphics = [options.system.createGraphicLayer(layerGraphic, node.layerId)];
  } else if (undefined !== node.animationNodeId) {
    const branch = new GraphicBranch(true);
    branch.animationId = node.animationId;
    branch.animationNodeId = node.animationNodeId;
    branch.entries.push(...graphics);
    graphics = [options.system.createBranch(branch, Transform.createIdentity())];
  }

  return graphics;
}

/** @internal */
export async function decodeImdlGraphics(options: ImdlDecodeOptions): Promise<RenderGraphic | undefined> {
  const textures = await loadNamedTextures(options);
  if (options.isCanceled && options.isCanceled())
    return undefined;

  const patterns = new Map<string, RenderGeometry[]>();
  const graphicsOptions = { ...options, textures, patterns };

  for (const [name, primitives] of options.document.patterns)
    patterns.set(name, createPatternGeometries(primitives, graphicsOptions));

  const system = options.system;
  const graphics: RenderGraphic[] = [];
  for (const node of options.document.nodes) {
    graphics.push(...createNodeGraphics(node, graphicsOptions));
  }

  switch (graphics.length) {
    case 0: return undefined;
    case 1: return graphics[0];
    default: return system.createGraphicList(graphics);
  }
}
