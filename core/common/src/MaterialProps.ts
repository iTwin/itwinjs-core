/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { DefinitionElementProps } from "./ElementProps";
import { TextureMapping } from "./TextureMapping";

/** Describes a color as an array of three numbers ranging from 0 to 1 where the first entry corresponds to the color's red component,
 * the second to green, and the third to blue.
 * @see usage in [[RenderMaterialAssetProps]].
 * @public
 * @extensions
 */
export type RgbFactorProps = number[];

/** A 2d point specified as an array of 2 numbers [x, y].
 * @see usage in [[TextureMapProps]].
 * @public
 * @extensions
 */
export type Point2dProps = number[];

/** Describes the units in which a [[TextureMapProps]]' scale is expressed.
 * @public
 * @extensions
 */
export enum TextureMapUnits {
  /** Indicates the scale has no units. */
  Relative = 0,
  Meters = 3,
  Millimeters = 4,
  Feet = 5,
  Inches = 6,
}

/* eslint-disable @typescript-eslint/naming-convention */

/** As part of a [[RenderMaterialAssetProps]], describes how to map a [[RenderTexture]]'s image to the triangles of a mesh to which the material is applied.
 * @see [[RenderMaterialAssetMapsProps]] for the supported types of texture mappings.
 * @public
 * @extensions
 */
export interface TextureMapProps {
  /** Angle in degrees to rotate texture when applying; defaults to 0.0 if undefined */
  pattern_angle?: number;
  /** If true, flip the pattern map in U; if undefined, defaults to false */
  pattern_u_flip?: boolean;
  /** If true, flip the pattern map in V; if undefined, defaults to false */
  pattern_flip?: boolean;
  /** X, Y scale to apply to the pattern map; if undefined, defaults to {0,0}, which is almost never useful. */
  pattern_scale?: Point2dProps;
  /** X, Y offset to apply to the pattern map; if undefined, defaults to {0,0} */
  pattern_offset?: Point2dProps;
  /** Units to use when applying the scaling; if undefined, defaults to [[TextureMapUnits.Relative]] */
  pattern_scalemode?: TextureMapUnits;
  /** Mapping mode to use for the texture application; if undefined, defaults to [[TextureMapping.Mode.Parametric]] */
  pattern_mapping?: TextureMapping.Mode;
  /** Weight at which to combine diffuse image and color; if undefined, defaults to 1.0 */
  pattern_weight?: number;
  /** If true, override the mapping mode with constant LOD mapping for the normal map, defaults to false.
   * @deprecated in 4.4. It never functioned properly - use [[pattern_useconstantlod]] instead.
   */
  pattern_useConstantLod?: boolean;
  /** If true, override the mapping mode with constant LOD mapping for the normal map, defaults to false. */
  pattern_useconstantlod?: boolean;
  /** The number of times the texture is repeated if pattern_useconstantlod is true.  Increasing this will make the texture pattern appear smaller, decreasing it will make it larger. Defaults to 1.*/
  pattern_constantlod_repetitions?: number;
  /** An offset in world units used to shift the texture when pattern_useconstantlod is true. Defaults to (0, 0). */
  pattern_constantlod_offset?: Point2dProps;
  /** The minimum distance (from the eye to the surface) at which to clamp the texture size when pattern_useconstantlod is true. Defaults to 1. */
  pattern_constantlod_mindistanceclamp?: number;
  /** The maximum distance (from the eye to the surface) at which to clamp the texture size when pattern_useconstantlod is true. Defaults to 2^32. */
  pattern_constantlod_maxdistanceclamp?: number;
  /** The Id of the persistent [Texture]($backend) element defining the texture image. */
  TextureId: Id64String;
}

/** Flags applied to a [[NormalMapProps]]. The enum values can be combined using bitwise operators.
 * @public
 */
export enum NormalMapFlags {
  /** No special flags. */
  None = 0,
  /** Indicates that the Y component of each vector - stored in the texture's green channel - points upward along the positive Y axis and should
   * be negated. By default it points downward.
   */
  GreenUp = 1 << 0,
  /** If true, override the mapping mode with constant LOD mapping for the normal map. */
  UseConstantLod = 1 << 1,
}

/** Describes how to apply [normal mapping](https://en.wikipedia.org/wiki/Normal_mapping) to a surface material.
 * @see [[RenderMaterialAssetMapsProps.Normal]] to define a normal map for a [[RenderMaterialAssetProps]].
 * @public
 */
export interface NormalMapProps extends TextureMapProps {
  /** Flags controlling how the normal map is applied. Default: [[NormalMapFlags.None]]. */
  NormalFlags?: NormalMapFlags;
}

