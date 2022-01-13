/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { ColorDef, RenderTexture, RgbColorProps, TextureMapping } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

export interface RenderMaterialSource {
  iModel: IModelConnection;
  id: Id64String;
}

export interface CreateRenderMaterialArgs {
  /** @internal */
  source?: RenderMaterialSource;
  alpha?: number;
  diffuse?: {
    color?: ColorDef | RgbColorProps;
    weight?: number;
  };
  specular?: {
    color?: ColorDef | RgbColorProps;
    weight?: number;
    exponent?: number;
  };
  textureMapping?: {
    texture: RenderTexture;
    mode?: TextureMapping.Mode;
    transform?: TextureMapping.Trans2x3;
    weight?: number;
    /** @internal */
    worldMapping?: boolean;
  };
}
