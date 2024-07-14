/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { GraphicAssembler } from "./GraphicAssembler";
import { collectGraphicDescriptionTransferables } from "../internal/render/GraphicDescriptionBuilderImpl";
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

export type FinishGraphicDescriptionArgs = {
  viewIndependentOrigin?: Point3d;
  instances?: never;
} | {
  instances?: InstancedGraphicParams;
  viewIndependentOrigin?: never;
}
  
export interface GraphicDescriptionBuilder extends GraphicAssembler {
  // ###TODO [_implementationProhibited]
  finish(args?: FinishGraphicDescriptionArgs): GraphicDescription;
}

export interface ComputeGraphicDescriptionChordToleranceArgs {
  builder: GraphicDescriptionBuilder;
  computeRange: () => Range3d;
}

export interface GraphicDescriptionBuilderOptions {
  type: GraphicType;
  placement?: Transform;
  pickable?: PickableGraphicOptions;
  computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
}
