/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { AuxChannelTable } from "./AuxChannelTable";
import { VertexTable } from "./VertexTable";
import { SurfaceParams } from "./SurfaceParams";
import { EdgeParams } from "./EdgeParams";

/** Describes mesh geometry to be submitted to the rendering system.
 * A mesh consists of a surface and its edges, which may include any combination of silhouettes, polylines, and single segments.
 * The surface and edges all refer to the same vertex table.
 * @internal
 */
export interface MeshParams {
  vertices: VertexTable;
  surface: SurfaceParams;
  edges?: EdgeParams;
  isPlanar: boolean;
  auxChannels?: AuxChannelTable;
}
