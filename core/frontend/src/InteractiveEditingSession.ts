/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { assert, BeEvent, compareStrings, DbOpcode, DuplicatePolicy, GuidString, Id64String, SortedArray } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";
import {
  ElementGeometryChange, ElementsChanged, IModelChangeNotifications, IpcAppChannel, ModelGeometryChanges, ModelGeometryChangesProps, RemoveFunction,
} from "@bentley/imodeljs-common";
import { BriefcaseConnection, BriefcaseNotificationHandler } from "./BriefcaseConnection";
import { IpcApp } from "./IpcApp";

class ModelChanges extends SortedArray<ElementGeometryChange> {
  public geometryGuid: GuidString;
  public readonly range: Range3d;

  public constructor(geometryGuid: GuidString, range: Range3d) {
    super((lhs, rhs) => compareStrings(lhs.id, rhs.id), DuplicatePolicy.Replace);
    this.geometryGuid = geometryGuid;
    this.range = range;
  }
}

/**
 * Represents an active session for performing [interactive editing]($docs/learning/InteractiveEditing.md) of a [[BriefcaseConnection]].
 * An important aspect of interactive editing is keeping the contents of views in sync with the changes to [GeometricElement]($backend)s.
 * During the session, any changes made by the user are displayed in the viewport without the need to wait for tiles to be regenerated.
 * The graphics update after every call to [[BriefcaseConnection.saveChanges]] as well as in response to undo/redo.
 * When the session ends, new tiles will begin to be generated for any models whose geometry was modified during the session.
 * The session also provides notifications of the list of changed elements for every Txn.
 * @note You **must** end the session before closing the iModel.
 * @note iModels with versions of the BisCore ECSchema prior to version 0.1.11 do not support interactive editing.
 * @beta
 */
export class InteractiveEditingSession extends BriefcaseNotificationHandler implements IModelChangeNotifications {
  public get briefcaseChannelName() { return IpcAppChannel.IModelChanges; }

  /** Maps model Id to accumulated changes to geometric elements within the associated model. */
  private readonly _geometryChanges = new Map<Id64String, ModelChanges>();
  private _disposed = false;
  private _cleanup?: RemoveFunction;

  /** The connection to the iModel being edited. */
  public readonly iModel: BriefcaseConnection;

  /** Event raised when a new session begins.
   * @see [[onEnding]] and [[onEnd]] for complementary events.
   */
  public static readonly onBegin = new BeEvent<(session: InteractiveEditingSession) => void>();

  /** Event raised when this session is about to end.
   * @see [[onBegin]] for the complementary event.
   * @see [[onEnd]] for an event raised after the session ends.
   */
  public readonly onEnding = new BeEvent<(session: InteractiveEditingSession) => void>();

  /** Event raised when this session has ended.
   * @see [[onBegin]] for the complementary event.
   * @see [[onEnding]] for an event raised just before the session ends.
   */
  public readonly onEnded = new BeEvent<(session: InteractiveEditingSession) => void>();

  /** Event raised after Txn validation or changeset apply to indicate the set of changed elements.
   * @note If there are many changed elements in a single Txn, the notifications are sent in batches so this event *may be called multiple times* per Txn.
   */
  public readonly onElementChanges = new BeEvent<(changes: ElementsChanged, iModel: BriefcaseConnection) => void>();

  /** Event raised after geometric changes are written to the iModel. */
  public readonly onGeometryChanges = new BeEvent<(changes: Iterable<ModelGeometryChanges>, session: InteractiveEditingSession) => void>();

  /** Don't call this directly - use BriefcaseConnection.beginEditingSession.
   * @internal
   */
  public static async begin(imodel: BriefcaseConnection): Promise<InteractiveEditingSession> {
    if (imodel.editingSession)
      throw new Error("Cannot create an editing session for an iModel that already has one");

    // Register the session synchronously, in case begin() is called again for same iModel while awaiting asynchronous initialization.
    const session = new InteractiveEditingSession(imodel);
    try {
      const sessionStarted = await IpcApp.callIpcHost("toggleInteractiveEditingSession", imodel.key, true);
      assert(sessionStarted); // If it didn't, the backend threw an error.
    } catch (e) {
      session.dispose();
      throw e;
    }

    this.onBegin.raiseEvent(session);

    return session;
  }

  /** Ends this editing session. The associated [[BriefcaseConnection]]'s `editingSession` will be reset to `undefined`.
   * @throws Error if the session could not be ended, e.g., if it has already been ended.
   * @see [[BriefcaseConnection.beginEditingSession]] to start an editing session.
   */
  public async end(): Promise<void> {
    if (this._disposed || this.iModel.editingSession !== this)
      throw new Error("Cannot end editing session after it is disconnected from the iModel");

    this._disposed = true;
    try {
      this.onEnding.raiseEvent(this);
    } finally {
      const sessionEnded = await IpcApp.callIpcHost("toggleInteractiveEditingSession", this.iModel.key, false);
      assert(!sessionEnded);
      try {
        this.onEnded.raiseEvent(this);
      } finally {
        this.dispose();
      }
    }
  }

  /** Obtain all geometric changes to elements within the specified model accumulated during this session. */
  public getGeometryChangesForModel(modelId: Id64String): Iterable<ElementGeometryChange> | undefined {
    return this._geometryChanges.get(modelId);
  }

  /** Obtain all geometric changes to models accumulated during this session. */
  public getGeometryChanges(): Iterable<ModelGeometryChanges> {
    return { [Symbol.iterator]: () => this.geometryChangeIterator() };
  }

  /** @internal */
  public get isDisposed() {
    return this._disposed;
  }

  private * geometryChangeIterator(): Iterator<ModelGeometryChanges> {
    for (const [key, value] of this._geometryChanges) {
      yield {
        id: key,
        geometryGuid: value.geometryGuid,
        range: value.range,
        elements: value,
      };
    }
  }

  private constructor(iModel: BriefcaseConnection) {
    super(iModel.key);
    this.iModel = iModel;
    this._cleanup = this.registerImpl();
  }

  private dispose(): void {
    this._disposed = true;

    this.onEnding.clear();
    this.onGeometryChanges.clear();
    this.onEnded.clear();

    this._geometryChanges.clear();

    if (this._cleanup) {
      this._cleanup();
      this._cleanup = undefined;
    }
  }

  /** @internal */
  public notifyElementsChanged(changed: ElementsChanged) {
    this.onElementChanges.raiseEvent(changed, this.iModel);
  }

  /** @internal */
  public notifyGeometryChanged(props: ModelGeometryChangesProps[]) {
    const changes = ModelGeometryChanges.iterable(props);
    const modelIds: Id64String[] = [];
    for (const modelChanges of changes) {
      // ###TODO do we care about the model range?
      let list = this._geometryChanges.get(modelChanges.id);
      modelIds.push(modelChanges.id);
      for (const elementChange of modelChanges.elements) {
        if (!list) {
          this._geometryChanges.set(modelChanges.id, list = new ModelChanges(modelChanges.geometryGuid, modelChanges.range));
        } else {
          list.geometryGuid = modelChanges.geometryGuid;
          modelChanges.range.clone(list.range);
        }

        list.insert(elementChange);
        if (DbOpcode.Delete === elementChange.type) {
          this.iModel.selectionSet.remove(elementChange.id);
          this.iModel.hilited.setHilite(elementChange.id, false);
        }
      }
    }

    this.onGeometryChanges.raiseEvent(changes, this);
  }
}
