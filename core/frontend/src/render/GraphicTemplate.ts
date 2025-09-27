/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { _batch, _branch, _implementationProhibited, _nodes } from "../common/internal/Symbols";
import { GraphicTemplateBatch, GraphicTemplateBranch, GraphicTemplateNode } from "../internal/render/GraphicTemplateImpl";

/** A reusable representation of a [[RenderGraphic]].
 * You can use [[RenderSystem.createGraphicFromTemplate]] to produce a [[RenderGraphic]] from a template.
 * The template contains all of the WebGL resources required to render the graphics, so no matter how many times you use the template,
 * no additional GPU resources will be allocated.
 * The primary use for a template is [instanced rendering](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html) - efficiently
 * drawing many repetitions of the same graphic with different positions, scales, rotations, and symbology.
 * Using instancing to draw 1 template N times is far more efficient than drawing N [[RenderGraphic]]s created from the same template.
 * You can instance a template by supplying a [[RenderInstances]] to [[RenderSystem.createGraphicFromTemplate]], unless [[isInstanceable]] is `false`.
 * @see [[GraphicBuilder.finishTemplate]] to create a template from a [[GraphicBuilder]].
 * @see [[RenderSystem.createTemplateFromDescription]] to create a template from a [[GraphicDescription]].
 * @see [[readGltfTemplate]] to create a template from a glTF model.
 * @beta
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
  /** @internal */
  isGltf?: boolean;
}
