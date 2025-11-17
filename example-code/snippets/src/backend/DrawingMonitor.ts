/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb } from "@itwin/core-backend";
import { assert, BeDuration, BeEvent, Id64String } from "@itwin/core-bentley";
import { ModelIdAndGeometryGuid } from "@itwin/core-common";

export type DrawingUpdates = Map<Id64String, string>;

export interface DrawingMonitor {
  getUpdates(): Promise<DrawingUpdates>;
  terminate(): void;
}

export interface DrawingMonitorCreateArgs {
  iModel: BriefcaseDb;
  delay: number;
}

export function createDrawingMonitor(args: DrawingMonitorCreateArgs): DrawingMonitor {
  return new DrawingMonitorImpl(args);
}

abstract class DrawingMonitorState {
  public abstract get name(): "Idle" | "Cached" | "Delayed" | "Requested" | "Terminated";

  public constructor(protected readonly monitor: DrawingMonitorImpl) { }

  public getCachedUpdates(): DrawingUpdates | undefined {
    return undefined;
  }

  public onChangeDetected(): DrawingMonitorState {
    this.assertBadTransition("change detected");
    return this;
  }

  public onResultsRequested(): DrawingMonitorState {
    this.assertBadTransition("results requested");
    return this;
  }

  public onTerminate(): void {

  }

  private assertBadTransition(eventName: string): void {
    assert(false, `No transition from DrawingMonitor state ${this.name} on ${eventName}`);
  }
}

class DrawingMonitorImpl implements DrawingMonitor {
  public readonly delay: number;
  public readonly iModel: BriefcaseDb;
  private readonly _onStateChanged = new BeEvent<() => void>();
  private _state: DrawingMonitorState;
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
    this.delay = args.delay;
    this.iModel = args.iModel;

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
    this.state = this._state.onResultsRequested();
    const updates = this._state.getCachedUpdates();
    if (updates) {
      return Promise.resolve(updates);
    }

    return new Promise<DrawingUpdates>((resolve) => {
      this.awaitUpdates(resolve);
    });
  }

  public terminate(): void {
    this._state.onTerminate();
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
  public get name(): "Idle" { return "Idle"; }

  public override onChangeDetected() {
    // ###TODO transition to DelayedState if delay > 0 else do onResultsRequested
    return this;
  }

  public override onResultsRequested() {
    // ###TODO transition to RequestedState, or CachedState if request (and therefore results) would be empty.
    return this;
  }
}

class CachedState extends DrawingMonitorState {
  public get name(): "Cached" { return "Cached"; }

  public constructor(monitor: DrawingMonitorImpl, private readonly _updates: DrawingUpdates) {
    super(monitor);
  }

  public override getCachedUpdates() {
    return this._updates;
  }

  public override onChangeDetected() {
    // ###TODO same as IdleState
    return this;
  }

  public override onResultsRequested() {
    // Results are available.
    return this;
  }
}

class DelayedState extends DrawingMonitorState {
  private _delay: Promise<void> | undefined;
  public get name(): "Delayed" { return "Delayed"; }

  public constructor(monitor: DrawingMonitorImpl) {
    super(monitor);

    this._delay = BeDuration.wait(monitor.delay).then(() => {
      if (this.monitor.state === this) {
        // ###TODO transition to requested state
      }
    });
  }

  public override onResultsRequested(): DrawingMonitorState {
    this._delay = undefined;
    // ###TODO same as IdleState
    return this;
  }
}

class TerminatedState extends DrawingMonitorState {
  public get name(): "Terminated" { return "Terminated"; }

  public override onResultsRequested(): DrawingMonitorState {
    throw new Error("Accessing a terminated DrawingMonitor");
  }
}
