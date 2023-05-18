/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { AuxChannelTable } from "./AuxChannelTable";
import { VertexTableParams } from "./VertexTableParams";
import { SurfaceParams } from "./SurfaceParams";
import { EdgeParams } from "./EdgeParams";

/**
 * Describes mesh geometry to be submitted to the rendering system.
 * A mesh consists of a surface and its edges, which may include any combination of silhouettes, polylines, and single segments.
 * The surface and edges all refer to the same vertex table.
 */
export interface MeshParams {
  vertices: VertexTableParams;
  surface: SurfaceParams;
  edges?: EdgeParams;
  isPlanar: boolean;
  auxChannels?: AuxChannelTable;
}
