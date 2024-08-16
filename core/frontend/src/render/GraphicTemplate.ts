/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Transform } from "@itwin/core-geometry";
import { _implementationProhibited, _nodes } from "../common/internal/Symbols";
import { RenderGeometry } from "../internal/render/RenderGeometry";
import { RenderInstances } from "./RenderSystem";

/** @internal */
export interface GraphicTemplateNode {
  geometry: RenderGeometry[];
  // For glTF models, the flattened transform of the scene graph node.
  transform?: Transform;
  // For glTF models, the instances associated with the scene graph node, or with the model as a whole.
  instances?: RenderInstances;
}

export interface GraphicTemplate {
  readonly [_implementationProhibited]: unknown;

  readonly isInstanceable: boolean;

  /** @internal */
  [_nodes]: GraphicTemplateNode[];
}
