/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { assert, BeEvent, compareStrings, Id64String, SortedArray } from "@bentley/bentleyjs-core";
import { ElementGeometryChange, Events, IModelWriteRpcInterface, ModelGeometryChanges, ModelGeometryChangesProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";

let initialized = false;
const sessions: InteractiveEditingSession[] = [];

export class InteractiveEditingSession {
  /** Maps model Id to accumulated changes to geometric elements within the associated model. */
  private readonly _geometryChanges = new Map<Id64String, SortedArray<ElementGeometryChange>>();
  private _disposed = false;
  private _cleanup?: { off: () => void; }; // ###TODO EventSource.on() should just return a function...
  public readonly iModel: IModelConnection;

  public static readonly onBegin = new BeEvent<(session: InteractiveEditingSession) => void>();
  public readonly onEnding = new BeEvent<(session: InteractiveEditingSession) => void>();
  public readonly onEnded = new BeEvent<(session: InteractiveEditingSession) => void>();
  public readonly onGeometryChanges = new BeEvent<(changes: Iterable<ModelGeometryChanges>, session: InteractiveEditingSession) => void>();

  public static async isSupported(imodel: IModelConnection): Promise<boolean> {
    return IModelWriteRpcInterface.getClient().isInteractiveEditingSupported(imodel.getRpcProps());
  }

  public static get(imodel: IModelConnection): InteractiveEditingSession | undefined {
    return sessions.find((x) => x.iModel === imodel);
  }

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
      IModelConnection.onClose.addListener((imodel) => {
        if (undefined !== this.get(imodel))
          throw new Error("InteractiveEditingSession must be ended before closing the associated iModel");
      });
    }

    this.onBegin.raiseEvent(session);

    return session;
  }

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
    for (const modelChanges of changes) {
      // ###TODO do we care about the model range?
      let list = this._geometryChanges.get(modelChanges.id);
      for (const elementChange of ElementGeometryChange.iterable(modelChanges)) {
        if (!list)
          this._geometryChanges.set(modelChanges.id, list = new SortedArray<ElementGeometryChange>((lhs, rhs) => compareStrings(lhs.id, rhs.id)));

        list.insert(elementChange);
      }
    }

    this.onGeometryChanges.raiseEvent(changes, this);
  }
}
