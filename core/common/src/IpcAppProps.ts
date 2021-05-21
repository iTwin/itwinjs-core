/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { CompressedId64Set, GuidString, Id64String, IModelStatus, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { Range3dProps, XYZProps } from "@bentley/geometry-core";
import { OpenBriefcaseProps } from "./BriefcaseTypes";
import {
  EcefLocationProps, IModelConnectionProps, IModelRpcProps, RootSubjectProps, StandaloneOpenOptions,
} from "./IModel";
import { IModelVersionProps } from "./IModelVersion";
import { ModelGeometryChangesProps } from "./ModelGeometryChanges";
import { GeographicCRSProps } from "./geometry/CoordinateReferenceSystem";

/** Identifies a list of tile content Ids belonging to a single tile tree.
 * @internal
 */
export interface TileTreeContentIds {
  treeId: string;
  contentIds: string[];
}

/** Specifies a [GeometricModel]($backend)'s Id and a Guid identifying the current state of the geometry contained within the model.
 * @see [TxnManager.onModelGeometryChanged]($backend) and [BriefcaseTxns.onModelGeometryChanged]($frontend).
 * @public
 */
export interface ModelIdAndGeometryGuid {
  /** The model's Id. */
  id: Id64String;
  /** A unique identifier for the current state of the model's geometry. If the guid differs between two revisions of the same iModel, it indicates that the geometry differs.
   * This is primarily an implementation detail used to determine whether [Tile]($frontend)s produced for one revision are compatible with another revision.
   */
  guid: GuidString;
}

/** The set of elements or models that were changed by a [Txn]($docs/learning/InteractiveEditing.md)
 * @note this object holds lists of ids of elements or models that were modified somehow during the Txn. Any modifications to an [[ElementAspect]]($backend) will
 * cause its element to appear in these lists.
 * @see [TxnManager.onElementsChanged]($backend) and [TxnManager.onModelsChanged]($backend).
 * @see [BriefcaseTxns.onElementsChanged]($frontend) and [BriefcaseTxns.onModelsChanged]($frontend).
 * @public
 */
export interface ChangedEntities {
  /** The ids of entities that were inserted during this Txn */
  inserted?: CompressedId64Set;
  /** The ids of entities that were deleted during this Txn */
  deleted?: CompressedId64Set;
  /** The ids of entities that were modified during this Txn */
  updated?: CompressedId64Set;
}

/** @internal */
export enum IpcAppChannel {
  Functions = "ipc-app",
  AppNotify = "ipcApp-notify",
  Txns = "txns",
  EditingScope = "editing-scope",
}

/**
 * Interface implemented by the frontend [NotificationHandler]($common) to be notified of events from IpcApp backend.
 * @internal
 */
export interface IpcAppNotifications {
  notifyApp: () => void;
}

/** Interface implemented by the frontend [NotificationHandler]($common) to be notified of changes to an iModel.
 * @see [TxnManager]($backend) for the source of these events.
 * @see [BriefcaseTxns]($frontend) for the frontend implementation.
 * @internal
 */
export interface TxnNotifications {
  notifyElementsChanged: (changes: ChangedEntities) => void;
  notifyModelsChanged: (changes: ChangedEntities) => void;
  notifyGeometryGuidsChanged: (changes: ModelIdAndGeometryGuid[]) => void;
  notifyCommit: () => void;
  notifyCommitted: (hasPendingTxns: boolean, time: number) => void;
  notifyChangesApplied: () => void;
  notifyBeforeUndoRedo: (isUndo: boolean) => void;
  notifyAfterUndoRedo: (isUndo: boolean) => void;
  notifyPulledChanges: (parentChangeSetId: string) => void;
  notifyPushedChanges: (parentChangeSetId: string) => void;

  notifyIModelNameChanged: (name: string) => void;
  notifyRootSubjectChanged: (subject: RootSubjectProps) => void;
  notifyProjectExtentsChanged: (extents: Range3dProps) => void;
  notifyGlobalOriginChanged: (origin: XYZProps) => void;
  notifyEcefLocationChanged: (ecef: EcefLocationProps | undefined) => void;
  notifyGeographicCoordinateSystemChanged: (gcs: GeographicCRSProps | undefined) => void;
}

/**
 * Interface registered by the frontend [NotificationHandler]($common) to be notified of changes to an iModel during an [GraphicalEditingScope]($frontend).
 * @internal
 */
export interface EditingScopeNotifications {
  notifyGeometryChanged: (modelProps: ModelGeometryChangesProps[]) => void;
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

  /** see BriefcaseConnection.openFile */
  openBriefcase: (_args: OpenBriefcaseProps) => Promise<IModelConnectionProps>;
  /** see BriefcaseConnection.openStandalone */
  openStandalone: (_filePath: string, _openMode: OpenMode, _opts?: StandaloneOpenOptions) => Promise<IModelConnectionProps>;
  /** see BriefcaseConnection.close */
  closeIModel: (key: string) => Promise<void>;
  /** see BriefcaseConnection.saveChanges */
  saveChanges: (key: string, description?: string) => Promise<void>;
  /** see BriefcaseTxns.hasPendingTxns */
  hasPendingTxns: (key: string) => Promise<boolean>;
  /** see BriefcaseTxns.isUndoPossible */
  isUndoPossible: (key: string) => Promise<boolean>;
  /** see BriefcaseTxns.isRedoPossible */
  isRedoPossible: (key: string) => Promise<boolean>;
  /** see BriefcaseTxns.getUndoString */
  getUndoString: (key: string, allowCrossSessions?: boolean) => Promise<string>;
  /** see BriefcaseTxns.getRedoString */
  getRedoString: (key: string) => Promise<string>;

  /** see BriefcaseConnection.pullAndMergeChanges */
  pullAndMergeChanges: (key: string, version?: IModelVersionProps) => Promise<string>;
  /** see BriefcaseConnection.pushChanges */
  pushChanges: (key: string, description: string) => Promise<string>;
  /** Cancels currently pending or active generation of tile content.  */
  cancelTileContentRequests: (tokenProps: IModelRpcProps, _contentIds: TileTreeContentIds[]) => Promise<void>;

  /** Cancel element graphics requests.
   * @see [[IModelTileRpcInterface.requestElementGraphics]].
   */
  cancelElementGraphicsRequests: (key: string, _requestIds: string[]) => Promise<void>;

  toggleGraphicalEditingScope: (key: string, _startSession: boolean) => Promise<boolean>;
  isGraphicalEditingSupported: (key: string) => Promise<boolean>;

  reverseTxns: (key: string, numOperations: number, allowCrossSessions?: boolean) => Promise<IModelStatus>;
  reverseAllTxn: (key: string) => Promise<IModelStatus>;
  reinstateTxn: (key: string) => Promise<IModelStatus>;

  /** Query the number of concurrent threads supported by the host's IO or CPU thread pool. */
  queryConcurrency: (pool: "io" | "cpu") => Promise<number>;
}

