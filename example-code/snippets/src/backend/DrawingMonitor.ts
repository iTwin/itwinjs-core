/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb, IModelDb, ModelSelector } from "@itwin/core-backend";
import { assert, BeDuration, BeEvent, DbResult, GuidString, Id64, Id64Set, Id64String } from "@itwin/core-bentley";
import { ModelIdAndGeometryGuid } from "@itwin/core-common";
import { ECVersion } from "@itwin/ecschema-metadata";

export type DrawingUpdates = Map<Id64String, string>;

type StateName = "Idle" | "Cached" | "Delayed" | "Requested" | "Terminated";

export interface DrawingMonitor {
  getUpdates(): Promise<DrawingUpdates>;
  terminate(): void;
  /** Strictly for unit tests. */
  readonly state: { name: string };
  /** ###TODO remove this - for initial testing only. */
  fakeGeometryChange(): void;
}

export interface DrawingMonitorCreateArgs {
  iModel: BriefcaseDb;
  getUpdateDelay: () => Promise<void>;
  computeUpdates(drawingsToRegenerate: Id64Set): Promise<DrawingUpdates>;
}

export function createDrawingMonitor(args: DrawingMonitorCreateArgs): DrawingMonitor {
  return new DrawingMonitorImpl(args);
}


abstract class DrawingMonitorState {
  public abstract get name(): StateName;

  public constructor(protected readonly monitor: DrawingMonitorImpl) { }
  public getCachedUpdates(): DrawingUpdates | undefined {
    return undefined;
  }

  public onChangeDetected(): DrawingMonitorState {
    this.assertBadTransition("change detected");
    return this;
  }

  public onUpdatesRequested(): DrawingMonitorState {
    this.assertBadTransition("updates requested");
    return this;
  }

  protected requestUpdates(): DrawingMonitorState {
    // ###TODO only request updates for drawings whose provenance is out of date.
    const ecsql = `SELECT ECInstanceId FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL`;
    const drawingIds = this.monitor.iModel.withPreparedStatement(ecsql, (stmt) => {
      const ids = [];
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        ids.push(stmt.getValue(0).getId());
      }

      return ids;
    });

    if (drawingIds.length === 0) {
      return this.monitor.cacheUpdates(undefined);
    }

    return new RequestedState(this.monitor, this.monitor.computeUpdates(new Set(drawingIds)));
  }

  private assertBadTransition(eventName: string): void {
    assert(false, `No transition from DrawingMonitor state ${this.name} on ${eventName}`);
  }
}

class DrawingMonitorImpl implements DrawingMonitor {
  public readonly iModel: BriefcaseDb;
  public readonly computeUpdates: (drawingIds: Id64Set) => Promise<DrawingUpdates>;
  public readonly getUpdateDelay: () => Promise<void>;
  private readonly _onStateChanged = new BeEvent<() => void>();
  private _state: DrawingMonitorState;
  private _awaitingUpdates = false;
  private _removeEventListeners: () => void;

  public get state() {
    return this._state;
  }

  public set state(newState: DrawingMonitorState) {
    if (newState !== this._state) {
      this._state = newState;
      this._onStateChanged.raiseEvent();
    }
  }

  public constructor(args: DrawingMonitorCreateArgs) {
    this.getUpdateDelay = args.getUpdateDelay;
    this.iModel = args.iModel;
    this.computeUpdates = args.computeUpdates;

    // ###TODO check if any drawings need regeneration.
    // For now assume not.
    this._state = new IdleState(this);

    const rmGeomListener = args.iModel.txns.onModelGeometryChanged.addListener((changes) => this.onGeometryChanged(changes));
    const rmCloseListener = args.iModel.onBeforeClose.addListener(() => this.terminate());
    this._removeEventListeners = () => {
      rmGeomListener();
      rmCloseListener();
    };
  }

  public getUpdates(): Promise<DrawingUpdates> {
    if (this._awaitingUpdates) {
      throw new Error("DrawingMonitor.getUpdates called again while awaiting previous call");
    }

    this.state = this._state.onUpdatesRequested();
    const updates = this._state.getCachedUpdates();
    if (updates) {
      this.state = new IdleState(this);
      return Promise.resolve(updates);
    }

    this._awaitingUpdates = true;
    return new Promise<DrawingUpdates>((resolve) => {
      this.awaitUpdates(resolve);
    });
  }

