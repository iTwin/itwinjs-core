/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { _implementationProhibited } from "../../common/internal/Symbols";
import { RenderMemory } from "../../render/RenderMemory";

/** An opaque representation of instructions for repeatedly drawing a [[RenderGeometry]] to pattern a planar region,
 * to be supplied to [[RenderSystem.createRenderGraphic]].
 */
export interface RenderAreaPattern extends Disposable, RenderMemory.Consumer {
  readonly [_implementationProhibited]: "renderAreaPattern";
}

