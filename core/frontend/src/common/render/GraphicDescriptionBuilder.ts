/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { GraphicAssembler } from "./GraphicAssembler";
import { GraphicDescriptionBuilderImpl, collectGraphicDescriptionTransferables } from "../internal/render/GraphicDescriptionBuilderImpl";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { InstancedGraphicParams } from "./InstancedGraphicParams";
import { GraphicType } from "./GraphicType";
import { PickableGraphicOptions } from "./BatchOptions";

export interface GraphicDescription {
  // ###TODO [_implementationProhibited]
}

export namespace GraphicDescription {
  export function collectTransferables(description: GraphicDescription): Transferable[] {
    return collectGraphicDescriptionTransferables(description);
  }
}

export interface GraphicDescriptionConstraints {
  // ###TODO [_implementationProhibited]
  readonly maxTextureSize: number;
}

export type FinishGraphicDescriptionArgs = {
  viewIndependentOrigin?: Point3d;
  instances?: never;
} | {
  instances?: InstancedGraphicParams;
  viewIndependentOrigin?: never;
}
  
export interface ComputeGraphicDescriptionChordToleranceArgs {
  builder: GraphicDescriptionBuilder;
  computeRange: () => Range3d;
}

export interface GraphicDescriptionBuilderOptions {
  type: GraphicType;
  placement?: Transform;
  pickable?: PickableGraphicOptions;
  generateEdges?: boolean;
  computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
  constraints: GraphicDescriptionConstraints;
}

export interface GraphicDescriptionBuilder extends GraphicAssembler {
  // ###TODO [_implementationProhibited]
  finish(args?: FinishGraphicDescriptionArgs): GraphicDescription;
}

export namespace GraphicDescriptionBuilder {
  export function create(options: GraphicDescriptionBuilderOptions): GraphicDescriptionBuilder {
    return new GraphicDescriptionBuilderImpl(options);
  }
}