  public terminate(): void {
    this.state = new TerminatedState(this);

    this._removeEventListeners();
    this._removeEventListeners = () => undefined;
  }

  public cacheUpdates(updates: DrawingUpdates | undefined): DrawingMonitorState {
    return new CachedState(this, updates ?? new Map(), this._awaitingUpdates);
  }

  // ### TODO remove this - for initial testing only.
  public fakeGeometryChange(): void {
    this.onGeometryChanged([]);
  }

  private awaitUpdates(resolve: (updates: DrawingUpdates) => void): void {
    assert(!this._awaitingUpdates);
    this._onStateChanged.addOnce(() => {
      const updates = this._state.getCachedUpdates();
      if (!updates) {
        this.awaitUpdates(resolve);
        return;
      }

      this._state = new IdleState(this);
      this._awaitingUpdates = false;
      resolve(updates);
    });
  }

  private onGeometryChanged(_changes: ReadonlyArray<ModelIdAndGeometryGuid>): void {
    // ###TODO check if the model is viewed by any section drawing's spatial view
    // For now we just assume it is.
    this.state = this._state.onChangeDetected();
  }
}

class IdleState extends DrawingMonitorState {
  public get name() { return "Idle" as const; }

  public override onChangeDetected() {
    return new DelayedState(this.monitor);
  }

  public override onUpdatesRequested() {
    return this.requestUpdates();
  }
}

class CachedState extends DrawingMonitorState {
  public get name() { return "Cached" as const; }

  public constructor(monitor: DrawingMonitorImpl, private readonly _updates: DrawingUpdates, private readonly _ignoreDelayOnChange: boolean) {
    super(monitor);
  }

  public override getCachedUpdates() {
    return this._updates;
  }

  public override onChangeDetected() {
    // Our cached results are no longer relevant.
    return this._ignoreDelayOnChange ? new DelayedState(this.monitor) : this.requestUpdates();
  }

  public override onUpdatesRequested() {
    // Updates are available.
    return this;
  }
}

class DelayedState extends DrawingMonitorState {
  public get name() { return "Delayed" as const; }

  public constructor(monitor: DrawingMonitorImpl) {
    super(monitor);

    monitor.getUpdateDelay().then(() => {
      if (this.monitor.state === this) {
        this.monitor.state = this.requestUpdates();
      }
    });
  }

  public override onChangeDetected(): DrawingMonitorState {
    // Restart the delay.
    return new DelayedState(this.monitor);
  }

  public override onUpdatesRequested(): DrawingMonitorState {
    // Cancel the delay.
    return this.requestUpdates();
  }
}

class RequestedState extends DrawingMonitorState {
  public get name() { return "Requested" as const; }

  public constructor(monitor: DrawingMonitorImpl, private readonly _promise: Promise<DrawingUpdates>) {
    super(monitor);

    this._promise.then((updates) => {
      if (this.monitor.state === this) {
        this.monitor.state = this.monitor.cacheUpdates(updates);
      }
    });
  }

  public override onChangeDetected() {
    // Make a new request immediately.
    return this.requestUpdates();
  }
}

class TerminatedState extends DrawingMonitorState {
  public get name() { return "Terminated" as const; }

  public override onUpdatesRequested(): DrawingMonitorState {
    throw new Error("Accessing a terminated DrawingMonitor");
  }
}

namespace Provenance {
  const jsonKey = "bentley:section-drawing-annotation-provenance";
  const jsonVersion = new ECVersion(1, 0, 0);

  export interface Props {
    guids: GuidString[];
  }

  export function compute(spatialViewId: Id64String, iModel: IModelDb): Props {
    const modelSelectorId = iModel.withPreparedStatement(
      `SELECT ModelSelector.Id FROM bis.SpatialViewDefinition WHERE ECInstanceId=${spatialViewId}`,
      (stmt) => {
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getId() : undefined;
      },
    );

    const guids: GuidString[] = [];
    const selector = modelSelectorId ? iModel.elements.tryGetElement<ModelSelector>(modelSelectorId) : undefined;
    if (selector) {
      iModel.withPreparedStatement(
        `SELECT GeometryGuid FROM bis.GeometricModel WHERE ECInstanceId IN ${selector.models.join()}`,
        (stmt) => {
          while (DbResult.BE_SQLITE_ROW === stmt.step()) {
            guids.push(stmt.getValue(0).getGuid());
          }
        },
      );

      guids.sort();
    }

    return { guids };
  }
}
