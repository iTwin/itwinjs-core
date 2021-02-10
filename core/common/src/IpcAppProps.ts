/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { OpenBriefcaseProps } from "./BriefcaseTypes";
import { IModelConnectionProps, IModelRpcProps, StandaloneOpenOptions } from "./IModel";
import { ModelGeometryChangesProps } from "./ModelGeometryChanges";

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
  GeometryChanges = "geometry-changes",
  PushPull = "push-pull",
}

/**
 * Interface registered by the frontend [NotificationHandler]($common) to be notified of geometry changes
 * @internal
 */
export interface GeometryChangeNotifications {
  notifyGeometryChanged: (models: ModelGeometryChangesProps[]) => void;
}

/** @internal */
export interface BriefcasePushAndPullNotifications {
  notifyPulledChanges: (arg: { parentChangeSetId: string }) => void;
  notifyPushedChanges: (arg: { parentChangeSetId: string }) => void;
  notifySavedChanges: (arg: { hasPendingTxns: boolean, time: number }) => void;
}

/**
 * The methods that may be invoked via Ipc from the frontend of a Native App and are implemented on its backend.
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

  pullAndMergeChanges: (key: string) => Promise<IModelConnectionProps>;
  pushChanges: (key: string, description: string) => Promise<IModelConnectionProps>;

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

  /** @internal */
  toggleInteractiveEditingSession: (key: string, _startSession: boolean) => Promise<boolean>;
  /** @internal */
  isInteractiveEditingSupported: (key: string) => Promise<boolean>;
}

