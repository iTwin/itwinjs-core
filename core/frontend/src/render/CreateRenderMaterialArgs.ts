/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { MaterialParams } from "../common/render/MaterialParams.js";
import { RenderMaterialSource } from "../internal/render/RenderMaterialSource.js";

/** Arguments supplied to [[RenderSystem.createRenderMaterial]].
 * @public
 */
export interface CreateRenderMaterialArgs extends MaterialParams {
  /** If supplied, the material will be cached on the iModel by its element Id for subsequent reuse.
   * @internal
   */
  source?: RenderMaterialSource;
}
