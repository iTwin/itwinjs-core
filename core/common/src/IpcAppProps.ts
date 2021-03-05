/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { IModelStatus, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { OpenBriefcaseProps } from "./BriefcaseTypes";
import { IModelConnectionProps, IModelRpcProps, StandaloneOpenOptions } from "./IModel";
import { IModelVersionProps } from "./IModelVersion";
import { ElementsChanged, ModelGeometryChangesProps } from "./ModelGeometryChanges";

/** Identifies a list of tile content Ids belonging to a single tile tree.
 * @internal
 */
export interface TileTreeContentIds {
  treeId: string;
  contentIds: string[];
}

/** @internal */
export enum IpcAppChannel {
  Functions = "ipc-app",
  AppNotify = "ipcApp-notify",
  IModelChanges = "imodel-changes",
  PushPull = "push-pull",
}

/**
 * Interface implemented by the frontend [NotificationHandler]($common) to be notified of events from IpcApp backend.
 * @internal
 */
export interface IpcAppNotifications {
}

/**
 * Interface registered by the frontend [NotificationHandler]($common) to be notified of changes to an iModel
 * @internal
 */
export interface IModelChangeNotifications {
  notifyElementsChanged: (changes: ElementsChanged) => void;
  notifyGeometryChanged: (modelProps: ModelGeometryChangesProps[]) => void;
}

/** @internal */
export interface BriefcasePushAndPullNotifications {
  notifyPulledChanges: (arg: { parentChangeSetId: string }) => void;
  notifyPushedChanges: (arg: { parentChangeSetId: string }) => void;
  notifySavedChanges: (arg: { hasPendingTxns: boolean, time: number }) => void;
}

/**
 * The methods that may be invoked via Ipc from the frontend of an IpcApp and are implemented on its backend.
 * @internal
 */
export interface IpcAppFunctions {

  /** Send frontend log to backend.
   * @param _level Specify log level.
   * @param _category Specify log category.
   * @param _message Specify log message.
   * @param _metaData metaData if any.
   */
  log: (_timestamp: number, _level: LogLevel, _category: string, _message: string, _metaData?: any) => Promise<void>;

  /**
   * Open a briefcase file from the local disk.
   */
  openBriefcase: (_args: OpenBriefcaseProps) => Promise<IModelConnectionProps>;

  /** Open a standalone iModel from a file name. */
  openStandalone: (_filePath: string, _openMode: OpenMode, _opts?: StandaloneOpenOptions) => Promise<IModelConnectionProps>;

  /** Close a previously opened iModel. */
  closeIModel: (key: string) => Promise<void>;

  /** Save any local changes. */
  saveChanges: (key: string, description?: string) => Promise<void>;

  /** Determine whether there are outstanding txns . */
  hasPendingTxns: (key: string) => Promise<boolean>;

  /** pull (and potentially merge local) changesets up to the specified version into this Briefcase. */
  pullAndMergeChanges: (key: string, version?: IModelVersionProps) => Promise<void>;

  pushChanges: (key: string, description: string) => Promise<string>;

  /** Cancels currently pending or active generation of tile content.
     * @param _iModelToken Identifies the iModel
     * @param _contentIds A list of content requests to be canceled, grouped by tile tree Id.
     * @internal
     */
  cancelTileContentRequests: (tokenProps: IModelRpcProps, _contentIds: TileTreeContentIds[]) => Promise<void>;

  /** Cancel element graphics requests.
   * @see [[IModelTileRpcInterface.requestElementGraphics]].
   */
  cancelElementGraphicsRequests: (key: string, _requestIds: string[]) => Promise<void>;

  toggleInteractiveEditingSession: (key: string, _startSession: boolean) => Promise<boolean>;
  isInteractiveEditingSupported: (key: string) => Promise<boolean>;
  reverseSingleTxn: (key: string) => Promise<IModelStatus>;
  reverseAllTxn: (key: string) => Promise<IModelStatus>;
  reinstateTxn: (key: string) => Promise<IModelStatus>;

  /** Query the number of concurrent threads supported by the host's IO or CPU thread pool. */
  queryConcurrency: (pool: "io" | "cpu") => Promise<number>;
}

