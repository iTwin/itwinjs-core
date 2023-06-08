/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { VertexIndices } from "./VertexIndices";
import { VertexTable } from "./VertexTable";

/** Describes point string geometry to be submitted to the rendering system.
 * @internal
 */
export interface PointStringParams {
  vertices: VertexTable;
  indices: VertexIndices;
  weight: number;
}
