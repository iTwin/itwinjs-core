/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { FavoriteProperties } from "./FavoritePropertiesManager";

const propertiesSettingNamespace = "Properties";
const favoritePropertiesSettingName = "FavoriteProperties";

interface FavoritePropertiesContainer {
  nestedContentInfos: string[];
  propertyInfos: string[];
  baseFieldInfos: string[];
}

/**
 * Stores user settings for favorite properties.
 * @internal
 */
export interface IFavoritePropertiesStorage {
  /** Load FavoriteProperties from user-specific settings.
   * @param projectId Project Id, if the settings is specific to a project, otherwise undefined.
   * @param imodelId iModel Id, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  loadProperties(projectId?: string, imodelId?: string): Promise<FavoriteProperties | undefined>;
  /** Saves FavoriteProperties to user-specific settings.
   * @param properties FavoriteProperties to save.
   * @param projectId Project Id, if the settings is specific to a project, otherwise undefined.
   * @param iModelId iModel Id, if the setting is specific to an iModel, otherwise undefined. The projectId must be specified if iModelId is specified.
   */
  saveProperties(properties: FavoriteProperties, projectId?: string, imodelId?: string): Promise<void>;
}

/**
 * @internal
 */
export class IModelAppFavoritePropertiesStorage implements IFavoritePropertiesStorage {
  public async loadProperties(projectId?: string, imodelId?: string): Promise<FavoriteProperties | undefined> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const settingResult = await IModelApp.settings.getUserSetting(requestContext, propertiesSettingNamespace, favoritePropertiesSettingName, true, projectId, imodelId);
    const container: FavoritePropertiesContainer = settingResult.setting;
    if (!container)
      return undefined;
    return {
      nestedContentInfos: new Set<string>(container.nestedContentInfos),
      propertyInfos: new Set<string>(container.propertyInfos),
      baseFieldInfos: new Set<string>(container.baseFieldInfos),
    } as FavoriteProperties;
  }

  public async saveProperties(properties: FavoriteProperties, projectId?: string, imodelId?: string): Promise<void> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    // Convert all sets to arrays so that it could serialize to json
    const container: FavoritePropertiesContainer = {
      nestedContentInfos: [...properties.nestedContentInfos],
      propertyInfos: [...properties.propertyInfos],
      baseFieldInfos: [...properties.baseFieldInfos],
    };
    await IModelApp.settings.saveUserSetting(requestContext, container, propertiesSettingNamespace, favoritePropertiesSettingName, true, projectId, imodelId);
  }
}
