/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb } from "@itwin/core-backend";
import { assert, BeDuration, BeEvent } from "@itwin/core-bentley";
import { ModelIdAndGeometryGuid } from "@itwin/core-common";

export interface DrawingChanges {
  whatever: any;
}

export interface DrawingMonitor {
  getChanges(): Promise<DrawingChanges>;
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

  public getCachedChanges(): DrawingChanges | undefined {
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
  public delay: number;
  public readonly iModel: BriefcaseDb;
  public readonly onStateChanged = new BeEvent<() => void>();
  private _state: DrawingMonitorState;
  private _removeEventListeners: () => void;

  public get state() {
    return this._state;
  }

  public set state(newState: DrawingMonitorState) {
    if (newState !== this._state) {
      this._state = newState;
      this.onStateChanged.raiseEvent();
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

  public getChanges(): Promise<DrawingChanges> {
    this.state = this._state.onResultsRequested();
    const changes = this._state.getCachedChanges();
    if (changes) {
      return Promise.resolve(changes);
    }

    return new Promise<DrawingChanges>((resolve) => {
      this.awaitChanges(resolve);
    });
  }

  public terminate(): void {
    this._state.onTerminate();
    this.state = new TerminatedState(this);

    this._removeEventListeners();
    this._removeEventListeners = () => undefined;
  }

  private awaitChanges(resolve: (changes: DrawingChanges) => void): void {
    this.onStateChanged.addOnce(() => {
      const changes = this._state.getCachedChanges();
      if (changes) {
        resolve(changes);
      }

      this.awaitChanges(resolve);
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

  public constructor(monitor: DrawingMonitorImpl, private readonly _changes: DrawingChanges) {
    super(monitor);
  }

  public override getCachedChanges() {
    return this._changes;
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
    monitor.onStateChanged.addOnce(() => this._delay = undefined);
    this._delay = BeDuration.wait(monitor.delay).then(() => {
      if (this._delay) {
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
