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
  instances: InstancedGraphicProps;
  features?: InstancedFeaturesParams;
}

class Builder implements RenderInstancesParamsBuilder {
  public readonly [_implementationProhibited] = undefined;
  private readonly _instances = new InstancedGraphicPropsBuilder();
  private readonly _modelId?: Id64String;
  private _containsFeatures = false;
  
  public constructor(modelId?: Id64String) {
    this._modelId = modelId;
  }

  public add(instance: Instance): void {
    this._instances.add(instance);
    
    if (undefined !== instance.feature) {
      this._containsFeatures = true;
    }
  }

  public finish(): RenderInstancesParams {
    const numInstances = this._instances.length;
    if (numInstances === 0) {
      throw new Error("No instances defined");
    }

    let featureTable;
    if (this._containsFeatures) {
      featureTable = new FeatureTable(numInstances, this._modelId);
    }

    const instances = this._instances.finish(featureTable);
    const result: RenderInstancesParamsImpl = {
      [_implementationProhibited]: "renderInstancesParams",
      instances,
    };

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

export function collectRenderInstancesParamsTransferables(xfers: Set<Transferable>, inParams: RenderInstancesParams): void {
  const params = inParams as RenderInstancesParamsImpl;
  if (params.instances) {
    InstancedGraphicProps.collectTransferables(xfers, params.instances);
  }

  if (params.features) {
    xfers.add(params.features.data.buffer);
  }
}
