/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { compareStrings, Dictionary, Guid, IDisposable, OrderedComparator } from "@bentley/bentleyjs-core";
import { InternetConnectivityStatus } from "@bentley/imodeljs-common";
import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { PresentationError, PresentationStatus } from "@bentley/presentation-common";
import { IConnectivityInformationProvider } from "../ConnectivityInformationProvider";
import { FavoritePropertiesOrderInfo, PropertyFullName } from "./FavoritePropertiesManager";

const IMODELJS_PRESENTATION_SETTING_NAMESPACE = "imodeljs.presentation";
const DEPRECATED_PROPERTIES_SETTING_NAMESPACE = "Properties";
const FAVORITE_PROPERTIES_SETTING_NAME = "FavoriteProperties";
const FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME = "FavoritePropertiesOrderInfo";

/**
 * Stores user settings for favorite properties.
 * @public
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

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get isSignedIn() {
    // note: these checks are also done when creating `AuthorizedFrontendRequestContext` but instead of just
    // throwing it also logs error messages which we want to avoid
    return IModelApp.authorizationClient && IModelApp.authorizationClient.hasSignedIn;
  }

  public async loadProperties(projectId?: string, imodelId?: string): Promise<Set<PropertyFullName> | undefined> {
    if (!this.isSignedIn) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }

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
    if (!this.isSignedIn) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }
    const requestContext = await AuthorizedFrontendRequestContext.create();
    await IModelApp.settings.saveUserSetting(requestContext, Array.from(properties), IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
  }

  public async loadPropertiesOrder(projectId: string | undefined, imodelId: string): Promise<FavoritePropertiesOrderInfo[] | undefined> {
    if (!this.isSignedIn) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const settingResult = await IModelApp.settings.getUserSetting(requestContext, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME, true, projectId, imodelId);
    return settingResult.setting as FavoritePropertiesOrderInfo[];
  }

  public async savePropertiesOrder(orderInfos: FavoritePropertiesOrderInfo[], projectId: string | undefined, imodelId: string) {
    if (!this.isSignedIn) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }
    const requestContext = await AuthorizedFrontendRequestContext.create();
    await IModelApp.settings.saveUserSetting(requestContext, orderInfos, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME, true, projectId, imodelId);
  }
}

/** @internal */
export interface OfflineCachingFavoritePropertiesStorageProps {
  connectivityInfo: IConnectivityInformationProvider;
  impl: IFavoritePropertiesStorage;
}
/** @internal */
export class OfflineCachingFavoritePropertiesStorage implements IFavoritePropertiesStorage, IDisposable {

  private _connectivityInfo: IConnectivityInformationProvider;
  private _impl: IFavoritePropertiesStorage;
  private _unsubscribeFromConnectivityStatusChangedEvent: () => void;
  private _propertiesOfflineCache = new DictionaryWithReservations<ProjectAndIModelIdsKey, Set<PropertyFullName>>(projectAndIModelIdsKeyComparer);
  private _propertiesOrderOfflineCache = new DictionaryWithReservations<ProjectAndIModelIdsKey, FavoritePropertiesOrderInfo[]>(projectAndIModelIdsKeyComparer);

  public constructor(props: OfflineCachingFavoritePropertiesStorageProps) {
    this._impl = props.impl;
    this._connectivityInfo = props.connectivityInfo;
    this._unsubscribeFromConnectivityStatusChangedEvent = this._connectivityInfo.onInternetConnectivityChanged.addListener(this.onConnectivityStatusChanged);
  }

