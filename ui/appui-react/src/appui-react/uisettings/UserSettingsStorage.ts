/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

/* eslint-disable deprecation/deprecation */

import { IModelApp } from "@itwin/core-frontend";
import { UiSettingsResult, UiSettingsStatus, UiSettingsStorage } from "@itwin/core-react";

/**
 * Implementation of [[UiSettings]] that uses settings admin from [IModelApp.userPreferences]($core-frontend).
 * @public
 * @deprecated Use [IModelApp.userPreferences]($core-frontend) API directly to store user preferences as a replacement.
 */
export class UserSettingsStorage implements UiSettingsStorage {
  public async getSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    if (undefined === IModelApp.authorizationClient)
      return { status: UiSettingsStatus.AuthorizationError };
    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiSettingsStatus.AuthorizationError };

    if (!IModelApp.userPreferences)
      return { status: UiSettingsStatus.Uninitialized };
    const result = await IModelApp.userPreferences.get({ accessToken, key: `${namespace}.${name}` });
    return {
      status: UiSettingsStatus.Success,
      setting: result,
    };
  }

  public async saveSetting(namespace: string, name: string, setting: any): Promise<UiSettingsResult> {
    if (!IModelApp.userPreferences)
      return { status: UiSettingsStatus.Uninitialized };

    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiSettingsStatus.AuthorizationError };

    const result = await IModelApp.userPreferences.save({ accessToken, content: setting, key: `${namespace}.${name}` });
    return {
      status: UiSettingsStatus.Success,
      setting: result,
    };
  }

  public async deleteSetting(namespace: string, name: string): Promise<UiSettingsResult> {
    if (!IModelApp.userPreferences)
      return { status: UiSettingsStatus.Uninitialized };

    const accessToken = await IModelApp.getAccessToken();
    if (accessToken === "")
      return { status: UiSettingsStatus.AuthorizationError };
    const result = await IModelApp.userPreferences.delete({ accessToken, key: `${namespace}.${name}` });
    return {
      status: UiSettingsStatus.Success,
      setting: result,
    };
  }
}
