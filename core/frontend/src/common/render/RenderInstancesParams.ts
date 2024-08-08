/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { InstancedGraphicParams } from "./InstancedGraphicParams";
import { Transform } from "@itwin/core-geometry";
import { Feature, FeatureAppearance, LinePixels, RgbColorProps } from "@itwin/core-common";

export interface InstancedFeaturesParams {
  modelId: Id64String;
  data: Uint32Array;
  count: number;
}

export interface RenderInstancesParams {
  opaque?: InstancedGraphicParams;
  translucent?: InstancedGraphicParams;
  features?: InstancedFeaturesParams;
}

export interface InstanceSymbology {
  weight?: number;
  linePixels?: LinePixels;
  color?: RgbColorProps;
  transparency?: number;
}

export interface Instance {
  transform: Transform;
  feature?: Feature | Id64String;
  symbology?: InstanceSymbology;
}

export interface RenderInstancesParamsBuilder {
  
}

// export namespace RenderInstancesParams {
//   export function collectTransferables(xfers: Set<Tranferable>, params: RenderInstancesParams): void {
//     if ()
//   }
// }
