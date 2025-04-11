/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String, LoggingMetaData } from "@itwin/core-bentley";
import { ChannelControlError, CodeProps, ConflictingLock, SubCategoryAppearance } from "@itwin/core-common";

export const fullstackIpcChannel = "full-stack-tests/fullStackIpc";
export interface FullStackTestIpc {
  createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String>;
  createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String>;
  closeAndReopenDb(key: string): Promise<void>;
  throwLockError(conflictingLocks: ConflictingLock[], message: string, metaData: LoggingMetaData, logFn: boolean): Promise<void>;
  throwChannelError(errorKey: ChannelControlError.Key, message: string, channelKey: string): Promise<void>;
  restoreAuthClient(): Promise<void>;
  useAzTestAuthClient(): Promise<void>;
  setAzTestUser(user: "admin" | "readOnly" | "readWrite"): Promise<void>;
}
