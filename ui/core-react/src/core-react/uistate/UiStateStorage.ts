/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiStateStorage
 */

/** Interface for getting, saving and deleting settings.
 * @public
 */
export interface UiStateStorage {
  getSetting(settingNamespace: string, settingName: string): Promise<UiStateStorageResult>;
  saveSetting(settingNamespace: string, settingName: string, setting: any): Promise<UiStateStorageResult>;
  deleteSetting(settingNamespace: string, settingName: string): Promise<UiStateStorageResult>;
}

/** Enum for [[UiStateStorage]] status.
 * @public
 */
export enum UiStateStorageStatus {
  Success = 0,
  NotFound = 1,
  UnknownError = 2,
  Uninitialized = 3,
  AuthorizationError = 4,
}

/** Interface for result of accessing UI state setting in [[UiStateStorage]].
 * @public
 */
export interface UiStateStorageResult {
  status: UiStateStorageStatus;
  setting?: any;
}