/** Describes different types of textures to be applied to a surface material to alter its appearance.
 * @note While technically both [[Pattern]] and [[Normal]] can define their own mapping parameters (`pattern_angle`, `pattern_mapping`, etc), in practice
 * if both maps are present they are expected to have identical mapping parameters, with the exception of `TextureId`.
 * @see [[RenderMaterialAssetProps.Map]] to define the texture maps for a material asset.
 * @public
 */
export interface RenderMaterialAssetMapsProps {
  /** Maps an image describing the diffuse color of the surface, replacing or mixing with the surface's own color. */
  Pattern?: TextureMapProps;
  /** Maps a [normal map](https://en.wikipedia.org/wiki/Normal_mapping) to the surface, simulating more complex surface details than are
   * present in the surface's geometry.
   */
  Normal?: NormalMapProps;
  /** Maps an image describing detailed minor height variation of the surface geometry. */
  Bump?: TextureMapProps;
  /** Maps an image describing the diffuse color of the surface, replacing or mixing with the surface's own color. */
  Diffuse?: TextureMapProps;
  /** Maps an image describing the glossiness of the surface's finish */
  Finish?: TextureMapProps;
  /** Maps an image describing glowing parts of the surface */
  GlowColor?: TextureMapProps;
  /** Maps an image describing the reflectiveness of the surface */
  Reflect?: TextureMapProps;
  /** Maps an image describing the specular component of the surface */
  Specular?: TextureMapProps;
  /** Maps an image describing the translucency of the surface, how much light comes out the back of the surface */
  TranslucencyColor?: TextureMapProps;
  /** Maps an image describing the transparency of the surface, how visible objects behind this object are */
  TransparentColor?: TextureMapProps;
  /** Maps an image describing the displacement of the surface geometry */
  Displacement?: TextureMapProps;
}

/** Describes the graphical properties of a [RenderMaterialElement]($backend) as part of a [[RenderMaterialProps]].
 * This representation is used to persist the material properties into the [IModelDb]($backend), but is unwieldy and verbose.
 * @see [RenderMaterialElementParams]($backend) for a somewhat more ergonomic representation.
 * @public
 * @extensions
 */
export interface RenderMaterialAssetProps {
  /** If true, this material has a fill/diffuse color; if undefined, defaults to false */
  HasBaseColor?: boolean;
  /** Surface color used for fill or diffuse illumination; if undefined, defaults to black */
  color?: RgbFactorProps;
  /** If true, this material has a specular color; if undefined, defaults to false */
  HasSpecularColor?: boolean;
  /** Surface color used for specular illumination; if undefined, defaults to black */
  specular_color?: RgbFactorProps;
  /** If true, this material has a specular exponent; if undefined, defaults to false */
  HasFinish?: boolean;
  /** Specular exponent (surface shininess); range is 0 to 128; if undefined, defaults to 13.5 */
  finish?: number;
  /** If true, this material has surface transparency; if undefined, defaults to false */
  HasTransmit?: boolean;
  /** Surface transparency; if undefined, defaults to 0.0 */
  transmit?: number;
  /** If true, this material has a value for diffuse reflectivity; if undefined, defaults to false */
  HasDiffuse?: boolean;
  /** Surface diffuse reflectivity; if undefined, defaults to 0.6 */
  diffuse?: number;
  /** If true, this material has a value for specular reflectivity; if undefined, defaults to false.  If false, specular value is actually set to 0.0 */
  HasSpecular?: boolean;
  /** Surface specular reflectivity; if undefined, defaults to 0.4 */
  specular?: number;
  /** If true, this material has a value for environmental reflectivity; if undefined, defaults to false */
  HasReflect?: boolean;
  /** Surface environmental reflectivity; stored as fraction of specular in V8 material settings; if undefined defaults to 0.0 */
  reflect?: number;
  /** If true, this material has a surface reflectance color; if undefined, defaults to false.  If false, reflectance color is actually set to specular color */
  HasReflectColor?: boolean;
  /** Surface reflectance color; if undefined, defaults to black */
  reflect_color?: RgbFactorProps;
  /** A scale by which to multiply the components of the normals read from [[Map.Normal]], if a normal map is defined.
   * Default: 1.0
   */
  pbr_normal?: number;
  /** An optional set of texture maps associated with this material. */
  Map?: RenderMaterialAssetMapsProps;
}

/** Properties that define a [RenderMaterialElement]($backend).
 * @see [[RenderMaterial]] for the representation used by the display system.
 * @public
 * @extensions
 */
export interface RenderMaterialProps extends DefinitionElementProps {
  /** The name of a palette that can be used to categorize multiple materials. */
  paletteName: string;
  /** An optional description of the material. */
  description?: string;
  jsonProperties?: {
    /** A container for various "assets" describing aspects of the material. */
    materialAssets?: {
      /** Properties of the material describing how it is displayed. */
      renderMaterial?: RenderMaterialAssetProps;
    };
  };
}
