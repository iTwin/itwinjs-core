/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { InstancedGraphicProps } from "./InstancedGraphicParams";
import { Transform } from "@itwin/core-geometry";
import { Feature, LinePixels, RgbColorProps } from "@itwin/core-common";
import { _implementationProhibited } from "../internal/Symbols";
import { collectRenderInstancesParamsTransferables, createRenderInstancesParamsBuilder } from "../../internal/render/RenderInstancesParamsImpl";

/** ###TODO
 * @beta
 */
export interface RenderInstancesParams {
  readonly [_implementationProhibited]: "renderInstancesParams";
}

/** @beta */
export namespace RenderInstancesParams {
  export function collectTransferables(xfers: Set<Transferable>, params: RenderInstancesParams): void {
    return collectRenderInstancesParamsTransferables(xfers, params);
  }
}

/** ###TODO
 * @beta
 */
export interface InstanceSymbology {
  weight?: number;
  linePixels?: LinePixels;
  color?: RgbColorProps;
}

/** ###TODO
 * @beta
 */
export interface Instance {
  transform: Transform;
  feature?: Feature | Id64String;
  symbology?: InstanceSymbology;
}

/** ###TODO
 * @beta
 */
export interface CreateRenderInstancesParamsBuilderArgs {
  modelId?: Id64String;
}

/** ###TODO
 * @beta
 */
export interface RenderInstancesParamsBuilder {
  /** @internal */
  [_implementationProhibited]: unknown;
  add(instance: Instance): void;
  finish(): RenderInstancesParams;
}

/** @beta */
export namespace RenderInstancesParamsBuilder {
  export function create(args: CreateRenderInstancesParamsBuilderArgs): RenderInstancesParamsBuilder {
    return createRenderInstancesParamsBuilder(args);
  }
}
