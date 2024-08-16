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

export interface RenderInstancesParams {
  readonly [_implementationProhibited]: "renderInstancesParams";
}

export namespace RenderInstancesParams {
  export function collectTransferables(xfers: Set<Transferable>, params: RenderInstancesParams): void {
    return collectRenderInstancesParamsTransferables(xfers, params);
  }
}

export interface InstanceSymbology {
  weight?: number;
  linePixels?: LinePixels;
  color?: RgbColorProps;
}

export interface Instance {
  transform: Transform;
  feature?: Feature | Id64String;
  symbology?: InstanceSymbology;
}

export interface CreateRenderInstancesParamsBuilderArgs {
  modelId?: Id64String;
}

export interface RenderInstancesParamsBuilder {
  /** @internal */
  [_implementationProhibited]: unknown;
  add(instance: Instance): void;
  finish(): RenderInstancesParams;
}

export namespace RenderInstancesParamsBuilder {
  export function create(args: CreateRenderInstancesParamsBuilderArgs): RenderInstancesParamsBuilder {
    return createRenderInstancesParamsBuilder(args);
  }
}
