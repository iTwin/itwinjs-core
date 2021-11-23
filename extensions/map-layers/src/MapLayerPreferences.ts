/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, MapLayerSource, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { BeEvent, GuidString } from "@itwin/core-bentley";
import { MapLayersUI } from "./mapLayers";

/** @internal */
export interface MapLayerPreferencesContent {
  url: string;
  name: string;
  formatId: string;
  transparentBackground: boolean | undefined;
}

/** @internal */
export enum MapLayerSourceChangeType {
  Added = 0,
  Removed = 1,
  Replaced = 2,
}

/** @internal */
export interface MapLayerSourceArg {
  readonly source: MapLayerSource;
  readonly iTwinId: GuidString;
  readonly iModelId: GuidString;
}

/** A wrapper around user preferences to provide a way to store [[MapLayerSettings]].
 *
 * Note: This is currently internal only and used directly by the MapLayersExtension. It makes use of the IModelApp.authorizationClient if it exists.
 *
 * @internal
 */
export class MapLayerPreferences {
  /** Event raised whenever a source is added, replaced or removed:
   *    changeType : Type of changed occurred.
   *    oldSource : Source that was removed or replaced.
   *    newSource : Source that was added or replacement of oldSource.
   *
   * @see [[MapLayerSourceChangeType]]
   */
  public static readonly onLayerSourceChanged = new BeEvent<(changeType: MapLayerSourceChangeType, oldSource?: MapLayerSource, newSource?: MapLayerSource) => void>(); // Used to notify the frontend that it needs to update its list of available layers

