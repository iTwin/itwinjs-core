/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { compareStrings, Dictionary, Guid, IDisposable, isIDisposable, OrderedComparator } from "@bentley/bentleyjs-core";
import { InternetConnectivityStatus } from "@bentley/imodeljs-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { PresentationError, PresentationStatus } from "@bentley/presentation-common";
import { ConnectivityInformationProvider, IConnectivityInformationProvider } from "../ConnectivityInformationProvider";
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
 * Available implementations of [[IFavoritePropertiesStorage]].
 * @public
 */
export enum DefaultFavoritePropertiesStorageTypes {
  /** A no-op storage that doesn't store or return anything. Used for cases when favorite properties aren't used by the application. */
  Noop,
  /** A storage that stores favorite properties information in a browser local storage. */
  BrowserLocalStorage,
  /** A storage that stores favorite properties in a user settings service (see [[IModelApp.settings]]). */
  UserSettingsServiceStorage,
}

/**
 * A factory method to create one of the available [[IFavoritePropertiesStorage]] implementations.
 * @public
 */
export function createFavoritePropertiesStorage(type: DefaultFavoritePropertiesStorageTypes): IFavoritePropertiesStorage {
  switch (type) {
    case DefaultFavoritePropertiesStorageTypes.Noop: return new NoopFavoritePropertiesStorage();
    case DefaultFavoritePropertiesStorageTypes.BrowserLocalStorage: return new BrowserLocalFavoritePropertiesStorage();
    case DefaultFavoritePropertiesStorageTypes.UserSettingsServiceStorage: return new OfflineCachingFavoritePropertiesStorage({ impl: new IModelAppFavoritePropertiesStorage() });
  }
}

/**
 * @internal
 */
export class IModelAppFavoritePropertiesStorage implements IFavoritePropertiesStorage {

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private async isSignedIn(): Promise<boolean> {
    // If the authorization client is provided, it should give a valid response to getAccessToken
    return !!IModelApp.authorizationClient && !!(await IModelApp.authorizationClient.getAccessToken());
  }
  private async getAccessToken() {
    return (await IModelApp.authorizationClient?.getAccessToken())!;
  }

  public async loadProperties(projectId?: string, imodelId?: string): Promise<Set<PropertyFullName> | undefined> {
    if (!(await this.isSignedIn())) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }

    const accessToken = await this.getAccessToken();
    let settingResult = await IModelApp.settings.getUserSetting(accessToken, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
    let setting = settingResult.setting;

    if (setting !== undefined)
      return new Set<PropertyFullName>(setting);

    // try to check the old namespace
    settingResult = await IModelApp.settings.getUserSetting(accessToken, DEPRECATED_PROPERTIES_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
    setting = settingResult.setting;

    if (setting !== undefined && setting.hasOwnProperty("nestedContentInfos") && setting.hasOwnProperty("propertyInfos") && setting.hasOwnProperty("baseFieldInfos"))
      return new Set<PropertyFullName>([...setting.nestedContentInfos, ...setting.propertyInfos, ...setting.baseFieldInfos]);

    return undefined;
  }

  public async saveProperties(properties: Set<PropertyFullName>, projectId?: string, imodelId?: string): Promise<void> {
    if (!(await this.isSignedIn())) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }
    const accessToken = await this.getAccessToken();
    await IModelApp.settings.saveUserSetting(accessToken, Array.from(properties), IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_SETTING_NAME, true, projectId, imodelId);
  }

  public async loadPropertiesOrder(projectId: string | undefined, imodelId: string): Promise<FavoritePropertiesOrderInfo[] | undefined> {
    if (!(await this.isSignedIn())) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }
    const accessToken = await this.getAccessToken();
    const settingResult = await IModelApp.settings.getUserSetting(accessToken, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME, true, projectId, imodelId);
    return settingResult.setting as FavoritePropertiesOrderInfo[];
  }

  public async savePropertiesOrder(orderInfos: FavoritePropertiesOrderInfo[], projectId: string | undefined, imodelId: string) {
    if (!(await this.isSignedIn())) {
      throw new PresentationError(PresentationStatus.Error, "Current user is not authorized to use the settings service");
    }
    const accessToken = await this.getAccessToken();
    await IModelApp.settings.saveUserSetting(accessToken, orderInfos, IMODELJS_PRESENTATION_SETTING_NAMESPACE, FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME, true, projectId, imodelId);
  }
}

