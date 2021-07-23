/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AuthorizedFrontendRequestContext } from "../../FrontendRequestContext";
import { IModelApp } from "../../IModelApp";
import { SettingsStatus } from "@bentley/product-settings-client";
import { EsriOAuthClientIds } from "../internal";

/** @beta */
export class EsriSettingsService {

  public static get sourceNamespace() {
    return "EsriSettings-SettingsService";
  }

  /**
   * Store the source in the settings service. Returns false if the settings object would override some other settings object in a larger scope i.e. storing settings on model when
   * a project setting exists with same name or map layer url.
   * @param source source to be stored on the setting service
   * @param storeOnIModel if true store the settings object on the model, if false store it on the project
   */
  public static async storeClientIds(clientIds: EsriOAuthClientIds): Promise<boolean> {
    try {
      const requestContext = await AuthorizedFrontendRequestContext.create();

      requestContext.enter();
      const settingName = "OauthClientIds";
      const settingFromName = await IModelApp.settings.getSetting(requestContext, this.sourceNamespace, settingName, true);
      requestContext.enter();
      if (settingFromName.setting === SettingsStatus.Success) {
        await IModelApp.settings.deleteSetting(requestContext, this.sourceNamespace, settingFromName.setting.name, true);
        requestContext.enter();
      }

      const result = await IModelApp.settings.saveSetting(requestContext, clientIds, this.sourceNamespace, settingName, true);
      requestContext.enter();
      return result.status === SettingsStatus.Success;
    } catch (_err) {
      return false;
    }

  }

  public static async getClientIds(): Promise<EsriOAuthClientIds|undefined> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    requestContext.enter();
    const settingName = "OauthClientIds";
    const settingResult = await IModelApp.settings.getSetting(requestContext, this.sourceNamespace, settingName, true);
    requestContext.enter();
    if (settingResult.status === SettingsStatus.Success) {
      return (settingResult.setting as EsriOAuthClientIds);
    }
    return undefined;
  }
}
