/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Gradient, ImageBuffer, RenderTexture } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";

export enum TextureTransparency {
  Opaque,
  Translucent,
  Mixed,
}

export interface TextureCacheKey {
  iModel: IModelConnection;
  key: string | Gradient.Symb;
}

export type TextureOwnership = TextureCacheKey | "external";

export type TextureImageSource = HTMLImageElement | HTMLCanvasElement | ImageBuffer;

export interface CreateTextureArgs {
  type?: RenderTexture.Type;
  image: TextureImageSource;
  transparency?: TextureTransparency;
  ownership?: TextureOwnership;
}