/** @internal */
export interface OfflineCachingFavoritePropertiesStorageProps {
  impl: IFavoritePropertiesStorage;
  connectivityInfo?: IConnectivityInformationProvider;
}
/** @internal */
export class OfflineCachingFavoritePropertiesStorage implements IFavoritePropertiesStorage, IDisposable {

  private _connectivityInfo: IConnectivityInformationProvider;
  private _impl: IFavoritePropertiesStorage;
  private _propertiesOfflineCache = new DictionaryWithReservations<ProjectAndIModelIdsKey, Set<PropertyFullName>>(projectAndIModelIdsKeyComparer);
  private _propertiesOrderOfflineCache = new DictionaryWithReservations<ProjectAndIModelIdsKey, FavoritePropertiesOrderInfo[]>(projectAndIModelIdsKeyComparer);

  public constructor(props: OfflineCachingFavoritePropertiesStorageProps) {
    this._impl = props.impl;
    // istanbul ignore next
    this._connectivityInfo = props.connectivityInfo ?? new ConnectivityInformationProvider();
    this._connectivityInfo.onInternetConnectivityChanged.addListener(this.onConnectivityStatusChanged);
  }

  public dispose() {
    if (isIDisposable(this._connectivityInfo))
      this._connectivityInfo.dispose();
  }

  public get impl() { return this._impl; }

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

/** @internal */
export class NoopFavoritePropertiesStorage implements IFavoritePropertiesStorage {
  // istanbul ignore next
  public async loadProperties(_projectId?: string, _imodelId?: string): Promise<Set<PropertyFullName> | undefined> { return undefined; }
  // istanbul ignore next
  public async saveProperties(_properties: Set<PropertyFullName>, _projectId?: string, _imodelId?: string) { }
  // istanbul ignore next
  public async loadPropertiesOrder(_projectId: string | undefined, _imodelId: string): Promise<FavoritePropertiesOrderInfo[] | undefined> { return undefined; }
  // istanbul ignore next
  public async savePropertiesOrder(_orderInfos: FavoritePropertiesOrderInfo[], _projectId: string | undefined, _imodelId: string): Promise<void> { }
}

/** @internal */
export class BrowserLocalFavoritePropertiesStorage implements IFavoritePropertiesStorage {
  private _localStorage: Storage;

  public constructor(props?: { localStorage?: Storage }) {
    // istanbul ignore next
    this._localStorage = props?.localStorage ?? window.localStorage;
  }

  public createFavoritesSettingItemKey(projectId?: string, imodelId?: string): string {
    return `${IMODELJS_PRESENTATION_SETTING_NAMESPACE}${FAVORITE_PROPERTIES_SETTING_NAME}?projectId=${projectId}&imodelId=${imodelId}`;
  }
  public createOrderSettingItemKey(projectId?: string, imodelId?: string): string {
    return `${IMODELJS_PRESENTATION_SETTING_NAMESPACE}${FAVORITE_PROPERTIES_ORDER_INFO_SETTING_NAME}?projectId=${projectId}&imodelId=${imodelId}`;
  }

  public async loadProperties(projectId?: string, imodelId?: string): Promise<Set<PropertyFullName> | undefined> {
    const value = this._localStorage.getItem(this.createFavoritesSettingItemKey(projectId, imodelId));
    if (!value)
      return undefined;

    const properties: PropertyFullName[] = JSON.parse(value);
    return new Set(properties);
  }

  public async saveProperties(properties: Set<PropertyFullName>, projectId?: string, imodelId?: string) {
    this._localStorage.setItem(this.createFavoritesSettingItemKey(projectId, imodelId), JSON.stringify([...properties]));
  }

  public async loadPropertiesOrder(projectId: string | undefined, imodelId: string): Promise<FavoritePropertiesOrderInfo[] | undefined> {
    const value = this._localStorage.getItem(this.createOrderSettingItemKey(projectId, imodelId));
    if (!value)
      return undefined;

    const orderInfos: FavoritePropertiesOrderInfo[] = JSON.parse(value).map((json: any) => ({
      ...json,
      orderedTimestamp: new Date(json.orderedTimestamp),
    }));
    return orderInfos;
  }

  public async savePropertiesOrder(orderInfos: FavoritePropertiesOrderInfo[], projectId: string | undefined, imodelId: string): Promise<void> {
    this._localStorage.setItem(this.createOrderSettingItemKey(projectId, imodelId), JSON.stringify(orderInfos));
  }
}
