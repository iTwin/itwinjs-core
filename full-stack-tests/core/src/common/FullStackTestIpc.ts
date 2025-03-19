/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { CodeProps, ITwinError, SubCategoryAppearance } from "@itwin/core-common";

export const fullstackIpcChannel = "full-stack-tests/fullStackIpc";
export interface FullStackTestIpc {
  createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String>;
  createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String>;
  closeAndReopenDb(key: string): Promise<void>;
  throwBackendError<T extends ITwinError>(args: T): Promise<void>;
}
