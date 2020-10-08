/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { LogLevel } from "@bentley/bentleyjs-core";
import { BriefcaseKey, BriefcaseProps, DownloadBriefcaseOptions, OpenBriefcaseOptions, RequestBriefcaseProps } from "../BriefcaseTypes";
import { IModelProps, IModelRpcProps } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";

/**
 * Type of value for storage values
 * @internal
 */
export type StorageValue = string | number | boolean | null | Uint8Array;

/** Represents a queued event retrieved from NativeAppRpcInterface.fetchEvent.
 * @internal
 */
export interface QueuedEvent {
  eventId: number; // stable auto-incremented id used to determine order of events
  namespace: string; // namespace for the event
  eventName: string; // name of the event
  data: any; // this will be serialized to json
}
/** List of event by namespace
 * @internal
 */
export namespace Events {
  export namespace NativeApp {
    export const namespace = "NativeApp";
    export const onMemoryWarning = "onMemoryWarning";
    export const onBriefcaseDownloadProgress = "download-progress";
    export const onInternetConnectivityChanged = "onInternetConnectivityChanged";
    export const onUserStateChanged = "onUserStateChanged";
    /** [[QueuedEvent.data]] is an array of [[ModelGeometryChangesProps]]. */
    export const modelGeometryChanges = "modelGeometryChanges";
  }
}

/** Identifies a list of tile content Ids belonging to a single tile tree.
 * @internal
 */
export interface TileTreeContentIds {
  treeId: string;
  contentIds: string[];
}

/** InternetConnectivityStatus describe type of connectivity available to application
 * @internal
 */
export enum InternetConnectivityStatus {
  Online,
  Offline,
}
/** OverridenBy describe who overriding connectivity
 * @internal
 */
export enum OverriddenBy {
  Browser,
  User,
}

/** NativeAppRpcInterface supplies Rpc functionality specific to native apps.
 * A "native app" is an iModel.js application in which a one-to-one relationship exists between the frontend and backend process. Both processes execute on the same device, which can
 * enable offline workflows. Such an app can target a specific platform - e.g., Electron, iOS, Android.
 * By contrast, browser-based iModel.js applications are platform-agnostic, support multiple simultaneous frontend connections, and require a network connection.
 * @internal
 */
