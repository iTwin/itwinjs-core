/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { RenderTexture, SkyGradient } from "@itwin/core-common";

export interface RenderSkyGradientParams {
  type: "gradient";
  gradient: SkyGradient;
  zOffset: number;
}

export interface RenderSkySphereParams {
  type: "sphere";
  texture: RenderTexture;
  rotation: number;
  zOffset: number;
}

export interface RenderSkyCubeParams {
  type: "cube";
  texture: RenderTexture;
}

export type RenderSkyBoxParams = RenderSkyGradientParams | RenderSkySphereParams | RenderSkyCubeParams;

