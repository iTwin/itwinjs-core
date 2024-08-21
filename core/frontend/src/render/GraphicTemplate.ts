/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Range3d, Transform } from "@itwin/core-geometry";
import { _batch, _branch, _implementationProhibited, _nodes } from "../common/internal/Symbols";
import { RenderGeometry } from "../internal/render/RenderGeometry";
import { RenderFeatureTable, ViewFlagOverrides } from "@itwin/core-common";
import { InstancedGraphicParams } from "../common/render/InstancedGraphicParams";
import { BatchOptions } from "../common/render/BatchOptions";

/** @internal */
export interface GraphicTemplateNode {
  geometry: RenderGeometry[];
  /** For glTF models, the flattened transform of the scene graph node. */
  transform?: Transform;
  /** For glTF models, the instances associated with the scene graph node, or with the model as a whole. */
  instances?: InstancedGraphicParams;
}

/** Describes the collection of $[Feature]($common)s in a [[GraphicTemplate]].
 * If the template is used for instancing, the batch information in the [[RenderInstances]] overrides this.
 * @internal
 */
export interface GraphicTemplateBatch {
  readonly featureTable: RenderFeatureTable;
  readonly options?: BatchOptions;
  readonly range: Range3d;
}

/** Applies a transform and/or view flag overrides to all of the nodes in a [[GraphicTemplate]].
 * @internal
 */
export interface GraphicTemplateBranch {
  readonly transform?: Transform;
  readonly viewFlagOverrides?: ViewFlagOverrides;
}

/** A reusable representation of a [[RenderGraphic]].
 * You can use [[RenderSystem.createGraphicFromTemplate]] to produce a [[RenderGraphic]] from a template.
 * The template contains all of the WebGL resources required to render the graphics, so no matter how many times you use the template,
 * no additional GPU resources will be allocated.
 * The primary use for a template is [instanced rendering](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html) - efficiently
 * drawing many repetitions of the same graphic with different positions, scales, rotations, and symbology.
 * Using instancing to draw 1 template N times is far more efficient than drawing N [[RenderGraphic]]s created from the same template.
 * You can instance a template by supplying a [[RenderInstances]] to [[RenderSystem.createGraphicFromTemplate]], unless [[isInstanceable]] is `false`.
 */
export interface GraphicTemplate {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** Whether the graphics in this template can be instanced. Non-instanceable graphics include those produced from glTF models that already
   * contain instanced geometry and view-independent geometry created from a [[GraphicBuilder]].
   * [[RenderSystem.createGraphicFromTemplate]] will throw an error if you attempt to instance a non-instanceable template by supplying
   * [[CreateGraphicFromTemplateArgs.instances]].
   */
  readonly isInstanceable: boolean;

  /** @internal */
  readonly [_nodes]: GraphicTemplateNode[];
  /** @internal */
  readonly [_batch]?: GraphicTemplateBatch;
  /** @internal */
  readonly [_branch]?: GraphicTemplateBranch;
}

/** Create a GraphicTemplate.
 * If the caller specifies `noDispose` as `true`, every RenderGeometry in every node will be marked `noDispose`;
 * this permits the same template to be reused by multiple graphics. The garbage collector will reclaim its
 * WebGL resources and its `dispose` method will do nothing.
 * The `isInstancable` flag will be calculated from the nodes and their geometry.
 * @internal
 */
export function createGraphicTemplate(args: {
  nodes: GraphicTemplateNode[],
  batch?: GraphicTemplateBatch,
  noDispose: boolean,
  branch?: GraphicTemplateBranch,
}): GraphicTemplate {
  let isInstanceable = true;
  for (const node of args.nodes) {
    if (node.instances) {
      isInstanceable = false;
    }

    for (const geometry of node.geometry) {
      geometry.noDispose = args.noDispose;
      if (!geometry.isInstanceable) {
        isInstanceable = false;
      }
    }
  }

  return {
    [_implementationProhibited]: undefined,
    isInstanceable,
    [_nodes]: args.nodes,
    [_batch]: args.batch,
    [_branch]: args.branch,
  };
}
