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
import { GraphicType } from "./GraphicType";
import { PickableGraphicOptions } from "./BatchOptions";
import { _implementationProhibited } from "../internal/Symbols";
import { WorkerGraphicDescriptionContext } from "./GraphicDescriptionContext";

/** An opaque representation of a [[RenderGraphic]] created by a [[GraphicDescriptionBuilder]].
 * Unlike `RenderGraphic`, a `GraphicDescription` does not allocate any WebGL resources like textures, vertex buffers, etc, so
 * it can be created on and/or passed to and from a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker).
 * @see [[RenderSystem.createGraphicFromDescription]] to convert it to a [[RenderGraphic]].
 * @beta
 */
export interface GraphicDescription {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
}

/** @beta */
export namespace GraphicDescription {
  /** Adds to `transferables` all of the [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) like
   * `ArrayBuffer`s that are included in `description`. This makes copying a [[GraphicDescription]] to and from a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker)
   * much more efficient.
   */
  export function collectTransferables(transferables: Set<Transferable>, description: GraphicDescription): void {
    return collectGraphicDescriptionTransferables(transferables, description);
  }
}

/** Arguments supplied to [[GraphicDescriptionBuilderOptions.computeChordTolerance]] to help compute an appropriate level of detail for the [[GraphicDescription]].
 * @beta
 */
export interface ComputeGraphicDescriptionChordToleranceArgs {
  /** The builder that is constructing the [[GraphicDescription]]. */
  builder: GraphicDescriptionBuilder;
  /** A function that computes a bounding box enclosing all of the geometry in the [[builder]]. */
  computeRange: () => Range3d;
}

/** Options supplied to [[GraphicDescriptionBuilder.create]].
 * @beta
 */
export type GraphicDescriptionBuilderOptions = {
  /** The type of graphic to create. This influences the default values of some other options like [[generateEdges]] and
   * properties like [[GraphicDescriptionBuilder.wantNormals]].
   */
  type: GraphicType;
  /** The local-to-world transform in which the builder's geoemtry is to be defined.
   * Default: an identity transform.
   */
  placement?: Transform;
  /** If the graphic is to contain one or more [Feature]($common)s, specifies the initial pickable Id and other options. */
  pickable?: PickableGraphicOptions;
  /** Specifies whether edges are generated for surfaces.
   * By default, edges are only produced if [[type]] is [[GraphicType.Scene]].
   */
  generateEdges?: boolean;
  /** Computes the level of detail in meters for the graphics produced by the builder. */
  computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
  /** Context in which the graphic description will be created, obtained from the [[RenderSystem]] on the main thread. */
  context: WorkerGraphicDescriptionContext;
} & ({
  /** If defined, specifies a point about which the graphic will rotate such that it always faces the viewer.
   * This can be particular useful for planar regions to create a billboarding effect - e.g., to implement [[Marker]]-like WebGL decorations.
   * The graphic's [[placement]] transform is not applied to the point.
   * @note This has no effect for graphics displayed in a 2d view.
   */
  viewIndependentOrigin?: Point3d;
  /** @internal */
  instances?: never;
}/* ) | {
  instances?: InstancedGraphicParams;
  viewIndependentOrigin?: never;
}*/);

/** An equivalent of a [[GraphicBuilder]] that is designed for use on a [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker).
 * Unlike [[GraphicBuilder.finish]], which produces a [[RenderGraphic]], [[GraphicDescriptionBuilder.finish]] produces a [[GraphicDescription]].
 * The `GraphicDescription` can be returned from the Worker to the main thread, where [[RenderSystem.createGraphicFromDescription]] can be used
 * to quickly convert it to a `RenderGraphic`.
 * Produce graphics using `GraphicDescriptionBuilder` on a Worker instead of using `GraphicBuilder` when you have graphics that may take a non-trivial
 * amount of time to create, to avoid blocking the main JavaScript event loop.
 * @see [[GraphicDescriptionBuilder.create]] to instantiate this type.
 * @beta
 */
export interface GraphicDescriptionBuilder extends GraphicAssembler {
  /** Processes the accumulated symbology and geometry to produce a description of a renderable graphic.
   * This function should only be called once; after the [[GraphicDescription]] has been extracted, the [[GraphicDescriptionBuilder]] should no longer be used.
   */
  finish(): GraphicDescription;
}

/** @beta */
export namespace GraphicDescriptionBuilder {
  /** Create a [[GraphicDescriptionBuilder]] using the specified `options`. */
  export function create(options: GraphicDescriptionBuilderOptions): GraphicDescriptionBuilder {
    return new GraphicDescriptionBuilderImpl(options);
  }
}