export abstract class NativeAppRpcInterface extends RpcInterface {
  /** Returns the client instance for the frontend. */
  public static getClient(): NativeAppRpcInterface { return RpcManager.getClientForInterface(NativeAppRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "NativeAppRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "0.3.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  /** Send frontend log to backend.
   * @param _level Specify log level.
   * @param _category Specify log category.
   * @param _message Specify log message.
   * @param _metaData metaData if any.
   */
  public async log(_timestamp: number, _level: LogLevel, _category: string, _message: string, _metaData?: any): Promise<void> { return this.forward(arguments); }

  /** Fetch a list of queue events for the specified iModel from the backend, up to the specified maximum number of events.
   * The order of the events in the returned array matches the order in which the events occurred.
   * @param _iModelToken Identifies the iModel
   * @param _maxToFetch The maximum number of events to return. If this is less than or equal to zero, all queued events will be returned.
   * @returns Up to _maxToFetch queued events.
   */
  public async fetchEvents(_iModelToken: IModelRpcProps, _maxToFetch: number): Promise<QueuedEvent[]> { return this.forward(arguments); }

  /** Check if internet is reachable and how its reachable. */
  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> { return this.forward(arguments); }

  /** Manually override internet reachability for testing purpose.
   * @param _status New status to set on backend.
   */
  public async overrideInternetConnectivity(_overriddenBy: OverriddenBy, _status?: InternetConnectivityStatus): Promise<void> { return this.forward(arguments); }

  /** Return config from backend */
  public async getConfig(): Promise<any> { return this.forward(arguments); }

  /** Cancels currently pending or active generation of tile content.
   * @param _iModelToken Identifies the iModel
   * @param _contentIds A list of content requests to be canceled, grouped by tile tree Id.
   */
  public async cancelTileContentRequests(_iModelToken: IModelRpcProps, _contentIds: TileTreeContentIds[]): Promise<void> { return this.forward(arguments); }

  /**
   * Request download of a briefcase. The call require internet connection and must have valid token.
   * @param _requestProps Properties required to locate the iModel and download it as a briefcase
   * @param _downloadOptions Options to affect the download of the briefcase
   * @param _reportProgress Report progress to frontend
   * @returns BriefcaseProps The properties of the briefcase to be downloaded
   */
  public async requestDownloadBriefcase(_requestProps: RequestBriefcaseProps, _downloadOptions: DownloadBriefcaseOptions, _reportProgress: boolean): Promise<BriefcaseProps> { return this.forward(arguments); }

  /**
   * Finishes download of a briefcase. The call require internet connection and must have valid token.
   * @param _key Key to locate the briefcase in the disk cache
   */
  public async downloadRequestCompleted(_key: BriefcaseKey): Promise<void> { return this.forward(arguments); }

  /**
   * Cancels the previously requested download of a briefcase
   * @param _key Key to locate the briefcase in the disk cache
   * @returns true if the cancel request was acknowledged. false otherwise
   */
  public async requestCancelDownloadBriefcase(_key: BriefcaseKey): Promise<boolean> { return this.forward(arguments); }

  /**
   * Opens the briefcase on disk - this api can be called offline
   * @param _key Key to locate the briefcase in the disk cache
   * @param _openOptions Options to open the briefcase
   * @returns IModelRpcProps which allow to create IModelConnection.
   */
  public async openBriefcase(_key: BriefcaseKey, _openOptions?: OpenBriefcaseOptions): Promise<IModelProps> { return this.forward(arguments); }

  /**
   * Closes the briefcase on disk - this api can be called offline
   * @param _key Key to locate the briefcase in the disk cache
   */
  public async closeBriefcase(_key: BriefcaseKey): Promise<void> { return this.forward(arguments); }

  /**
   * Deletes a previously downloaded briefcase. The briefcase must be closed.
   * @param _key Key to locate the briefcase in the disk cache
   */
  public async deleteBriefcase(_key: BriefcaseKey): Promise<void> { return this.forward(arguments); }

  /**
   * Gets all briefcases that were previously requested to be downloaded, or were completely downloaded
   * @returns list of briefcases.
   */
  public async getBriefcases(): Promise<BriefcaseProps[]> { return this.forward(arguments); }

  /**
   * Open key/value pair base storage
   * @param _storageId string identifier of storage
   */
  public async storageMgrOpen(_storageId: string): Promise<string> { return this.forward(arguments); }

  /**
   * Close key/value pair base storage
   * @param _storageId string identifier of storage
   * @param _deleteIt delete the storage on close
   */
  public async storageMgrClose(_storageId: string, _deleteIt: boolean): Promise<void> { return this.forward(arguments); }

  /**
   * Get names of available storages
   * @returns list of name of storage
   */
  public async storageMgrNames(): Promise<string[]> { return this.forward(arguments); }

  /**
   * Get a value against a key.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   * @returns key value or undefined
   */
  public async storageGet(_storageId: string, _key: string): Promise<StorageValue | undefined> { return this.forward(arguments); }

  /**
   * Set a value against a key.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   * @param _value value to be set
   */
  public async storageSet(_storageId: string, _key: string, _value: StorageValue): Promise<void> { return this.forward(arguments); }

  /**
   * Remove a key/value pair.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   */
  public async storageRemove(_storageId: string, _key: string): Promise<void> { return this.forward(arguments); }

  /**
   * Get list of keys in storage.
   * @param _storageId string identifier of storage
   * @returns list of storage ids
   */
  public async storageKeys(_storageId: string): Promise<string[]> { return this.forward(arguments); }

  /**
   * Delete all key/value pairs.
   * @param _storageId string identifier of storage
   */
  public async storageRemoveAll(_storageId: string): Promise<void> { return this.forward(arguments); }

  /**
   * Trigger sigIn on backend. This will cause onUserStateChange() event.
   */
  public async authSignIn(): Promise<void> { return this.forward(arguments); }

  /**
   * SignOut user on backend. This will cause onUserStateChange() event.
   */
  public async authSignOut(): Promise<void> { return this.forward(arguments); }

  /**
   * Get access token and perform silent refresh as needed
   * @returns OIDC token
   */
  public async authGetAccessToken(): Promise<string> { return this.forward(arguments); }

  /**
   * Initialize OIDC client
   * @param _issuer URL for issuer.
   * @param _config configuration for oidc client
   */
  public async authInitialize(_issuer: string, _config: any): Promise<void> { return this.forward(arguments); }
}
