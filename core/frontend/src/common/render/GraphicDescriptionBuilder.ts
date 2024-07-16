/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { GraphicAssembler } from "./GraphicAssembler";
import { collectGraphicDescriptionTransferables, GraphicDescriptionBuilderImpl } from "../internal/render/GraphicDescriptionBuilderImpl";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { InstancedGraphicParams } from "./InstancedGraphicParams";
import { GraphicType } from "./GraphicType";
import { PickableGraphicOptions } from "./BatchOptions";
import { _implementationProhibited } from "../internal/Symbols";
import { Id64String } from "@itwin/core-bentley";

/**
 * @beta
 */
export interface GraphicDescription {
  // ###TODO [_implementationProhibited]
  removeMe?: unknown; // ###TODO "empty interface" lint error
}

/**
 * @beta
 */
export namespace GraphicDescription {
  export function collectTransferables(description: GraphicDescription): Transferable[] {
    return collectGraphicDescriptionTransferables(description);
  }
}

/**
 * @beta
 */
export interface GraphicDescriptionConstraints {
  // ###TODO [_implementationProhibited]
  readonly maxTextureSize: number;
}

/** Describes a [[WorkerGraphicDescriptionContext]] in a form that can be passed from the main thread to a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker).
 * @see [[RenderSystem.createWorkerGraphicDescriptionContext]] to obtain an implementation of this type.
 * @beta
 */
export interface WorkerGraphicDescriptionContextProps {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
}

/** Context allocated on a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to enable it to create [[GraphicDescription]]s.
 * When the Worker returns one or more GraphicDescriptions to the main thread, it should also return this context as a [[GraphicDescriptionContextProps]].
 * @see [[WorkerGraphicDescriptionContext.fromProps]] to instantiate this type.
 * @beta
 */
export interface WorkerGraphicDescriptionContext {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly constraints: GraphicDescriptionConstraints;
  getNextTransientId(): Id64String;
  toProps(transferables: Set<Transferable>): GraphicDescriptionContextProps;
}

/** @beta */
export namespace WorkerGraphicDescriptionContext {
  export function fromProps(_props: WorkerGraphicDescriptionContextProps): WorkerGraphicDescriptionContext {
    throw new Error("###TODO");
  }
}

/** Describes a [[GraphicDescriptionContext]] returned from a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker) to the main thread, holding resources like
 * transient Ids, textures, and materials that were allocated on the Worker for use by [[GraphicDescription]]s.
 * @see [[WorkerGraphicDescriptionContext.toProps]] to obtain an implementation of this type.
 * @beta
 */
export interface GraphicDescriptionContextProps {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
  
}

/** Context holding resources like transient Ids, textures, and materials that were allocated on a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker) by a
 * [[WorkerGraphicDescriptionContext]] for use in [[GraphicDescription]]s. This context must be supplied to [[RenderSystem.createGraphicFromDescription]] when converting a
 * GraphicDescription to a [[RenderGraphic]].
 * @see [[RenderSystem.createGraphicDescriptionContext]] to obtain an implementation of this type.
 * @beta
 */
export interface GraphicDescriptionContext {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
}

/**
 * @beta
 */
export type FinishGraphicDescriptionArgs = {
  viewIndependentOrigin?: Point3d;
  instances?: never;
} | {
  instances?: InstancedGraphicParams;
  viewIndependentOrigin?: never;
};

/**
 * @beta
 */
export interface ComputeGraphicDescriptionChordToleranceArgs {
  builder: GraphicDescriptionBuilder;
  computeRange: () => Range3d;
}

/**
 * @beta
 */
export interface GraphicDescriptionBuilderOptions {
  type: GraphicType;
  placement?: Transform;
  pickable?: PickableGraphicOptions;
  generateEdges?: boolean;
  computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
  constraints: GraphicDescriptionConstraints;
}

/**
 * @beta
 */
export interface GraphicDescriptionBuilder extends GraphicAssembler {
  // ###TODO [_implementationProhibited]
  finish(args?: FinishGraphicDescriptionArgs): GraphicDescription;
}

/**
 * @beta
 */
export namespace GraphicDescriptionBuilder {
  export function create(options: GraphicDescriptionBuilderOptions): GraphicDescriptionBuilder {
    return new GraphicDescriptionBuilderImpl(options);
  }
}
