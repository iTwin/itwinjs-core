/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiStateStorage
 */

import { IModelApp } from "@itwin/core-frontend";
import type { UiStateStorage, UiStateStorageResult} from "@itwin/core-react";
import { UiStateStorageStatus } from "@itwin/core-react";

/**
 * Implementation of [[UiStateStorage]] that uses settings admin from [IModelApp.userPreferences]($core-frontend).
 * @public
 * @deprecated Use [IModelApp.userPreferences]($core-frontend) API directly to store user preferences as a replacement.
 */
export class UserSettingsStorage implements UiStateStorage {
  public async getSetting(namespace: string, name: string): Promise<UiStateStorageResult> {
    if (undefined === IModelApp.authorizationClient)
      return { status: UiStateStorageStatus.AuthorizationError };
    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiStateStorageStatus.AuthorizationError };

    if (!IModelApp.userPreferences)
      return { status: UiStateStorageStatus.Uninitialized };
    const result = await IModelApp.userPreferences.get({ accessToken, key: `${namespace}.${name}` });
    return {
      status: UiStateStorageStatus.Success,
      setting: result,
    };
  }

  public async saveSetting(namespace: string, name: string, setting: any): Promise<UiStateStorageResult> {
    if (!IModelApp.userPreferences)
      return { status: UiStateStorageStatus.Uninitialized };

    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiStateStorageStatus.AuthorizationError };

    const result = await IModelApp.userPreferences.save({ accessToken, content: setting, key: `${namespace}.${name}` });
    return {
      status: UiStateStorageStatus.Success,
      setting: result,
    };
  }

  public async deleteSetting(namespace: string, name: string): Promise<UiStateStorageResult> {
    if (!IModelApp.userPreferences)
      return { status: UiStateStorageStatus.Uninitialized };

    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiStateStorageStatus.AuthorizationError };
    const result = await IModelApp.userPreferences.delete({ accessToken, key: `${namespace}.${name}` });
    return {
      status: UiStateStorageStatus.Success,
      setting: result,
    };
  }
}
