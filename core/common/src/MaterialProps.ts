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
 */
export type RgbFactorProps = number[];

/** A 2d point specified as an array of 2 numbers [x, y].
 * @see usage in [[TextureMapProps]].
 * @public
 */
export type Point2dProps = number[];

/** Describes the units in which a [[TextureMapProps]]' scale is expressed.
 * @public
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
 * @public
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
  /** The Id of the persistent [Texture]($backend) element defining the texture image. */
  TextureId: Id64String;
}

/** Describes the graphical properties of a [RenderMaterialElement]($backend) as part of a [[RenderMaterialProps]].
 * @public
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
  /** Specular exponent (surface shininess); range is 0 to 128; if undefined, defaults to 15.0 * 0.9 */
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
  /** An optional set of texture maps associated with this material.
   * A large variety of map types may be present (e.g., bump maps, specular maps, fur, etc), but currently only the pattern map is used.
   */
  Map?: {
    /** Optional pattern map. */
    Pattern?: TextureMapProps;
  };
}

/** Properties that define a [RenderMaterialElement]($backend).
 * @see [[RenderMaterial]] for the representation used by the display system.
 * @public
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
