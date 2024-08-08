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
import { Feature, FeatureAppearance, LinePixels, RgbColorProps } from "@itwin/core-common";

export interface InstancedFeaturesParams {
  modelId: Id64String;
  data: Uint32Array;
  count: number;
}

export interface RenderInstancesParams {
  opaque?: InstancedGraphicProps;
  translucent?: InstancedGraphicProps;
  features?: InstancedFeaturesParams;
}

export namespace RenderInstancesParams {
  export function collectTransferables(xfers: Set<Transferable>, params: RenderInstancesParams): void {
    if (params.opaque) {
      InstancedGraphicProps.collectTransferables(xfers, params.opaque);
    }

    if (params.translucent) {
      InstancedGraphicProps.collectTransferables(xfers, params.translucent);
    }

    if (params.features) {
      xfers.add(params.features.data.buffer);
    }
  }
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

export interface CreateRenderInstancesParamsBuilderArgs {
  modelId?: Id64String;
}

export interface RenderInstancesParamsBuilder {
  add(instance: Instance): void;
  finish(): RenderInstancesParams;
}

export namespace RenderInstancesParamsBuilder {
  export function create(args: CreateRenderInstancesParamsBuilderArgs): RenderInstancesParamsBuilder {
    return new Builder(args.modelId);
  }
}

class Builder implements RenderInstancesParamsBuilder {
  private readonly _opaque: Instance[] = []
  private readonly _translucent: Instance[] = []
  private readonly _modelId?: Id64String;
  
  public constructor(modelId?: Id64String) {
    this._modelId = modelId;
  }

  public add(instance: Instance): void {
    if (undefined !== instance.feature && undefined === this._modelId) {
      throw new Error("Instanced features require a model Id to be supplied when creating the RenderInstancesParamsBuilder");
    }

    // If symbology.transparency is defined and non-zero, the instance goes in the translucent bucket.
    const list = instance.symbology?.transparency ? this._translucent : this._opaque;
    list.push(instance);
  }

  public finish(): RenderInstancesParams {
    return {} as any;
  }
}
