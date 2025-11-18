/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb } from "@itwin/core-backend";
import { assert, BeDuration, BeEvent, DbResult, Id64Set, Id64String } from "@itwin/core-bentley";
import { ModelIdAndGeometryGuid } from "@itwin/core-common";

export type DrawingUpdates = Map<Id64String, string>;

/** Exported strictly for tests.
 * @internal
 */
export type StateName = "Idle" | "Cached" | "Delayed" | "Requested" | "Terminated";

export interface DrawingMonitor {
  getUpdates(): Promise<DrawingUpdates>;
  terminate(): void;
  /** Strictly for unit tests. */
  readonly stateName: StateName;
}

export interface DrawingMonitorCreateArgs {
  iModel: BriefcaseDb;
  updateDelay: number;
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
      return new CachedState(this.monitor, new Map<Id64String, string>());
    }

    return new RequestedState(this.monitor, this.monitor.computeUpdates(new Set(drawingIds)));
  }

  protected reactToChange(): DrawingMonitorState {
    if (this.monitor.delay > 0) {
      return new DelayedState(this.monitor);
    }

    return this.requestUpdates();
  }

  private assertBadTransition(eventName: string): void {
    assert(false, `No transition from DrawingMonitor state ${this.name} on ${eventName}`);
  }
}

class DrawingMonitorImpl implements DrawingMonitor {
  public readonly delay: number;
  public readonly iModel: BriefcaseDb;
  public readonly computeUpdates: (drawingIds: Id64Set) => Promise<DrawingUpdates>;
  private readonly _onStateChanged = new BeEvent<() => void>();
  private _state: DrawingMonitorState;
  private _removeEventListeners: () => void;

  public get state() {
    return this._state;
  }

  public get stateName() {
    return this._state.name;
  }

  public set state(newState: DrawingMonitorState) {
    if (newState !== this._state) {
      this._state = newState;
      this._onStateChanged.raiseEvent();
    }
  }

  public constructor(args: DrawingMonitorCreateArgs) {
    this.delay = args.updateDelay;
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
    this.state = this._state.onUpdatesRequested();
    const updates = this._state.getCachedUpdates();
    if (updates) {
      return Promise.resolve(updates);
    }

    return new Promise<DrawingUpdates>((resolve) => {
      this.awaitUpdates(resolve);
    });
  }

  public terminate(): void {
    this.state = new TerminatedState(this);

    this._removeEventListeners();
    this._removeEventListeners = () => undefined;
  }

  private awaitUpdates(resolve: (updates: DrawingUpdates) => void): void {
    this._onStateChanged.addOnce(() => {
      const updates = this._state.getCachedUpdates();
      if (!updates) {
        this.awaitUpdates(resolve);
        return;
      }

      this._state = new IdleState(this);
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
    return this.reactToChange();
  }

  public override onUpdatesRequested() {
    return this.requestUpdates();
  }
}

class CachedState extends DrawingMonitorState {
  public get name() { return "Cached" as const; }

  public constructor(monitor: DrawingMonitorImpl, private readonly _updates: DrawingUpdates) {
    super(monitor);
  }

  public override getCachedUpdates() {
    return this._updates;
  }

  public override onChangeDetected() {
    // Our cached results are no longer relevant.
    return this.reactToChange();
  }

  public override onUpdatesRequested() {
    // Updates are available.
    return this;
  }
}

class DelayedState extends DrawingMonitorState {
  public get name() { return "Delayed" as const; }
  private readonly _delay: Promise<void>;

  public constructor(monitor: DrawingMonitorImpl) {
    super(monitor);

    this._delay = BeDuration.wait(monitor.delay).then(() => {
      if (this.monitor.state === this) {
        this.monitor.state = this.requestUpdates();
      }
    });
  }

  public override onChangeDetected(): DrawingMonitorState {
    return this.reactToChange();
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
        this.monitor.state = new CachedState(this.monitor, updates);
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
