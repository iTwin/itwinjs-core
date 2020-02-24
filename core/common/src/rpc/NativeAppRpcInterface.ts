/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelTokenProps, IModelProps } from "../IModel";
import { LogLevel } from "@bentley/bentleyjs-core";

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
    export const onInternetConnectivityChanged = "onInternetConnectivityChanged";
  }
}

/**
 * Briefcase props
 * @internal
 */
export interface BriefcaseProps extends IModelTokenProps {
  downloading?: boolean;
  isOpen?: boolean;
  fileSize?: number;
}

/** Identifies a list of tile content Ids belonging to a single tile tree.
 * @internal
 */
export interface TileTreeContentIds {
  treeId: string;
  contentIds: string[];
}

/** InternetConnectivityStatus describe type of connectivity avaliable to application
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
  public static interfaceVersion = "0.1.3";

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
  public async fetchEvents(_iModelToken: IModelTokenProps, _maxToFetch: number): Promise<QueuedEvent[]> { return this.forward(arguments); }
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
  public async cancelTileContentRequests(_iModelToken: IModelTokenProps, _contentIds: TileTreeContentIds[]): Promise<void> { return this.forward(arguments); }

  /**
   * Downloads briefcase only. The call require internet connection and must have valid token.
   * @param _iModelToken IModel context information.
   * @returns IModelTokenProps which allow to create IModelConnection.
   */
  public async downloadBriefcase(_iModelToken: IModelTokenProps): Promise<IModelTokenProps> { return this.forward(arguments); }

  /**
   * Opens briefcase. This api can be called offline. It open briefcase on disk.
   * @param _iModelToken IModel context information.
   * @returns IModelTokenProps which allow to create IModelConnection.
   */
  public async openBriefcase(_iModelToken: IModelTokenProps): Promise<IModelProps> { return this.forward(arguments); }

  /**
   * Gets briefcases properties that are available cache.
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
