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
  transform?: Transform;
  instances?: RenderInstances;
}

export interface GraphicTemplate {
  readonly [_implementationProhibited]: unknown;

  readonly isInstanceable: boolean;

  /** @internal */
  [_nodes]: GraphicTemplateNode[];
}
