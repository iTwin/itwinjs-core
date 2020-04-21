/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelProps, IModelRpcProps } from "../IModel";
import { LogLevel, OpenMode, GuidString } from "@bentley/bentleyjs-core";

/**
 * Status of downloading a briefcase
 * @internal
 */
export enum DownloadBriefcaseStatus {
  NotStarted,
  Initializing,
  DownloadingCheckpoint,
  DownloadingChangeSets,
  ApplyingChangeSets,
  Complete,
  Error,
}

/** Operations allowed when synchronizing changes between the Briefcase and the iModelHub
 * @public
 */
export enum SyncMode { FixedVersion = 1, PullAndPush = 2, PullOnly = 3 }

/**
 * Key to locate a briefcase
 * @internal
 */
export type BriefcaseKey = string;

/**
 * Options to download the briefcase
 * @beta
 */
export interface DownloadBriefcaseOptions {
  /** This setting defines the operations allowed when synchronizing changes between the briefcase and iModelHub */
  syncMode: SyncMode;
}

/**
 * Options to open the briefcase
 * @beta
 */
export interface OpenBriefcaseOptions {
  /** Limit the opened briefcase for Readonly operations by establishing a Readonly connection with the Db */
  openAsReadOnly?: boolean;
}

/**
 * Properties required to request download of a briefcase
 * @internal
 */
export interface RequestBriefcaseProps {
  /** Context (Project or Asset) that the iModel belongs to */
  readonly contextId: GuidString;

  /** Id of the iModel */
  readonly iModelId: GuidString;

  /** Id of the change set */
  readonly changeSetId: GuidString;
}

/**
 * Properties of a briefcase
 * @internal
 */
export interface BriefcaseProps extends RequestBriefcaseProps, DownloadBriefcaseOptions {
  /** Key to locate the briefcase in the disk cache */
  readonly key: BriefcaseKey;

  /** Mode used to open the briefcase */
  openMode: OpenMode;

  /** Status of downloading a briefcase */
  downloadStatus: DownloadBriefcaseStatus;

  /** File size of the briefcase on disk - only set for briefcases that are completely downloaded */
  fileSize?: number;
}

/**
 * Manages the download of a briefcase
 * @internal
 */
export interface BriefcaseDownloader {
  /** Properties of the briefcase that's being downloaded */
  briefcaseProps: BriefcaseProps;

  /** Promise that resolves when the download completes. await this to complete the download */
  downloadPromise: Promise<void>;

  /** Request cancellation of the download */
  requestCancel: () => Promise<boolean>;
}

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
  public static interfaceVersion = "0.2.0";

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

  // Storage Manager Persistence Api
  public async storageMgrOpen(_storageId: string): Promise<string> { return this.forward(arguments); }
  public async storageMgrClose(_storageId: string, _deleteIt: boolean): Promise<void> { return this.forward(arguments); }
  public async storageMgrNames(): Promise<string[]> { return this.forward(arguments); }

  // Storage Persistence Api
  public async storageGet(_storageId: string, _key: string): Promise<StorageValue | undefined> { return this.forward(arguments); }
  public async storageSet(_storageId: string, _key: string, _value: StorageValue): Promise<void> { return this.forward(arguments); }
  public async storageRemove(_storageId: string, _key: string): Promise<void> { return this.forward(arguments); }
  public async storageKeys(_storageId: string): Promise<string[]> { return this.forward(arguments); }
  public async storageRemoveAll(_storageId: string): Promise<void> { return this.forward(arguments); }
}
