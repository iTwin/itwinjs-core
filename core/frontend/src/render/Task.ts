/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RenderTarget } from "./System";
import { StopWatch } from "@bentley/bentleyjs-core";
import { Decorations } from "@bentley/imodeljs-common";

/** The rendering operation a task performs. */
export const enum TaskOperation {
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
export const enum TaskOutcome {
  Waiting,   // in queue, pending
  Abandoned, // replaced while pending
  Started,   // currently processing
  Aborted,   // aborted during processing
  Finished,  // successfully finished processing
}

export class TaskPriority {
  public value: number;
  constructor(value: number = 0) {
    this.value = value;
  }
  /** until we can overload operators for structs in ts, for now increment value and return this object */
  public increment(): TaskPriority { this.value++; return this; }
  public static highest(): TaskPriority { return new TaskPriority(0); }
  public static lowest(): TaskPriority { return new TaskPriority(0xffff); } // Reserved for the 'idle' task
}

/** A rendering task to be performed on the render thread. */
export abstract class Task {
  public readonly target: RenderTarget;
  public readonly operation: TaskOperation;
  public readonly priority: TaskPriority;
  public outcome: TaskOutcome = TaskOutcome.Waiting;
  public elapsedTime: number = 0;
  constructor(target: RenderTarget, operation: TaskOperation, priority: TaskPriority) {
    this.target = target;
    this.operation = operation;
    this.priority = priority;
  }

  public perform(timer: StopWatch) {
    this.outcome = TaskOutcome.Started;
    timer.start();
    this.outcome = this.process(timer);
  }

  /**
   * Perform the rendering task.
   * @return the Outcome of the processing of the Task.
   */
  public abstract process(timer: StopWatch): TaskOutcome;

  /** return true if this task changes the scene. */
  public abstract definesScene(): boolean;

  /** called when this task is entered into the render queue */
  public onQueued(): void { }

  /**
   * Determine whether this Task can replace a pending entry in the Queue.
   * @param other a pending task for the same Render::Target
   * @return true if this Task should replace the other pending task.
   */
  public replaces(other: Task): boolean { return this.operation === other.operation; }
}

/** Base class for all tasks that change the scene */
export abstract class SceneTask extends Task {
  constructor(target: RenderTarget, operation: TaskOperation, priority: TaskPriority) { super(target, operation, priority); }
  public definesScene(): boolean { return true; }
  public replaces(other: Task): boolean { return super.replaces(other) || !other.definesScene(); }
}

/** Base class for tasks that don't change the scene */
export abstract class NonSceneTask extends Task {
  constructor(target: RenderTarget, operation: TaskOperation, priority: TaskPriority) { super(target, operation, priority); }
  public definesScene(): boolean { return false; }
}

export class ChangeDecorationsTask extends SceneTask {
  public readonly decorations: Decorations;
  constructor(target: RenderTarget, priority: TaskPriority, decorations: Decorations = new Decorations()) {
    super(target, TaskOperation.ChangeDecorations, priority);
    this.decorations = decorations;
  }
  public process(_timer: StopWatch): TaskOutcome { this.target.changeDecorations(this.decorations); return TaskOutcome.Finished; }
}

/**
 * The Render::Queue is accessed through DgnViewport::RenderQueue(). It holds an array of Render::Tasks waiting
 * to to be processed on the render thread. Render::Tasks may be added to the Render::Queue only
 * on the main (work) thread, and may only be processed on the Render thread.
 */
export class RenderQueue {
  private _tasks: Task[];

  public get tasks(): Task[] { return this._tasks; }

  constructor(tasks: Task[] = []) { this._tasks = tasks; }

  /**
   * Add a Render::Task to the render queue. The Task will replace any existing pending entries in the Queue
   * for the same Render::Target for which task._CanReplace(existing) returns true.
   * task The Render::Task to add to the queue.
   * [WIP]
   */
  public addTask(task: Task): void {
    this._tasks = this._tasks
                    .map((t: Task) => {
                      if (t.operation === TaskOperation.Idle || (task.target === t.target && task.replaces(t)))  t.outcome = TaskOutcome.Abandoned;
                      return t;
                    })
                    .filter((t: Task) => t.outcome !== TaskOutcome.Abandoned);
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
