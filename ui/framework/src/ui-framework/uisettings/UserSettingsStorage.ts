/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import { AuthStatus, BentleyError } from "@bentley/bentleyjs-core";
import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { SettingsStatus } from "@bentley/product-settings-client";
import { UiSettingsResult, UiSettingsStatus, UiSettingsStorage } from "@bentley/ui-core";

/**
 * Implementation of [[UiSettings]] that uses settings admin from `IModelApp.settings`.
 * @public
 */
export class UserSettingsStorage implements UiSettingsStorage {
  public async getSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    let requestContext;
    try {
      requestContext = await AuthorizedFrontendRequestContext.create();
    } catch (err: unknown) {
      if (err instanceof BentleyError && err.errorNumber === AuthStatus.Error)
        return { status: UiSettingsStatus.AuthorizationError };
      throw err;
    }
    const result = await IModelApp.settings.getUserSetting(requestContext, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async saveSetting(namespace: string, name: string, setting: any): Promise<UiSettingsResult> {
    let requestContext;
    try {
      requestContext = await AuthorizedFrontendRequestContext.create();
    } catch (err: unknown) {
      if (err instanceof BentleyError && err.errorNumber === AuthStatus.Error)
        return { status: UiSettingsStatus.AuthorizationError };
      throw err;
    }
    const result = await IModelApp.settings.saveUserSetting(requestContext, setting, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }

  public async deleteSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    let requestContext;
    try {
      requestContext = await AuthorizedFrontendRequestContext.create();
    } catch (err: unknown) {
      if (err instanceof BentleyError && err.errorNumber === AuthStatus.Error)
        return { status: UiSettingsStatus.AuthorizationError };
      throw err;
    }
    const result = await IModelApp.settings.deleteUserSetting(requestContext, namespace, name, true);
    const status = settingsStatusToUiSettingsStatus(result.status);
    return {
      status,
      setting: result.setting,
    };
  }
}

/** @internal */
export function settingsStatusToUiSettingsStatus(status: SettingsStatus): UiSettingsStatus {
  if (status === SettingsStatus.Success)
    return UiSettingsStatus.Success;
  else if (status === SettingsStatus.SettingNotFound)
    return UiSettingsStatus.NotFound;
  else if (status === SettingsStatus.AuthorizationError)
    return UiSettingsStatus.AuthorizationError;
  return UiSettingsStatus.UnknownError;
}

/** Alias for [[UserSettingsStorage]]
 * @beta
 * @deprecated use UserSettingsStorage
 */
export class IModelAppUiSettings extends UserSettingsStorage {
}