  public dispose() {
    this._unsubscribeFromConnectivityStatusChangedEvent();
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onConnectivityStatusChanged = (args: { status: InternetConnectivityStatus }) => {
    // istanbul ignore else
    if (args.status === InternetConnectivityStatus.Online) {
      // note: we're copying the cached values to temp arrays because `saveProperties` and `savePropertiesOrder` both
      // attempt to modify cache dictionaries

      const propertiesCache = new Array<{ properties: Set<PropertyFullName>, projectId?: string, imodelId?: string }>();
      this._propertiesOfflineCache.forEach((key, value) => propertiesCache.push({ properties: value, projectId: key[0], imodelId: key[1] }));
      propertiesCache.forEach(async (cached) => this.saveProperties(cached.properties, cached.projectId, cached.imodelId));

      const ordersCache = new Array<{ order: FavoritePropertiesOrderInfo[], projectId?: string, imodelId: string }>();
      this._propertiesOrderOfflineCache.forEach((key, value) => ordersCache.push({ order: value, projectId: key[0], imodelId: key[1]! }));
      ordersCache.forEach(async (cached) => this.savePropertiesOrder(cached.order, cached.projectId, cached.imodelId));
    }
  };

  public async loadProperties(projectId?: string, imodelId?: string) {
    if (this._connectivityInfo.status === InternetConnectivityStatus.Online) {
      try {
        return await this._impl.loadProperties(projectId, imodelId);
      } catch {
        // return from offline cache if the above fails
      }
    }
    return this._propertiesOfflineCache.get([projectId, imodelId]);
  }

  public async saveProperties(properties: Set<PropertyFullName>, projectId?: string, imodelId?: string) {
    const key: ProjectAndIModelIdsKey = [projectId, imodelId];
    if (this._connectivityInfo.status === InternetConnectivityStatus.Offline) {
      this._propertiesOfflineCache.set(key, properties);
      return;
    }
    const reservationId = this._propertiesOfflineCache.reserve(key);
    try {
      await this._impl.saveProperties(properties, projectId, imodelId);
      this._propertiesOfflineCache.reservedDelete(key, reservationId);
    } catch {
      this._propertiesOfflineCache.reservedSet(key, properties, reservationId);
    }
  }

  public async loadPropertiesOrder(projectId: string | undefined, imodelId: string) {
    if (this._connectivityInfo.status === InternetConnectivityStatus.Online) {
      try {
        return await this._impl.loadPropertiesOrder(projectId, imodelId);
      } catch {
        // return from offline cache if the above fails
      }
    }
    return this._propertiesOrderOfflineCache.get([projectId, imodelId]);
  }

  public async savePropertiesOrder(orderInfos: FavoritePropertiesOrderInfo[], projectId: string | undefined, imodelId: string) {
    const key: ProjectAndIModelIdsKey = [projectId, imodelId];
    if (this._connectivityInfo.status === InternetConnectivityStatus.Offline) {
      this._propertiesOrderOfflineCache.set(key, orderInfos);
      return;
    }
    const reservationId = this._propertiesOrderOfflineCache.reserve(key);
    try {
      await this._impl.savePropertiesOrder(orderInfos, projectId, imodelId);
      this._propertiesOrderOfflineCache.reservedDelete(key, reservationId);
    } catch {
      this._propertiesOrderOfflineCache.reservedSet(key, orderInfos, reservationId);
    }
  }

}

class DictionaryWithReservations<TKey, TValue> {
  private _impl: Dictionary<TKey, { value?: TValue, lastReservationId?: string }>;
  public constructor(compareKeys: OrderedComparator<TKey>) {
    this._impl = new Dictionary(compareKeys);
  }
  public get(key: TKey) { return this._impl.get(key)?.value; }
  public forEach(func: (key: TKey, value: TValue) => void): void {
    this._impl.forEach((key, entry) => {
      // istanbul ignore else
      if (entry.value)
        func(key, entry.value);
    });
  }
  public reserve(key: TKey) {
    const reservationId = Guid.createValue();
    this._impl.set(key, { lastReservationId: reservationId });
    return reservationId;
  }
  public set(key: TKey, value: TValue) { return this._impl.set(key, { value }); }
  public reservedSet(key: TKey, value: TValue, reservationId: string) {
    const entry = this._impl.get(key);
    if (entry && entry.lastReservationId === reservationId)
      this._impl.set(key, { value });
  }
  public reservedDelete(key: TKey, reservationId: string) {
    const entry = this._impl.get(key);
    if (entry && entry.lastReservationId === reservationId)
      this._impl.delete(key);
  }
}

type ProjectAndIModelIdsKey = [string | undefined, string | undefined];

// istanbul ignore next
function projectAndIModelIdsKeyComparer(lhs: ProjectAndIModelIdsKey, rhs: ProjectAndIModelIdsKey) {
  const projectIdCompare = compareStrings(lhs[0] ?? "", rhs[0] ?? "");
  return (projectIdCompare !== 0) ? projectIdCompare : compareStrings(lhs[1] ?? "", rhs[1] ?? "");
}
