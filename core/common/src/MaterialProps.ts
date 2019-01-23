/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { DefinitionElementProps } from "./ElementProps";
import { TextureMapping } from "./Render";
import { Id64String } from "@bentley/bentleyjs-core";

/** Contains three array entries ordered as red, green, blue containing values 0 to 1 */
export type RgbFactorProps = number[];
/** Contains two array entries orders X, Y containing doubles */
export type DPoint2dProps = number[];

export enum Units { Relative = 0, Meters = 3, Millimeters = 4, Feet = 5, Inches = 6 }

/** Properties that define how a texture is mapped to a material */
export interface TextureMapProps {
  /** Angle in degrees to rotate texture when applying; defaults to 0.0 if undefined */
  pattern_angle?: number;
  /** If true, flip the pattern map in U; if undefined, defaults to false */
  pattern_u_flip?: boolean;
  /** If true, flip the pattern map in V; if undefined, defaults to false */
  pattern_flip?: boolean;
  /** X, Y scale to apply to the pattern map; if undefined, defaults to {0,0} */
  pattern_scale?: DPoint2dProps;
  /** X, Y offset to apply to the pattern map; if undefined, defaults to {0,0} */
  pattern_offset?: DPoint2dProps;
  /** Units to use when applying the scaling; if undefined, defaults to Units.Relative */
  pattern_scalemode?: Units;
  /** Mapping mode to use for the texture application; if undefined, defaults to TextureMapping.Mode.Parametric */
  pattern_mapping?: TextureMapping.Mode;
  /** Weight at which to combine diffuse image and color; if undefined, defaults to 1.0 */
  pattern_weight?: number;
  /** A stringified base-64 encoded identifier for a Texture associated with this material */
  TextureId: Id64String;
}

/** Properties that define a RenderMaterial */
export interface RenderMaterialProps extends DefinitionElementProps {
  /** The palette name which categorizes this RenderMaterial */
  paletteName: string;
  /** The optional description for this RenderMaterial */
  description?: string;
  jsonProperties?: {
    materialAssets?: {
      renderMaterial?: {
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
        /** A TextureMapProps object that contains settings for mapping a texture to this material */
        Map?: TextureMapProps;
      };
    };
  };
}
