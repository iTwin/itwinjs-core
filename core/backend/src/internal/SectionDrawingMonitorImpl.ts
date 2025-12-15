/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb } from "../IModelDb";
import { assert, BeEvent, DbResult, Id64String } from "@itwin/core-bentley";
import { ModelIdAndGeometryGuid } from "@itwin/core-common";
import { SectionDrawingMonitor, SectionDrawingMonitorCreateArgs, SectionDrawingUpdate } from "../SectionDrawingMonitor";
import { SectionDrawingProvenance } from "../SectionDrawingProvenance";
import { ModelSelector } from "../ViewDefinition";
import { SectionDrawing } from "../Element";

type StateName = "Idle" | "Cached" | "Delayed" | "Requested" | "Terminated";

abstract class DrawingMonitorState {
  public abstract get name(): StateName;

  public constructor(protected readonly monitor: SectionDrawingMonitorImpl) { }
  public getCachedUpdates(): SectionDrawingUpdate[] | undefined {
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
    const ecsql = `SELECT ECInstanceId,SpatialView.Id FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL`;
    const db = this.monitor.iModel;
    const drawingsToRegenerate = db.withPreparedStatement(ecsql, (stmt) => {
      const ids = new Map<Id64String, SectionDrawingProvenance>();
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const id = stmt.getValue(0).getId();
        const drawing = db.elements.getElement<SectionDrawing>(id);
        const storedProvenance = SectionDrawingProvenance.extract(drawing);
        const computedProvenance = SectionDrawingProvenance.compute(drawing);
        if (!storedProvenance || !storedProvenance.equals(computedProvenance)) {
          ids.set(id, computedProvenance);
        }
      }

      return ids;
    });

    if (drawingsToRegenerate.size === 0) {
      return this.monitor.cacheUpdates(undefined);
    }

    return new RequestedState(this.monitor, this.monitor.computeUpdates(drawingsToRegenerate));
  }

  private assertBadTransition(eventName: string): void {
    assert(false, `No transition from DrawingMonitor state ${this.name} on ${eventName}`);
  }
}

// Exported strictly for unit tests.
export class SectionDrawingMonitorImpl implements SectionDrawingMonitor {
  public readonly iModel: BriefcaseDb;
  public readonly computeUpdates: (drawingIds: Map<Id64String, SectionDrawingProvenance>) => Promise<SectionDrawingUpdate[]>;
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

  public constructor(args: SectionDrawingMonitorCreateArgs) {
    this.getUpdateDelay = args.getUpdateDelay;
    this.iModel = args.iModel;
    this.computeUpdates = args.computeUpdates;

    const ecsql = `SELECT ECInstanceId FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL`;
    const anyUpdatesNeeded = this.iModel.withPreparedStatement(ecsql, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const drawing = this.iModel.elements.getElement<SectionDrawing>(stmt.getValue(0).getId());
        const storedProvenance = SectionDrawingProvenance.extract(drawing);
        if (!storedProvenance || !storedProvenance.equals(SectionDrawingProvenance.compute(drawing))) {
          return true;
        }
      }

      return false;
    });

    // For now assume not.
    this._state = anyUpdatesNeeded ? new DelayedState(this) : new IdleState(this);

    const rmGeomListener = args.iModel.txns.onModelGeometryChanged.addListener((changes) => this.onGeometryChanged(changes));
    const rmCloseListener = args.iModel.onBeforeClose.addListener(() => this.terminate());
    this._removeEventListeners = () => {
      rmGeomListener();
      rmCloseListener();
    };
  }

  public getUpdates(): Promise<SectionDrawingUpdate[]> {
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
    return new Promise<SectionDrawingUpdate[]>((resolve) => {
      this.awaitUpdates(resolve);
    });
  }

  public terminate(): void {
    this.state = new TerminatedState(this);

    this._removeEventListeners();
    this._removeEventListeners = () => undefined;
  }

  public cacheUpdates(updates: SectionDrawingUpdate[] | undefined): DrawingMonitorState {
    return new CachedState(this, updates ?? [], this._awaitingUpdates);
  }

  private awaitUpdates(resolve: (updates: SectionDrawingUpdate[]) => void): void {
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

  private onGeometryChanged(changes: ReadonlyArray<ModelIdAndGeometryGuid>): void {
    // Consider changing this to instead do the whole thing as a single ECSql statement.
    // The only annoying part is the model selector's Ids are stored on the relationship instead of the element.
    const ecsql = `
      SELECT ModelSelector.Id FROM bis.SpatialViewDefinition WHERE ECInstanceId IN (
        SELECT SpatialView.Id FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL
      )
    `;

    this.iModel.withPreparedStatement(ecsql, (stmt) => {
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const selector = this.iModel.elements.getElement<ModelSelector>(stmt.getValue(0).getId());
        for (const change of changes) {
          if (selector.models.includes(change.id)) {
            this.state = this._state.onChangeDetected();
            return;
          }
        }
      }
    });
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

  public constructor(monitor: SectionDrawingMonitorImpl, private readonly _updates: SectionDrawingUpdate[], private readonly _ignoreDelayOnChange: boolean) {
    super(monitor);
  }

  public override getCachedUpdates() {
    return this._updates;
  }

  public override onChangeDetected() {
    // Our cached results are no longer relevant.
    return this._ignoreDelayOnChange ? this.requestUpdates() : new DelayedState(this.monitor);
  }

  public override onUpdatesRequested() {
    // Updates are available.
    return this;
  }
}

class DelayedState extends DrawingMonitorState {
  public get name() { return "Delayed" as const; }

  public constructor(monitor: SectionDrawingMonitorImpl) {
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

  public constructor(monitor: SectionDrawingMonitorImpl, private readonly _promise: Promise<SectionDrawingUpdate[]>) {
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

export function createSectionDrawingMonitor(args: SectionDrawingMonitorCreateArgs): SectionDrawingMonitorImpl {
  return new SectionDrawingMonitorImpl(args);
}
