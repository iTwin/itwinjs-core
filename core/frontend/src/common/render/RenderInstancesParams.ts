/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { InstancedGraphicProps } from "./InstancedGraphicParams";
import { Range3d, Transform } from "@itwin/core-geometry";
import { Feature, FeatureAppearance, FeatureTable, LinePixels, RgbColorProps } from "@itwin/core-common";
import { _implementationProhibited } from "../internal/Symbols";

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

class PropsBuilder {
  private readonly _instances: Instance[] = [];
  private readonly _transformRange = new Range3d();
  private _haveSymbology = false;
  
  public add(instance: Instance): void {
    this._instances.push(instance);

    this._transformRange.extendXYZ(instance.transform.origin.x, instance.transform.origin.y, instance.transform.origin.z);

    if (instance.symbology) {
      this._haveSymbology = true;
    }
  }

  public get length() { return this._instances.length; }

  public finish(featureTable: FeatureTable | undefined): InstancedGraphicProps | undefined {
    const count = this.length;
    if (0 === count) {
      return undefined;
    }

    const tfc = this._transformRange.center;
    const transformCenter = { x: tfc.x, y: tfc.y, z: tfc.z };

    const transforms = new Float32Array(count * 12);
    const featureIds = featureTable ? new Uint8Array(count * 3) : undefined;
    const symbologyOverrides = this._haveSymbology ? new Uint8Array(count * 8) : undefined;

    for (let i = 0; i < count; i++) {
      const instance = this._instances[i];
      if (featureIds) {
        const feature = typeof instance.feature === "string" ? new Feature(instance.feature) : instance.feature;
        const featureIndex = feature ? featureTable!.insert(feature) : 0;
        featureIds[i * 3 + 0] = featureIndex & 0xff;
        featureIds[i * 3 + 1] = (featureIndex & 0xff00) >> 8;
        featureIds[i * 3 + 2] = (featureIndex & 0xff0000) >> 16;
      }

      if (symbologyOverrides && instance.symbology) {
        // ###TODO
      }

      // ###TODO transform
    }

    return {
      count,
      transforms,
      transformCenter,
      featureIds,
      symbologyOverrides,
    };
  }
}

class Builder implements RenderInstancesParamsBuilder {
  public readonly [_implementationProhibited] = undefined;
  private readonly _opaque = new PropsBuilder();
  private readonly _translucent = new PropsBuilder();
  private readonly _modelId?: Id64String;
  private _numFeatures = 0;
  
  public constructor(modelId?: Id64String) {
    this._modelId = modelId;
  }

  public add(instance: Instance): void {
    // If symbology.transparency is defined and non-zero, the instance goes in the translucent bucket.
    const list = instance.symbology?.transparency ? this._translucent : this._opaque;
    list.add(instance);
    
    if (undefined !== instance.feature) {
      this._numFeatures++;
    }
  }

  public finish(): RenderInstancesParams {
    const numInstances = this._opaque.length + this._translucent.length;
    if (numInstances === 0) {
      return { };
    }

    let featureTable;
    if (this._numFeatures > 0) {
      featureTable = new FeatureTable(numInstances, this._modelId);
      if (this._numFeatures < numInstances) {
        // Some instances don't correspond to a Feature. They'll use feature index zero.
        featureTable.insert(new Feature());
      }
    }

    return {
      opaque: this._opaque.finish(featureTable),
      translucent: this._translucent.finish(featureTable),
      // ###TODO features
    };
  }
}
