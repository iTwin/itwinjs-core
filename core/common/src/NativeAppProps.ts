/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import type { AccessToken, GuidString } from "@itwin/core-bentley";
import type { BriefcaseProps, LocalBriefcaseProps, RequestNewBriefcaseProps } from "./BriefcaseTypes";

/** @internal */
export const nativeAppChannel = "nativeApp";
/** @internal */
export const nativeAppNotify = "nativeApp-notify";

/**
 * Type of value for storage values
 * @beta
 */
export type StorageValue = string | number | boolean | undefined | Uint8Array;

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
 * Interface implemented by the frontend [NotificationHandler]($common) to be notified of events from NativeApp backend.
 * @internal
 */
export interface NativeAppNotifications {
  notifyInternetConnectivityChanged(status: InternetConnectivityStatus): void;
}

/**
 * The methods that may be invoked via Ipc from the frontend of a Native App and are implemented on its backend.
 * @internal
 */
export interface NativeAppFunctions {

  /** If the user is signed in a valid access token will be returned. */
  getAccessToken: () => Promise<AccessToken | undefined>;

  /** Check if the internet is reachable. */
  checkInternetConnectivity(): Promise<InternetConnectivityStatus>;

  /** Manually override internet reachability for testing purposes.
   * @param _status New status to set on backend.
   */
  overrideInternetConnectivity(_overriddenBy: OverriddenBy, _status: InternetConnectivityStatus): Promise<void>;

  /** Acquire a new BriefcaseId for the supplied iModelId from iModelHub */
  acquireNewBriefcaseId(_iModelId: GuidString): Promise<number>;

  /** Get the filename in the briefcase cache for the supplied BriefcaseId and iModelId.
   * @note this merely returns the full path fileName. It does not test for the existence of the file.
    */
  getBriefcaseFileName(_props: BriefcaseProps): Promise<string>;

  /** Download a briefcase file for the supplied briefcase properties. */
  downloadBriefcase(_requestProps: RequestNewBriefcaseProps, _reportProgress: boolean, _interval?: number): Promise<LocalBriefcaseProps>;

  /**
   * Cancels the previously requested download of a briefcase
   * @param _key Key to locate the briefcase in the disk cache
   * @note returns true if the cancel request was acknowledged. false otherwise
   */
  requestCancelDownloadBriefcase(_fileName: string): Promise<boolean>;

  /**
   * Delete a previously downloaded briefcase. The briefcase must be closed.
   * @param _fileName the Briefcase to delete
   */
  deleteBriefcaseFiles(_fileName: string): Promise<void>;

  /**
   * Gets a list of all briefcases that were previously downloaded to the system briefcase cache.
   * @note returns array of LocalBriefcaseProps.
   */
  getCachedBriefcases(_iModelId?: GuidString): Promise<LocalBriefcaseProps[]>;

  /**
   * Open a key/value pair base storage
   * @param _storageId string identifier of storage
   */
  storageMgrOpen(_storageId: string): Promise<string>;

  /**
   * Close a key/value pair base storage
   * @param _storageId string identifier of storage
   * @param _deleteOnClose delete the storage on close
   */
  storageMgrClose(_storageId: string, _deleteOnClose: boolean): Promise<void>;

  /**
   * Get the names of available storages
   * @note returns list of storage names
   */
  storageMgrNames(): Promise<string[]>;

  /**
   * Get the value associated with a key.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   * @note returns key value or undefined
   */
  storageGet(_storageId: string, _key: string): Promise<StorageValue | undefined>;

  /**
   * Set a value for a key.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   * @param _value value to be set
   */
  storageSet(_storageId: string, _key: string, _value: StorageValue): Promise<void>;

  /**
   * Remove a key/value pair.
   * @param _storageId string identifier of storage
   * @param _key key identifier for value
   */
  storageRemove(_storageId: string, _key: string): Promise<void>;

  /**
   * Get list of keys in a storage.
   * @param _storageId string identifier of storage
   * @note returns list of storage ids
   */
  storageKeys(_storageId: string): Promise<string[]>;

  /**
   * Delete all key/value pairs.
   * @param _storageId string identifier of storage
   */
  storageRemoveAll(_storageId: string): Promise<void>;

  /** get the type of a value for a key, or undefined if not present. */
  storageGetValueType(_storageId: string, _key: string): Promise<"number" | "string" | "boolean" | "Uint8Array" | "null" | undefined>;
}
