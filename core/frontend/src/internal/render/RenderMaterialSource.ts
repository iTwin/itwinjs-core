/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "../../IModelConnection";

/** Specifies the provenance of a [RenderMaterial]($common) created for a persistent material element.
 * @see [[CreateRenderMaterialArgs.source]].
 */
export interface RenderMaterialSource {
  iModel: IModelConnection;
  id: Id64String;
}

