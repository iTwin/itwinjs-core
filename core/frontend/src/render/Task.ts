/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RenderTarget } from "./System";
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
    public target: RenderTarget,
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
  constructor(priority: Priority, operation: Operation, target: RenderTarget, outcome?: Outcome, elapsedTime?: number) { super(priority, operation, target, outcome, elapsedTime); }
  public definesScene(): boolean { return true; }
  public replaces(other: Task): boolean { return super.replaces(other) || !other.definesScene(); }
  public onQueued(): void { }
}

export class ChangeDecorationsTask extends SceneTask {
  constructor(priority: Priority, target: RenderTarget, public decorations: Decorations = new Decorations()) { super(priority, Operation.ChangeDecorations, target); }
  public process(_timer: StopWatch): Outcome { this.target.changeDecorations(this.decorations); return Outcome.Finished; }
}

/**
 * The Render::Queue is accessed through DgnViewport::RenderQueue(). It holds an array of Render::Tasks waiting
 * to to be processed on the render thread. Render::Tasks may be added to the Render::Queue only
 * on the main (work) thread, and may only be processed on the Render thread.
 */
export class RenderQueue {
  private _tasks: Task[] = [];

  public get tasks(): Task[] { return this._tasks; }

  constructor(tasks?: Task[]) { if (!!tasks) this._tasks = tasks; }

  /**
   * Add a Render::Task to the render queue. The Task will replace any existing pending entries in the Queue
   * for the same Render::Target for which task._CanReplace(existing) returns true.
   * task The Render::Task to add to the queue.
   * [WIP]
   */
  public addTask(task: Task): void {
    this._tasks = this._tasks
                    .map((t: Task) => {
                      if (t.operation === Operation.Idle || (task.target === t.target && task.replaces(t)))  t.outcome = Outcome.Abandoned;
                      return t;
                    })
                    .filter((t: Task) => t.outcome !== Outcome.Abandoned);
    this._tasks.push(task);
    this._tasks.sort((a: Task, b: Task) => a.priority.value - b.priority.value);
  }

  /**
   * Wait for all Tasks in the Queue to be processed.
   * @note This method may only be called from the main thread and will wait indefinitely for the existing render tasks to complete
   * [WIP]
   */
  public waitForIdle(): void {}

  /**
   * Add a task to the Queue and wait for it (and all previously queued Tasks) to complete.
   * task The Render::Task to add to the queue.
   * @note This method may only be called from the main thread and will wait indefinitely for the existing render tasks to complete
   * [WIP]
   */
  public addAndWait(task: Task): void { this.addTask(task); this.waitForIdle(); }

}
