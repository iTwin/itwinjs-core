/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { Feature, LinePixels, RgbColorProps } from "@itwin/core-common";
import { _implementationProhibited } from "../internal/Symbols";
import { collectRenderInstancesParamsTransferables, createRenderInstancesParamsBuilder } from "../../internal/render/RenderInstancesParamsImpl";

/** Represents a [[RenderInstances]] in a form that supports [structured cloning](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone),
 * e.g., for transferring between Workers and the main JavaScript thread.
 * @see [[RenderInstancesParamsBuilder]] to create one.
 * @see [[RenderInstancesParams.collectTransferables]] to gather up [Tranferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
 * for cloning.
 * @beta
 */
export interface RenderInstancesParams {
  /** @internal */
  readonly [_implementationProhibited]: "renderInstancesParams";
}

/** @beta */
export namespace RenderInstancesParams {
  /** Add to `xfers` all [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) contained
   * in `params`.
   */
  export function collectTransferables(xfers: Set<Transferable>, params: RenderInstancesParams): void {
    return collectRenderInstancesParamsTransferables(xfers, params);
  }
}

/** Describes the appearance overrides to be applied to an [[Instance]].
 * If any property is omitted, the corresponding aspect of the appearance will use that defined by the [[GraphicTemplate]].
 * @beta
 */
export interface InstanceSymbology {
  /** The width, in pixels, of curves and edges, Values are clamped to the range [1..31] and truncated to integers. */
  weight?: number;
  /** The dash pattern applied to curves and edges. */
  linePixels?: LinePixels;
  /** The color applied to the geometry. */
  color?: RgbColorProps;
}

/** Represents one repetition of a [[GraphicTemplate]]. Each `Instance` draws the same graphics defined by the template, but with its own position, rotation, and/or scaling [[transform]].
 * Each instance can optionally selectively override aspects of the template graphic's [[symbology]] and/or specify a [[feature]] that permits it to be interacted with
 * independently of any other instances.
 * @see [[RenderInstancesParamsBuilder]] to create a collection of `Instance`s.
 * @beta
 */
export interface Instance {
  /** The translation, rotation, and/or scaling to apply to the template. */
  transform: Transform;
  /** Uniquely identifies the [Feature]($common) that this instance represents. For convenience, a single Id can be supplied. */
  feature?: Feature | Id64String;
  /** If present, specifies how to override aspects of the template's appearance, e.g., by changing its color. */
  symbology?: InstanceSymbology;
}

/** Arguments supplied to [[RenderInstancesParamsBuilder.create]].
 * @beta
 */
export interface CreateRenderInstancesParamsBuilderArgs {
  /** If the [[Instance]]s will define [Feature]($common)s, an optional Id of a container ("model") used to group them together. */
  modelId?: Id64String;
}

/** Provides methods to populate a [[RenderInstancesParams]] from a list of [[Instance]]s.
 * Use [[add]] to append instances, then [[finish]] to obtain the result.
 * @beta
 */
export interface RenderInstancesParamsBuilder {
  /** @internal */
  [_implementationProhibited]: unknown;
  /** Append an instance to the collection. */
  add(instance: Instance): void;
  /** Obtain a [[RenderInstancesParams]] representing the set of [[Instance]]s that have been [[add]]ed to the collection. */
  finish(): RenderInstancesParams;
}

/** @beta */
export namespace RenderInstancesParamsBuilder {
  /** Create a [[RenderInstancesParamsBuilder]]. */
  export function create(args: CreateRenderInstancesParamsBuilderArgs): RenderInstancesParamsBuilder {
    return createRenderInstancesParamsBuilder(args);
  }
}
