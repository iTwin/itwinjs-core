/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import type { GuidString, Id64String} from "@itwin/core-bentley";
import { assert, BeEvent, compareStrings, DbOpcode, DuplicatePolicy, SortedArray } from "@itwin/core-bentley";
import type { Range3d } from "@itwin/core-geometry";
import type {
  EditingScopeNotifications, ElementGeometryChange, ModelGeometryChangesProps, RemoveFunction} from "@itwin/core-common";
import { IpcAppChannel, ModelGeometryChanges,
} from "@itwin/core-common";
import { BriefcaseNotificationHandler } from "./BriefcaseTxns";
import type { BriefcaseConnection } from "./BriefcaseConnection";
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

/** Represents a period of time within an [interactive editing]($docs/learning/InteractiveEditing.md) session during which the
 * geometry of elements being displayed in one or more [[Viewport]]s is being modified. Outside of such a scope, whenever the
 * geometry within a [GeometricModel]($backend) changes new [[Tile]]s must be generated to reflect those changes in a viewport.
 * Regenerating entire tiles each time individual elements change can be time-consuming, which may introduce an unacceptable delay
 * between making a modification and seeing its result on the screen.
 *
 * Within the context of a graphical editing scope, no new tiles are generated. Instead, the geometry for any deleted or modified elements
 * is hidden in the tile graphics, and additional temporary graphics are displayed for any newly-inserted or modified elements. Only when the
 * scope exits are new tiles produced.
 *
 * The application decides when to enter and exit a graphical editing scope. A single interactive editing session may involve any number of
 * editing scopes. Typically, applications will enter a new editing scope (after first exiting a previous scope, if one exists):
 *  - When switching from a non-graphical workflow to one that involves editing geometry; or
 *  - When changing which geometric model is being edited; or
 *  - After performing an operation that creates or modifies a "large" number (perhaps hundreds?) of elements.
 *
 * An application should typically exit any graphical editing scope before:
 *  - Pulling changesets; or
 *  - Switching from a graphical editing workflow to some non-graphical workflow.
 *
 * Graphical editing scopes are only supported for [[BriefcaseConnection]]s opened in read-write mode that contain version 1.0.11 or newer of the BisCore schema.
 * @see [[BriefcaseConnection.enterEditingScope]] to create a scope for a briefcase.
 * @see [[BriefcaseConnection.editingScope]] to obtain a briefcase's current scope.
 * @see [[exit]] to terminate a scope.
 * @public
 */
export class GraphicalEditingScope extends BriefcaseNotificationHandler implements EditingScopeNotifications {
  public get briefcaseChannelName() { return IpcAppChannel.EditingScope; }

  /** Maps model Id to accumulated changes to geometric elements within the associated model. */
  private readonly _geometryChanges = new Map<Id64String, ModelChanges>();
  private _disposed = false;
  private _cleanup?: RemoveFunction;

  /** The connection to the iModel being edited. */
  public readonly iModel: BriefcaseConnection;

  /** Event raised when a new scope is created for any [[BriefcaseConnection]].
   * @see [[onExiting]] and [[onExited]] for complementary events.
   */
  public static readonly onEnter = new BeEvent<(scope: GraphicalEditingScope) => void>();

  /** Event raised when this scope is about to exit.
   * @see [[onEnter]] for the complementary event.
   * @see [[onExited]] for an event raised after the scope exits.
   */
  public readonly onExiting = new BeEvent<(scope: GraphicalEditingScope) => void>();

  /** Event raised when this scope has exited.
   * @see [[onEnter]] for the complementary event.
   * @see [[onExiting]] for an event raised just before the scope is exited.
   */
  public readonly onExited = new BeEvent<(scope: GraphicalEditingScope) => void>();

  /** Event raised after geometric changes are written to the iModel. */
  public readonly onGeometryChanges = new BeEvent<(changes: Iterable<ModelGeometryChanges>, scope: GraphicalEditingScope) => void>();

  /** Don't call this directly - use BriefcaseConnection.enterEditingScope.
   * @internal
   */
  public static async enter(imodel: BriefcaseConnection): Promise<GraphicalEditingScope> {
    if (imodel.editingScope)
      throw new Error("Cannot create an editing scope for an iModel that already has one");

    // Register the scope synchronously, in case enter() is called again for same iModel while awaiting asynchronous initialization.
    const scope = new GraphicalEditingScope(imodel);
    try {
      const scopeStarted = await IpcApp.callIpcHost("toggleGraphicalEditingScope", imodel.key, true);
      assert(scopeStarted); // If it didn't, the backend threw an error.
    } catch (e) {
      scope.dispose();
      throw e;
    }

    this.onEnter.raiseEvent(scope);

    return scope;
  }

  /** Exits this editing scope. The associated [[BriefcaseConnection]]'s `editingScope` will be reset to `undefined`.
   * @throws Error if the scope could not be exited, e.g., if it has already been exited.
   * @see [[BriefcaseConnection.enterEditingScope]] to enter an editing scope.
   */
  public async exit(): Promise<void> {
    if (this._disposed || this.iModel.editingScope !== this)
      throw new Error("Cannot exit editing scope after it is disconnected from the iModel");

    this._disposed = true;
    try {
      this.onExiting.raiseEvent(this);
    } finally {
      const scopeExited = await IpcApp.callIpcHost("toggleGraphicalEditingScope", this.iModel.key, false);
      assert(!scopeExited);
      try {
        this.onExited.raiseEvent(this);
      } finally {
        this.dispose();
      }
    }
  }

  /** Obtain all geometric changes to elements within the specified model accumulated within this scope. */
  public getGeometryChangesForModel(modelId: Id64String): Iterable<ElementGeometryChange> | undefined {
    return this._geometryChanges.get(modelId);
  }

  /** Obtain all geometric changes to models accumulated within this scope. */
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

    this.onExiting.clear();
    this.onGeometryChanges.clear();
    this.onExited.clear();

    this._geometryChanges.clear();

    if (this._cleanup) {
      this._cleanup();
      this._cleanup = undefined;
    }
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
