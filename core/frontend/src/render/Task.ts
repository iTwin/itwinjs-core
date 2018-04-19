/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Target } from "./System";
import { StopWatch } from "@bentley/bentleyjs-core";
import { Decorations } from "@bentley/imodeljs-common";

/** The rendering operation a task performs. */
export const enum Operation {
  ChangeDecorations,
  ChangeDynamics,
  ChangeRenderPlan,
  ChangeScene,
  DefineGeometryTexture,
  DestroyTarget,
  Idle,
  Initialize, // Invoked synchronously; return non-zero if initialization failed.
  OnResized,
  OverrideFeatureSymbology,
  ReadImage,
  ReadPixels,
  Redraw,
  RenderFrame,
  RenderTile,
  ResetTarget,
  SetFlash,
  SetHiliteSet,
}

/** The outcome of the processing of a Task. */
export const enum Outcome {
  Waiting,   // in queue, pending
  Abandoned, // replaced while pending
  Started,   // currently processing
  Aborted,   // aborted during processing
  Finished,  // successfully finished processing
}

export class Priority {
  constructor(public value: number) { }
  public increment(): void { this.value++; }
  public static highest(): Priority { return new Priority(0); }
  public static lowest(): Priority { return new Priority(0xffff); } // Reserved for the 'idle' task
}

/** A rendering task to be performed on the render thread. */
export abstract class Task {
  constructor(public priority: Priority,
    public operation: Operation,
    public target: Target,
    public outcome: Outcome = Outcome.Waiting,
    public elapsedTime: number = 0) { }

  public perform(timer: StopWatch) {
    this.outcome = Outcome.Started;
    timer.start();
    this.outcome = this.process(timer);
  }

  /**
   * Perform the rendering task.
   * @return the Outcome of the processing of the Task.
   */
  public abstract process(timer: StopWatch): Outcome;

  /** return true if this task changes the scene. */
  public abstract definesScene(): boolean;

  /** called when this task is entered into the render queue */
  public abstract onQueued(): void;

  /**
   * Determine whether this Task can replace a pending entry in the Queue.
   * @param other a pending task for the same Render::Target
   * @return true if this Task should replace the other pending task.
   */
  public replaces(other: Task): boolean { return this.operation === other.operation; }
}

export abstract class SceneTask extends Task {
  constructor(priority: Priority, operation: Operation, target: Target, outcome?: Outcome, elapsedTime?: number) { super(priority, operation, target, outcome, elapsedTime); }
  public definesScene(): boolean { return true; }
  public replaces(other: Task): boolean { return super.replaces(other) || !other.definesScene(); }
  public onQueued(): void { }
}

export class ChangeDecorationsTask extends SceneTask {
  constructor(priority: Priority, target: Target, public decorations: Decorations = new Decorations()) { super(priority, Operation.ChangeDecorations, target); }
  public process(_timer: StopWatch): Outcome { this.target.changeDecorations(this.decorations); return Outcome.Finished; }
}