  /** Store the Map Layer source preference. If the same setting exists at a higher level, an error will be thrown and the setting will not be updated.
   *
   * Returns false if the settings object would override some other settings object in a larger scope i.e. storing settings on model when
   * a project setting exists with same name or map layer url.
   * @param source source to be stored on the setting service
   * @param storeOnIModel if true store the settings object on the model, if false store it on the project
   */
  public static async storeSource(source: MapLayerSource, storeOnIModel: boolean, iTwinId: GuidString, iModelId: GuidString): Promise<boolean> {
    if (!MapLayersUI.iTwinConfig)
      return false;
    const accessToken = undefined !== IModelApp.authorizationClient ? (await IModelApp.authorizationClient.getAccessToken()) : undefined;

    const sourceJSON = source.toJSON();
    const mapLayerSetting: MapLayerPreferencesContent = {
      url: sourceJSON.url,
      name: sourceJSON.name,
      formatId: sourceJSON.formatId,
      transparentBackground: sourceJSON.transparentBackground,
    };

    const result: boolean = await MapLayerPreferences.delete(sourceJSON.url, sourceJSON.name, iTwinId, iModelId, storeOnIModel);
    if (result) {
      await MapLayersUI.iTwinConfig.save({
        accessToken,
        content: mapLayerSetting,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: sourceJSON.name,
        iTwinId,
        iModelId: storeOnIModel ? iModelId : undefined,
      });
      MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Added, undefined, MapLayerSource.fromJSON(mapLayerSetting));
      return true;
    } else {
      return false;
    }
  }

  /** Replace the old map layer source with a new map layer source.
   *
   * The source is replaced at the same level that the original source is defined. (i.e. if the old source is defined at a project level, the new source will also be defined there.)
   *
   * @param oldSource
   * @param newSource
   * @param projectId
   * @param iModelId
   */
  public static async replaceSource(oldSource: MapLayerSource, newSource: MapLayerSource, projectId: GuidString, iModelId: GuidString): Promise<void> {
    if (!MapLayersUI.iTwinConfig)
      return;
    const accessToken = undefined !== IModelApp.authorizationClient ? (await IModelApp.authorizationClient.getAccessToken()) : undefined;

    let storeOnIModel = false;
    try {
      await MapLayersUI.iTwinConfig.delete({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: oldSource.name,
        iTwinId: projectId,
        iModelId,
      });
    } catch (_err) {
      await MapLayersUI.iTwinConfig.delete({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: oldSource.name,
        iTwinId: projectId,
      });
      storeOnIModel = true;
    }

    const mapLayerSetting: MapLayerPreferencesContent = {
      url: newSource.url,
      name: newSource.name,
      formatId: newSource.formatId,
      transparentBackground: newSource.transparentBackground,
    };

    await MapLayersUI.iTwinConfig.save({
      accessToken,
      key: `${MapLayerPreferences._preferenceNamespace}.${newSource.name}`,
      iTwinId: projectId,
      iModelId: storeOnIModel ? iModelId : undefined,
      content: mapLayerSetting,
    });

    MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Replaced, oldSource, newSource);
  }

  /** Deletes the provided MapLayerSource by name from both the iTwin or iModel level.
   *
   * @param source The source to delete. The name is used to identify the source.
   * @param iTwinId
   * @param iModelId
   */
  public static async deleteByName(source: MapLayerSource, iTwinId: GuidString, iModelId: GuidString): Promise<void> {
    if (!MapLayersUI.iTwinConfig)
      return;
    const accessToken = undefined !== IModelApp.authorizationClient ? (await IModelApp.authorizationClient.getAccessToken()) : undefined;

    try {
      await MapLayersUI.iTwinConfig.delete({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: source.name,
        iTwinId,
        iModelId,
      });
    } catch (_err) {
      // failed to store based on iModelId, attempt using iTwinId
      await MapLayersUI.iTwinConfig.delete({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: source.name,
        iTwinId,
      });
    }

    MapLayerPreferences.onLayerSourceChanged.raiseEvent(MapLayerSourceChangeType.Removed, source, undefined);
  }

  /** Deletes the current setting with the provided key if it is defined at the same preference level.
   *
   * If the preference is defined within a different level, false will be returned indicating the setting should not be overriden.
   *
   * The two potential preference levels are iTwin and iModel.
   *
   * @param url
   * @param name
   * @param iTwinId
   * @param iModelId
   * @param storeOnIModel
   */
  private static async delete(url: string, name: string, iTwinId: GuidString, iModelId: GuidString, storeOnIModel: boolean): Promise<boolean> {
    if (!MapLayersUI.iTwinConfig)
      return true;
    const accessToken = undefined !== IModelApp.authorizationClient ? (await IModelApp.authorizationClient.getAccessToken()) : undefined;

    const iTwinPreferenceByName = await MapLayersUI.iTwinConfig.get({
      accessToken,
      namespace: MapLayerPreferences._preferenceNamespace,
      key: name,
      iTwinId,
    });

    if (undefined !== iTwinPreferenceByName && storeOnIModel) {
      const errorMessage = IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.LayerExistsAsProjectSetting", { layer: iTwinPreferenceByName.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
      return false;
    } else if (iTwinPreferenceByName) {
      const infoMessage = IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.LayerExistsOverwriting", { layer: iTwinPreferenceByName.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
      await MapLayersUI.iTwinConfig.delete({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: iTwinPreferenceByName.name,
        iTwinId,
      });
    }

    // check if setting with url already exists, if it does, delete it
    const settingFromUrl = await MapLayerPreferences.getByUrl(url, iTwinId, undefined);
    if (settingFromUrl && storeOnIModel) {
      const errorMessage = IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.LayerWithUrlExistsAsProjectSetting", { url: settingFromUrl.url, name: settingFromUrl.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, errorMessage));
      return false;
    } else if (settingFromUrl) {
      const infoMessage = IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.LayerWithUrlExistsOverwriting", { url: settingFromUrl.url, oldName: settingFromUrl.name, newName: name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
      await MapLayersUI.iTwinConfig.delete({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: settingFromUrl.name,
        iTwinId,
      });
    }

    if (iModelId) { // delete any settings on model so user can update them if theres collisions
      const settingOnIModelFromName = await MapLayersUI.iTwinConfig.get({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: name,
        iTwinId,
        iModelId,
      });
      const settingFromUrlOnIModel = await MapLayerPreferences.getByUrl(url, iTwinId, iModelId);
      if (settingOnIModelFromName) {
        const infoMessage = IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.LayerExistsOverwriting", { layer: settingOnIModelFromName.name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
        await MapLayersUI.iTwinConfig.delete({
          accessToken,
          namespace: MapLayerPreferences._preferenceNamespace,
          key: settingOnIModelFromName.name,
          iTwinId,
          iModelId,
        });
      }
      if (settingFromUrlOnIModel) {
        const infoMessage = IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.LayerWithUrlExistsOverwriting", { url: settingFromUrlOnIModel.url, oldName: settingFromUrlOnIModel.name, newName: name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, infoMessage));
        await MapLayersUI.iTwinConfig.delete({
          accessToken,
          namespace: MapLayerPreferences._preferenceNamespace,
          key: settingFromUrlOnIModel.name,
          iTwinId,
          iModelId,
        });
      }
    }
    return true;
  }

  /** Attempts to get a map layer based off a specific url.
   * @param url
   * @param projectId
   * @param iModelId
   */
  public static async getByUrl(url: string, projectId: string, iModelId?: string): Promise<MapLayerPreferencesContent | undefined> {
    if (!MapLayersUI.iTwinConfig)
      return undefined;

    const accessToken = undefined !== IModelApp.authorizationClient ? (await IModelApp.authorizationClient.getAccessToken()) : undefined;

    const settingResponse = await MapLayersUI.iTwinConfig.get({
      accessToken,
      namespace: MapLayerPreferences._preferenceNamespace,
      key: "",
      iTwinId: projectId,
      iModelId,
    });

    if (undefined === settingResponse || 0 === settingResponse.length)
      return undefined;

    let savedMapLayer;
    settingResponse.settingsMap?.forEach((savedLayer: any) => {
      if (savedLayer.url === url) {
        savedMapLayer = savedLayer;
      }
    });
    return savedMapLayer;
  }

  /** Get all MapLayerSources from the user's preferences, iTwin setting and iModel settings.
   * @param projectId id of the project
   * @param iModelId id of the iModel
   * @throws if any of the calls to grab settings fail.
   */
  public static async getSources(projectId: GuidString, iModelId: GuidString): Promise<MapLayerSource[]> {
    if (!MapLayersUI.iTwinConfig)
      return [];
    const accessToken = undefined !== IModelApp.authorizationClient ? (await IModelApp.authorizationClient.getAccessToken()) : undefined;

    const mapLayerList = [];

    try {
      const userResultByProject = await MapLayersUI.iTwinConfig.get({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: "",
        iTwinId: projectId,
      });
      if (undefined !== userResultByProject)
        mapLayerList.push(userResultByProject);
    } catch (err: any) {
      throw new Error(IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.ErrorRetrieveUserProject", { errorMessage: err }));
    }

    try {
      const userResultByIModel = await MapLayersUI.iTwinConfig.get({
        accessToken,
        namespace: MapLayerPreferences._preferenceNamespace,
        key: "",
        iTwinId: projectId,
        iModelId,
      });
      if (undefined !== userResultByIModel)
        mapLayerList.push(userResultByIModel);
    } catch (err: any) {
      throw new Error(IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.ErrorRetrieveUserProject", { errorMessage: err }));
    }

    const savedMapLayerSources: MapLayerSource[] = [];
    for (const mapLayer of mapLayerList) {
      mapLayer.forEach((savedLayer: any) => {
        const mapLayerSource = MapLayerSource.fromJSON(savedLayer as MapLayerPreferencesContent);
        if (mapLayerSource)
          savedMapLayerSources.push(mapLayerSource);
      });
    }
    return savedMapLayerSources;
  }

  private static get _preferenceNamespace() {
    return "MapLayerSource-SettingsService";
  }
}
