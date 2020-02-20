/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { PropertyFullName, FavoritePropertiesOrderInfo } from "./FavoritePropertiesManager";

const IMODELJS_PRESENTATION_SETTING_NAMESPACE = "imodeljs.presentation";
const DEPRECATED_PROPERTIES_SETTING_NAMESPACE = "Properties";
const FAVORITE_PROPERTIES_SETTING_NAME = "FavoriteProperties";
const FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME = "FavoritePropertiesOrderInfo";

/**
 * Stores user settings for favorite properties.
 * @internal
 */
export interface IFavoritePropertiesStorage {
  /** Load Favorite properties from user-specific settings.
   * @param projectId Project Id, if the settings is specific to a project, otherwise undefined.
   * @param imodelId iModel Id, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  loadProperties(projectId?: string, imodelId?: string): Promise<Set<PropertyFullName> | undefined>;
  /** Saves Favorite properties to user-specific settings.
   * @param properties Favorite properties to save.
   * @param projectId Project Id, if the settings is specific to a project, otherwise undefined.
   * @param iModelId iModel Id, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  saveProperties(properties: Set<PropertyFullName>, projectId?: string, imodelId?: string): Promise<void>;
  /** Load array of FavoritePropertiesOrderInfo from user-specific settings.
   * Setting is specific to an iModel.
   * @param projectId Project Id.
   * @param imodelId iModel Id.
   */
  loadPropertiesOrder(projectId: string | undefined, imodelId: string): Promise<FavoritePropertiesOrderInfo[] | undefined>;
  /** Saves FavoritePropertiesOrderInfo array to user-specific settings.
   * Setting is specific to an iModel.
   * @param orderInfo Array of FavoritePropertiesOrderInfo to save.
   * @param projectId Project Id.
   * @param imodelId iModel Id.
   */
  savePropertiesOrder(orderInfos: FavoritePropertiesOrderInfo[], projectId: string | undefined, imodelId: string): Promise<void>;
}

/**
 * @internal
 */
export class IModelAppFavoritePropertiesStorage implements IFavoritePropertiesStorage {
  public async loadProperties(projectId?: string, imodelId?: string): Promise<Set<PropertyFullName> | undefined> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    let settingResult = await IModelApp.settings.getUserSetting(requestContext, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
    let setting = settingResult.setting;

    if (setting !== undefined)
      return new Set<PropertyFullName>(setting);

    // try to check the old namespace
    settingResult = await IModelApp.settings.getUserSetting(requestContext, DEPRECATED_PROPERTIES_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
    setting = settingResult.setting;

    if (setting !== undefined && setting.hasOwnProperty("nestedContentInfos") && setting.hasOwnProperty("propertyInfos") && setting.hasOwnProperty("baseFieldInfos"))
      return new Set<PropertyFullName>([...setting.nestedContentInfos, ...setting.propertyInfos, ...setting.baseFieldInfos]);

    return undefined;
  }

  public async saveProperties(properties: Set<PropertyFullName>, projectId?: string, imodelId?: string): Promise<void> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    await IModelApp.settings.saveUserSetting(requestContext, Array.from(properties), IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
  }

  public async loadPropertiesOrder(projectId: string | undefined, imodelId: string): Promise<FavoritePropertiesOrderInfo[] | undefined> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const settingResult = await IModelApp.settings.getUserSetting(requestContext, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME, true, projectId, imodelId);
    return settingResult.setting as FavoritePropertiesOrderInfo[];
  }

  public async savePropertiesOrder(orderInfos: FavoritePropertiesOrderInfo[], projectId: string | undefined, imodelId: string) {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    await IModelApp.settings.saveUserSetting(requestContext, orderInfos, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME, true, projectId, imodelId);
  }
}
