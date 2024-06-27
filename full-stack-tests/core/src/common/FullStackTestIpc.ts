/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CodeProps, ConflictingLock, SubCategoryAppearance } from "@itwin/core-common";
import { Id64String, LoggingMetaData } from "@itwin/core-bentley";

export const fullstackIpcChannel = "full-stack-tests/fullStackIpc";
export interface FullStackTestIpc {
  createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String>;
  createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String>;
  closeAndReopenDb(key: string): Promise<void>;
  throwConflictingLocksError(message: string, metaData?: LoggingMetaData, conflictingLocks?: ConflictingLock[]): Promise<void>;
}
