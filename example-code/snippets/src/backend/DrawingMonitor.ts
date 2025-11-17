/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb } from "@itwin/core-backend";
import { assert, BeEvent } from "@itwin/core-bentley";

export interface DrawingChanges {
  whatever: any;
}

export interface DrawingMonitor {
  getChanges(): Promise<DrawingChanges>;
  terminate(): void;
}

export interface DrawingMonitorCreateArgs {
  iModel: IModelDb;
  delay(): Promise<void>;
}

export function createDrawingMonitor(args: DrawingMonitorCreateArgs): DrawingMonitor {
  return new DrawingMonitorImpl(args);
}

abstract class DrawingMonitorState {
  public abstract get name(): "Idle" | "Cached" | "Requested" | "Terminated";

  public getCachedChanges(): DrawingChanges | undefined {
    return undefined;
  }

  public onTimerExpired(): DrawingMonitorState {
    this.assertBadTransition("timer expired");
    return this;
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
  private readonly _args: DrawingMonitorCreateArgs;
  private _state: DrawingMonitorState;
  private _onStateChanged = new BeEvent<() => void>();

  public constructor(args: DrawingMonitorCreateArgs) {
    this._args = { ...args };

    // ###TODO check if any drawings need regeneration.
    this._state = new IdleState(this._args);

    // ###TODO register event listeners for iModel close and geometry changes.
  }

  public getChanges(): Promise<DrawingChanges> {
    this.transition(this._state.onResultsRequested());
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
    this.transition(TerminatedState.instance);
  }

  private transition(newState: DrawingMonitorState): void {
    if (newState !== this._state) {
      this._state = newState;
      this._onStateChanged.raiseEvent();
    }
  }

  private awaitChanges(resolve: (changes: DrawingChanges) => void): void {
    this._onStateChanged.addOnce(() => {
      const changes = this._state.getCachedChanges();
      if (changes) {
        resolve(changes);
      }

      this.awaitChanges(resolve);
    });
  }
}

class IdleState extends DrawingMonitorState {
  public get name(): "Idle" { return "Idle"; }

  public constructor(private readonly _args: DrawingMonitorCreateArgs) {
    super();
  }

  public override onChangeDetected() {
    // ###TODO
    return this;
  }

  public override onResultsRequested() {
    // ###TODO
    return this;
  }
}

class TerminatedState extends DrawingMonitorState {
  private static _instance?: TerminatedState;

  public static get instance(): DrawingMonitorState {
    return this._instance ?? (this._instance = new TerminatedState());
  }

  public get name(): "Terminated" { return "Terminated"; }

  public override onResultsRequested(): DrawingMonitorState {
    throw new Error("Accessing a terminated DrawingMonitor");
  }
}
