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
import { Feature, FeatureTable, LinePixels, PackedFeatureTable, RgbColorProps } from "@itwin/core-common";
import { _implementationProhibited } from "../internal/Symbols";
import { InstancedGraphicPropsBuilder } from "../internal/render/InstancedGraphicPropsBuilder";

export interface InstancedFeaturesParams {
  /** @internal */
  [_implementationProhibited]: unknown;
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
  /** @internal */
  [_implementationProhibited]: unknown;
  add(instance: Instance): void;
  finish(): RenderInstancesParams;
}

export namespace RenderInstancesParamsBuilder {
  export function create(args: CreateRenderInstancesParamsBuilderArgs): RenderInstancesParamsBuilder {
    return new Builder(args.modelId);
  }
}

class Builder implements RenderInstancesParamsBuilder {
  public readonly [_implementationProhibited] = undefined;
  private readonly _opaque = new InstancedGraphicPropsBuilder();
  private readonly _translucent = new InstancedGraphicPropsBuilder();
  private readonly _modelId?: Id64String;
  private _containsFeatures = false;
  
  public constructor(modelId?: Id64String) {
    this._modelId = modelId;
  }

  public add(instance: Instance): void {
    // If symbology.transparency is defined and non-zero, the instance goes in the translucent bucket.
    const list = instance.symbology?.transparency ? this._translucent : this._opaque;
    list.add(instance);
    
    if (undefined !== instance.feature) {
      this._containsFeatures = true;
    }
  }

  public finish(): RenderInstancesParams {
    const numInstances = this._opaque.length + this._translucent.length;
    if (numInstances === 0) {
      return { };
    }

    let featureTable;
    if (this._containsFeatures) {
      featureTable = new FeatureTable(numInstances, this._modelId);
      this._opaque.addFeatures(featureTable);
      this._translucent.addFeatures(featureTable);
    }

    const opaque = this._opaque.finish(featureTable);
    const translucent = this._translucent.finish(featureTable);

    let features: InstancedFeaturesParams | undefined;
    if (featureTable) {
      const packedTable = PackedFeatureTable.pack(featureTable);
      features = {
        [_implementationProhibited]: undefined,
        data: packedTable.data,
        modelId: packedTable.batchModelId,
        count: packedTable.numFeatures,
      };
    }

    return { opaque, translucent, features };
  }
}
