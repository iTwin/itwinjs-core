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

/** NOTE: This file contains the private, internal implementation of the public SectionDrawingMonitor API. Do not use it directly. */

/** Possible states for the monitor.
 * Idle = no changes detected - no drawings need regeneration. Actively monitoring.
 * Cached = updates have been calculated are have not been subsequently invalidated by further changes to the iModel.
 * Delayed = a change was detected; updates will be calculated after the delay expires, or the user requests them.
 * Requested = the user invoked [[SectionDrawingMonitor.getUpdates]] and calculation of the results has not yet finished.
 * Terminated = the user invoked [[SectionDrawingMonitor.terminate]]. No longer actively monitoring.
 * @internal
 */
type StateName = "Idle" | "Cached" | "Delayed" | "Requested" | "Terminated";

/** The monitor's behavior is driven by various asynchronous events. Rather than try to have one monolithic object
 * keep track of all of the variables influencing its behavior, it is simpler to model it using discrete states.
 * The monitor transitions between states in response to these events.
 * @internal
 */
abstract class DrawingMonitorState {
  public abstract get name(): StateName;

  public constructor(protected readonly monitor: SectionDrawingMonitorImpl) { }

  public getCachedUpdates(): SectionDrawingUpdate[] | undefined {
    return undefined;
  }

  /** Invoked when a change requiring regeneration of one or more SectionDrawings is detected. */
  public onChangeDetected(): DrawingMonitorState {
    this.assertBadTransition("change detected");
    return this;
  }

  /** Invoked when the user requests the latest updates via [[SectionDrawingMonitor.getUpdates]]. */
  public onUpdatesRequested(): DrawingMonitorState {
    this.assertBadTransition("updates requested");
    return this;
  }

  /** Invoked when it's time to calculate updates for all drawings that require them. */
  protected requestUpdates(): DrawingMonitorState {
    const ecsql = `SELECT ECInstanceId,SpatialView.Id FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL`;
    const db = this.monitor.iModel;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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

/* This is not part of the public API. For that, see SectionDrawingMonitor.
 * Exported strictly for unit tests.
 * @internal
 */
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
    this.computeUpdates = async (x) => args.computeUpdates(x);

    // If any drawings have missing or outdated provenance, we'll want to schedule an update for them now.
    const ecsql = `SELECT ECInstanceId FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL`;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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

    this._state = anyUpdatesNeeded ? new DelayedState(this) : new IdleState(this);

    const rmGeomListener = args.iModel.txns.onModelGeometryChanged.addListener((changes) => this.onGeometryChanged(changes));
    const rmCloseListener = args.iModel.onBeforeClose.addListener(() => this.terminate());
    this._removeEventListeners = () => {
      rmGeomListener();
      rmCloseListener();
    };
  }

  public async getUpdates(): Promise<SectionDrawingUpdate[]> {
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
    // If any SectionDrawing's spatial view views any of the affected models, we need to regenerate some annotations.
    const ecsql = `
      SELECT ModelSelector.Id FROM bis.SpatialViewDefinition WHERE ECInstanceId IN (
        SELECT SpatialView.Id FROM bis.SectionDrawing WHERE SpatialView IS NOT NULL
      )
    `;

    // eslint-disable-next-line @typescript-eslint/no-deprecated
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
    // Restart the delay, unless the user is already awaiting the results of a call to [[SectionDrawingMonitor.getUpdates]].
    return this._ignoreDelayOnChange ? this.requestUpdates() : new DelayedState(this.monitor);
  }

  public override onUpdatesRequested() {
    // Updates are already available.
    return this;
  }
}

class DelayedState extends DrawingMonitorState {
  public get name() { return "Delayed" as const; }

  public constructor(monitor: SectionDrawingMonitorImpl) {
    super(monitor);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // Skip the delay - start computing the updates immediately.
    return this.requestUpdates();
  }
}

class RequestedState extends DrawingMonitorState {
  public get name() { return "Requested" as const; }

  public constructor(monitor: SectionDrawingMonitorImpl, private readonly _promise: Promise<SectionDrawingUpdate[]>) {
    super(monitor);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._promise.then((updates) => {
      if (this.monitor.state === this) {
        this.monitor.state = this.monitor.cacheUpdates(updates);
      }
    });
  }

  public override onChangeDetected() {
    // Our request in progress is no longer relevant. Make a new request immediately.
    return this.requestUpdates();
  }
}

class TerminatedState extends DrawingMonitorState {
  public get name() { return "Terminated" as const; }

  public override onUpdatesRequested(): DrawingMonitorState {
    throw new Error("Accessing a terminated DrawingMonitor");
  }
}

/** @internal see [[SectionDrawingMonitor.create]]. */
export function createSectionDrawingMonitor(args: SectionDrawingMonitorCreateArgs): SectionDrawingMonitorImpl {
  return new SectionDrawingMonitorImpl(args);
}
