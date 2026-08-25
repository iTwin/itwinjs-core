/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EditCommandIpc } from "@itwin/editor-common";
import { Id64String, LoggingMetaData } from "@itwin/core-bentley";
import { ChannelControlError, CodeProps, ConflictingLock, ElementProps, SaveChangesArgs, SubCategoryAppearance } from "@itwin/core-common";

export const fullstackIpcChannel = "full-stack-tests/fullStackIpc";
export const fullStackTestCommandId = "full-stack-tests.fullStackTestCommand";

/** EditCommand operations for model/element manipulation */
export interface FullStackTestCommandIpc extends EditCommandIpc {
  createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String>;
  createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String>;
  insertElement(iModelKey: string, props: ElementProps): Promise<Id64String>;
  updateElement(iModelKey: string, props: ElementProps): Promise<void>;
  deleteDefinitionElements(iModelKey: string, ids: string[]): Promise<void>;
  saveChangesAndReturnProps(iModelKey: string, propertyName: string, description?: string): Promise<SaveChangesArgs | undefined>;
  endEditsAndReturnProps(iModelKey: string, propertyName: string, description?: string): Promise<SaveChangesArgs | undefined>;
}

/** Utility IPC interface that does not require EditCommand APIs. */
export interface FullStackTestIpc {
  closeAndReopenDb(key: string): Promise<void>;
  insertSheetViewWithAttachment(filePath: string): Promise<Id64String>;
  throwLockError(conflictingLocks: ConflictingLock[], message: string, metaData: LoggingMetaData, logFn: boolean): Promise<void>;
  throwChannelError(errorKey: ChannelControlError.Key, message: string, channelKey: string): Promise<void>;
  restoreAuthClient(): Promise<void>;
  useAzTestAuthClient(): Promise<void>;
  setAzTestUser(user: "admin" | "readOnly" | "readWrite"): Promise<void>;
}
