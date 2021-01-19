/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { GuidString, LogLevel } from "@bentley/bentleyjs-core";
import { BriefcaseProps, LocalBriefcaseProps, OpenBriefcaseProps, RequestNewBriefcaseProps } from "../BriefcaseTypes";
import { IModelConnectionProps, IModelRpcProps } from "../IModel";

/** @internal */
export const nativeAppChannel = "nativeApp";

/**
 * Type of value for storage values
 * @beta
 */
export type StorageValue = string | number | boolean | null | Uint8Array;

/** Represents a push event emitted from an [EventSink]($backend) to an [EventSource]($frontend).
 * @note Events are received by an EventSink in the order in which they were emitted by the EventSource.
 * @internal
 */
export interface QueuedEvent {
  /** Auto-incremented id. */
  eventId: number;
  /** A namespace used for preventing collisions between event names. */
  namespace: string;
  /** A name uniquely identifying the type of event within its namespace. */
  eventName: string;
  /** Event payload. The specific type depends on the event name. */
  data: any;
}
/** Event names and namespace exposed by iModel.js.
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

/** Indicates whether or not the computer is currently connected to the internet.
 * @beta
 */
export enum InternetConnectivityStatus {
  Online,
  Offline,
}

/** Describes whether the user or the browser overrode the internet connectivity status.
 * @beta
 */
export enum OverriddenBy {
  Browser,
  User,
}

/**
 * The methods that may be invoked via Ipc from the frontend of a Native App and are implemented on its backend.
 * @internal
 */
export interface NativeAppIpc {
  /** Send frontend log to backend.
   * @param _level Specify log level.
   * @param _category Specify log category.
   * @param _message Specify log message.
   * @param _metaData metaData if any.
   */
  log: (_timestamp: number, _level: LogLevel, _category: string, _message: string, _metaData?: any) => Promise<void>;

  /** Check if the internet is reachable. */
  checkInternetConnectivity: () => Promise<InternetConnectivityStatus>;

  /** Manually override internet reachability for testing purposes.
   * @param _status New status to set on backend.
   */
  overrideInternetConnectivity: (_overriddenBy: OverriddenBy, _status: InternetConnectivityStatus) => Promise<void>;

  /** Return configuration information from backend. */
  getConfig: () => Promise<any>;

  /** Cancels currently pending or active generation of tile content.
   * @param _iModelToken Identifies the iModel
   * @param _contentIds A list of content requests to be canceled, grouped by tile tree Id.
   * @internal
   */
  cancelTileContentRequests: (_iModelToken: IModelRpcProps, _contentIds: TileTreeContentIds[]) => Promise<void>;

  /** Cancel element graphics requests.
   * @see [[IModelTileRpcInterface.requestElementGraphics]].
   */
  cancelElementGraphicsRequests: (_rpcProps: IModelRpcProps, _requestIds: string[]) => Promise<void>;

  /** Acquire a new BriefcaseId for the supplied iModelId from iModelHub */
  acquireNewBriefcaseId: (_iModelId: GuidString) => Promise<number>;

  /** Get the filename in the briefcase cache for the supplied BriefcaseId and iModelId.
   * @note this merely returns the full path fileName. It does not test for the existence of the file.
    */
  getBriefcaseFileName: (_props: BriefcaseProps) => Promise<string>;

  /** Download a briefcase file for the supplied briefcase properties. */
  downloadBriefcase: (_requestProps: RequestNewBriefcaseProps, _reportProgress: boolean) => Promise<LocalBriefcaseProps>;

  /**
   * Cancels the previously requested download of a briefcase
   * @param _key Key to locate the briefcase in the disk cache
   * @note returns true if the cancel request was acknowledged. false otherwise
   */
  requestCancelDownloadBriefcase: (_fileName: string) => Promise<boolean>;

  /**
   * Open a briefcase file from the local disk.
   */
  open: (_args: OpenBriefcaseProps) => Promise<IModelConnectionProps>;

  /**
   * Close a briefcase on the backend.
   * @param _key The key from the IModelConnectionProps returned by [[open]]
   */
  closeBriefcase: (_key: string) => Promise<void>;

  /**
   * Delete a previously downloaded briefcase. The briefcase must be closed.
   * @param _fileName the Briefcase to delete
   */
  deleteBriefcaseFiles: (_fileName: string) => Promise<void>;

  /**
   * Gets a list of all briefcases that were previously downloaded to the system briefcase cache.
   * @note returns array of LocalBriefcaseProps.
   */
  getCachedBriefcases: (_iModelId?: GuidString) => Promise<LocalBriefcaseProps[]>;

  /**
   * Open a key/value pair base storage
   * @param _storageId string identifier of storage
   */
  storageMgrOpen: (_storageId: string) => Promise<string>;

  /**
   * Close a key/value pair base storage
   * @param _storageId string identifier of storage
   * @param _deleteOnClose delete the storage on close
   */
  storageMgrClose: (_storageId: string, _deleteOnClose: boolean) => Promise<void>;

  /**
   * Get the names of available storages
   * @note returns list of storage names
   */
  storageMgrNames: () => Promise<string[]>;

  /**
   * Get the value associated with a key.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   * @note returns key value or undefined
   */
  storageGet: (_storageId: string, _key: string) => Promise<StorageValue | undefined>;

  /**
   * Set a value for a key.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   * @param _value value to be set
   */
  storageSet: (_storageId: string, _key: string, _value: StorageValue) => Promise<void>;

  /**
   * Remove a key/value pair.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   */
  storageRemove: (_storageId: string, _key: string) => Promise<void>;

  /**
   * Get list of keys in a storage.
   * @param _storageId string identifier of storage
   * @note returns list of storage ids
   */
  storageKeys: (_storageId: string) => Promise<string[]>;

  /**
   * Delete all key/value pairs.
   * @param _storageId string identifier of storage
   */
  storageRemoveAll: (_storageId: string) => Promise<void>;

  /**
   * Initiate a sign in on backend. This will emit an onUserStateChange() event.
   */
  authSignIn: () => Promise<void>;

  /**
   * Sign out the user on the backend. This will emit an onUserStateChange() event.
   */
  authSignOut: () => Promise<void>;

  /**
   * Get access token and perform silent refresh as needed
   * @note returns OIDC token
   */
  authGetAccessToken: () => Promise<string>;

  /**
   * Initialize OIDC client
   * @param _issuer URL for issuer.
   * @param _config configuration for oidc client
   */
  authInitialize: (_issuer: string, _config: any) => Promise<void>;

  /** @internal */
  toggleInteractiveEditingSession: (_tokenProps: IModelRpcProps, _startSession: boolean) => Promise<boolean>;
  /** @internal */
  isInteractiveEditingSupported: (_tokenProps: IModelRpcProps) => Promise<boolean>;
}
