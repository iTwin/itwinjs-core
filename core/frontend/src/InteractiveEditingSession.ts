/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { assert, BeEvent, compareStrings, DbOpcode, DuplicatePolicy, Id64String, SortedArray } from "@bentley/bentleyjs-core";
import { ElementGeometryChange, Events, IModelWriteRpcInterface, ModelGeometryChanges, ModelGeometryChangesProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IModelApp } from "./IModelApp";

let initialized = false;
const sessions: InteractiveEditingSession[] = [];

/** Represents an active session for performing interactive editing of an [[IModelConnection]].
 * "Interactive editing" refers to modifying the geometry contained in the iModel while viewing the iModel's contents in one or more [[Viewports]] - e.g., creating new [GeometricElement]($backend)s, modifying their geometric properties, and/or deleting them. During the session, any changes made by the user will become visually reflected in the viewport, without the need to wait for brand-new tiles to be generated. The graphics update after every call to [[IModelConnection.saveChanges]] as well as in response to undo and redo.
 * When the session ends, new tiles will begin to be generated for any models whose geometry was modified during the session.
 * The session also provides notifications regarding changes to element geometry.
 * @note The [NativeAppRpcInterface]($common) and [IModelWriteRpcInterface]($common) rpc interfaces are required for interactive editing.
 * @note You **must** end the session before closing the iModel.
 * @note iModels with older versions of the BisCore ECSchema (prior to version 0.1.11) do not support interactive editing.
 * @alpha
 */
export class InteractiveEditingSession {
  /** Maps model Id to accumulated changes to geometric elements within the associated model. */
  private readonly _geometryChanges = new Map<Id64String, SortedArray<ElementGeometryChange>>();
  private _disposed = false;
  private _cleanup?: { off: () => void }; // ###TODO EventSource.on() should just return a function...
  /** The iModel being edited. */
  public readonly iModel: IModelConnection;

  /** Event raised when a new session begins.
   * @see [[onEnding]] and [[onEnd]] for complementary events.
   */
  public static readonly onBegin = new BeEvent<(session: InteractiveEditingSession) => void>();

  /** Event raised when this session is about to end.
   * @see [[onBegin]] for the complementary event.
   * @see [[onEnd]] for an event raised after the session ends.
   */
  public readonly onEnding = new BeEvent<(session: InteractiveEditingSession) => void>();

  /** Event raised when this session has neded.
   * @see [[onBegin]] for the complementary event.
   * @see [[onEnding]] for an event raised just before the session ends.
   */
  public readonly onEnded = new BeEvent<(session: InteractiveEditingSession) => void>();

  /** Event raised after geometric changes are written to the iModel. */
  public readonly onGeometryChanges = new BeEvent<(changes: Iterable<ModelGeometryChanges>, session: InteractiveEditingSession) => void>();

  /** Return whether interactive editing is supported for the specified iModel. It is not supported if the iModel is read-only, or the iModel contains a version of
   * the BisCore ECSchema older than v0.1.11.
   */
  public static async isSupported(imodel: IModelConnection): Promise<boolean> {
    return IModelWriteRpcInterface.getClient().isInteractiveEditingSupported(imodel.getRpcProps());
  }

  /** Get the active editing session for the specified iModel, if any.
   * @note Only one editing session can be active for a given iModel at any given time.
   */
  public static get(imodel: IModelConnection): InteractiveEditingSession | undefined {
    return sessions.find((x) => x.iModel === imodel);
  }

  /** Begin a new editing session.
   * @note You **must** call [[end]] before closing the iModel.
   * @throws Error if a new session could not be started.
   * @see [[isSupported]] to determine whether this method should be expected to succeed.
   */
  public static async begin(imodel: IModelConnection): Promise<InteractiveEditingSession> {
    if (InteractiveEditingSession.get(imodel))
      throw new Error("Cannot create an editing session for an iModel that already has one");

    // Register the session synchronously, in case begin() is called again for same iModel while awaiting asynchronous initialization.
    const session = new InteractiveEditingSession(imodel);
    sessions.push(session);
    try {
      const sessionStarted = await IModelWriteRpcInterface.getClient().toggleInteractiveEditingSession(imodel.getRpcProps(), true);
      assert(sessionStarted); // If it didn't, the rpc interface threw an error.
    } catch (e) {
      session.dispose();
      throw e;
    }

    if (!initialized) {
      initialized = true;
      IModelConnection.onClose.addListener((iModel) => {
        if (undefined !== this.get(iModel))
          throw new Error("InteractiveEditingSession must be ended before closing the associated iModel");
      });
    }

    this.onBegin.raiseEvent(session);

    return session;
  }

  /** Ends this editing session.
   * @throws Error if the session could not be ended, e.g., if it has already been ended.
   * @see [[begin]] to start an editing session.
   */
  public async end(): Promise<void> {
    if (this._disposed || sessions.find((x) => x.iModel === this.iModel) !== this)
      throw new Error("Cannot end editing session after it is disconnected from the iModel");

    this._disposed = true;
    try {
      this.onEnding.raiseEvent(this);
    } finally {
      const sessionEnded = await IModelWriteRpcInterface.getClient().toggleInteractiveEditingSession(this.iModel.getRpcProps(), false);
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

  private constructor(iModel: IModelConnection) {
    this.iModel = iModel;
    if (iModel.eventSource) // ###TODO make this always defined
      this._cleanup = iModel.eventSource.on(Events.NativeApp.namespace, Events.NativeApp.modelGeometryChanges, (changes: any) => this.handleGeometryChanges(changes));
  }

  private dispose(): void {
    this._disposed = true;

    this.onEnding.clear();
    this.onGeometryChanges.clear();
    this.onEnded.clear();

    this._geometryChanges.clear();

    if (this._cleanup) {
      this._cleanup.off();
      this._cleanup = undefined;
    }

    const index = sessions.indexOf(this);
    if (-1 !== index)
      sessions.splice(index);
  }

  private handleGeometryChanges(props: ModelGeometryChangesProps[]): void {
    const changes = ModelGeometryChanges.iterable(props);
    const modelIds: Id64String[] = [];
    for (const modelChanges of changes) {
      // ###TODO do we care about the model range?
      let list = this._geometryChanges.get(modelChanges.id);
      modelIds.push(modelChanges.id);
      for (const elementChange of modelChanges.elements) {
        if (!list)
          this._geometryChanges.set(modelChanges.id, list = new SortedArray<ElementGeometryChange>((lhs, rhs) => compareStrings(lhs.id, rhs.id), DuplicatePolicy.Replace));

        list.insert(elementChange);
        if (DbOpcode.Delete === elementChange.type) {
          this.iModel.selectionSet.remove(elementChange.id);
          this.iModel.hilited.setHilite(elementChange.id, false);
        }
      }

    IModelApp.tileAdmin.onModelGeometryChanged(modelIds);
    }

    this.onGeometryChanges.raiseEvent(changes, this);
  }
}
