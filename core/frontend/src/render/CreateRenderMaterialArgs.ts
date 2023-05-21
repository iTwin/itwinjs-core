/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { MaterialParams } from "../common/render/MaterialParams";

/** Specifies the provenance of a [RenderMaterial]($common) created for a persistent material element.
 * @see [[CreateRenderMaterialArgs.source]].
 * @internal
 */
export interface RenderMaterialSource {
  iModel: IModelConnection;
  id: Id64String;
}

/** Arguments supplied to [[RenderSystem.createRenderMaterial]].
 * @public
 */
export interface CreateRenderMaterialArgs extends MaterialParams {
  /** If supplied, the material will be cached on the iModel by its element Id for subsequent reuse.
   * @internal
   */
  source?: RenderMaterialSource;
}
