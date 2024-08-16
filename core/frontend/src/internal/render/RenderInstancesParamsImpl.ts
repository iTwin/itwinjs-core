/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { _implementationProhibited } from "../../common/internal/Symbols";
import { InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { CreateRenderInstancesParamsBuilderArgs, Instance, RenderInstancesParams, RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { FeatureTable, PackedFeatureTable } from "@itwin/core-common";

export interface InstancedFeaturesParams {
  modelId: Id64String;
  data: Uint32Array;
  count: number;
}

export interface RenderInstancesParamsImpl extends RenderInstancesParams {
  [_implementationProhibited]: "renderInstancesParams";
  opaque?: InstancedGraphicProps;
  translucent?: InstancedGraphicProps;
  features?: InstancedFeaturesParams;
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
    const result: RenderInstancesParamsImpl = { [_implementationProhibited]: "renderInstancesParams" };
    const numInstances = this._opaque.length + this._translucent.length;
    if (numInstances === 0) {
      return result;
    }

    let featureTable;
    if (this._containsFeatures) {
      featureTable = new FeatureTable(numInstances, this._modelId);
    }

    result.opaque = this._opaque.finish(featureTable);
    result.translucent = this._translucent.finish(featureTable);

    if (featureTable) {
      const packedTable = PackedFeatureTable.pack(featureTable);
      result.features = {
        data: packedTable.data,
        modelId: packedTable.batchModelId,
        count: packedTable.numFeatures,
      };
    }

    return result;
  }
}

export function createRenderInstancesParamsBuilder(args: CreateRenderInstancesParamsBuilderArgs): RenderInstancesParamsBuilder {
  return new Builder(args.modelId);
}

export function collectRenderInstancesParamsTransferables(xfers: Set<Transferable>, params: RenderInstancesParamsImpl): void {
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
