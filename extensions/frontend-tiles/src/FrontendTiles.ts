/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SpatialTileTreeReferences, SpatialViewState } from "@itwin/core-frontend";

const impl = SpatialTileTreeReferences.create;

export function createSpatialTileTreeReferences(view: SpatialViewState): SpatialTileTreeReferences {
  console.log("hi");
  return impl(view);
}
