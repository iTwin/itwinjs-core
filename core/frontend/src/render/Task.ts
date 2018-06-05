/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Render */

import { Decorations, RenderTarget, RenderSystem } from "./System";
import { StopWatch } from "@bentley/bentleyjs-core";
import { ViewState } from "../ViewState";
import { HilitedSet } from "../SelectionSet";
import { FeatureSymbology } from "./FeatureSymbology";

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
  private _target?: RenderTarget;

  public readonly operation: TaskOperation;
  public readonly priority: TaskPriority;

  public outcome: TaskOutcome = TaskOutcome.Waiting;
  public elapsedTime: number = 0;

  public get target(): RenderTarget { return this._target!; }
  public get definesScene(): boolean { return !!this._target; }

  constructor(operation: TaskOperation, priority: TaskPriority, target?: RenderTarget) {
    this._target = target;
    this.operation = operation;
    this.priority = priority;
  }

  public perform(timer: StopWatch) {
    this.outcome = TaskOutcome.Started;
    timer.start();
    this.outcome = this.process(timer);
  }

  /** called when this task is entered into the render queue */
  public onQueued(): void { }

  /**
   * Determine whether this Task can replace a pending entry in the Queue.
   * @param other a pending task for the same Render::Target
   * @return true if this Task should replace the other pending task.
   */
  public replaces(other: Task): boolean { return this.operation === other.operation; }

  /**
   * Perform the rendering task.
   * @return the Outcome of the processing of the Task.
   */
  public abstract process(timer: StopWatch): TaskOutcome;

  /**
   * Get the name of this task. For debugging only
   * using abstract method instead of getter to enforce inherited classes to defined their name explicitly
   */
  public abstract getName(): string;
}

/**
 * Base class for all tasks that change the scene
 * instead of overriding an abstract method called definesScene, since the RenderTarget is undefined for NonSceneTasks,
 * we can instead use the nullable state of the RenderTarget to implicitly determine if the scene is defined
 */
export abstract class SceneTask extends Task {
  constructor(target: RenderTarget, operation: TaskOperation, priority: TaskPriority) { super(operation, priority, target); }

  public replaces(other: Task): boolean { return super.replaces(other) || !other.definesScene; }
}

/**
 * Base class for tasks that don't change the scene
 * instead of overriding an abstract method called definesScene, since the RenderTarget is undefined for NonSceneTasks,
 * we can instead use the nullable state of the RenderTarget to implicitly determine if the scene is defined
 */
export abstract class NonSceneTask extends Task {
  constructor(operation: TaskOperation, priority: TaskPriority) { super(operation, priority, undefined); }
}

export class ChangeDecorationsTask extends SceneTask {
  public readonly decorations: Decorations = new Decorations();

  constructor(target: RenderTarget, priority: TaskPriority) { super(target, TaskOperation.ChangeDecorations, priority); }

  public getName(): string { return "Change decorations"; }

  public process(_timer: StopWatch): TaskOutcome { this.target.changeDecorations(this.decorations); return TaskOutcome.Finished; }
}

export class IdleTask extends NonSceneTask {
  public readonly system: RenderSystem;

  constructor(system: RenderSystem) {
    super(TaskOperation.Idle, TaskPriority.lowest());
    this.system = system;
  }

  public getName(): string { return "IdleRender"; }

  public process(_timer: StopWatch): TaskOutcome { this.system.idle(); return TaskOutcome.Finished; }
}

export class SetHiliteTask extends SceneTask {
  public readonly view: ViewState;
  public readonly hilited: HilitedSet;

  constructor(target: RenderTarget, priority: TaskPriority, view: ViewState) {
    super(target, TaskOperation.SetHiliteSet, priority);
    this.view = view;
    this.hilited = view.iModel.hilited;
  }

  public getName(): string { return "Set Hilite"; }

  public process(_timer: StopWatch): TaskOutcome { this.target.setHiliteSet(this.hilited); return TaskOutcome.Finished; }
}

export class OverrideFeatureSymbologyTask extends SceneTask {
  public readonly overrides: FeatureSymbology.Overrides;

  constructor(target: RenderTarget, priority: TaskPriority, view: ViewState) {
    super(target, TaskOperation.OverrideFeatureSymbology, priority);
    this.overrides = new FeatureSymbology.Overrides(view);
  }

  public getName(): string { return "Override Feature Symbology"; }

  public process(_timer: StopWatch): TaskOutcome { this.target.overrideFeatureSymbology(this.overrides); return TaskOutcome.Finished; }
}

/**
 * The Render::Queue is accessed through DgnViewport::RenderQueue(). It holds an array of Render::Tasks waiting
 * to to be processed on the render thread. Render::Tasks may be added to the Render::Queue only
 * on the main (work) thread, and may only be processed on the Render thread.
 */
export class RenderQueue {
  private _tasks: Task[];
  private _currTask?: Task;
  public get tasks(): Task[] { return this._tasks; }

  /**
   * @return true if the render queue is empty and no pending tasks are active.
   * @note This method may only be called from the main thread
   */
  public get isIdle(): boolean { return this._tasks.length === 0 && !this._currTask; }

  constructor(tasks: Task[] = []) { this._tasks = tasks; }

  public onInitialized(): void { }

  /**
   * Add a Render::Task to the render queue. The Task will replace any existing pending entries in the Queue
   * for the same Render::Target for which task._CanReplace(existing) returns true.
   * task The Render::Task to add to the queue.
   * [WIP]
   */
  public addTask(task: Task): void {
    this._tasks = this._tasks
      .map((t: Task) => {
        if (t.operation === TaskOperation.Idle || (task.target === t.target && task.replaces(t))) t.outcome = TaskOutcome.Abandoned;
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
  public waitForIdle(): void { }

  /**
   * Add a task to the Queue and wait for it (and all previously queued Tasks) to complete.
   * task The Render::Task to add to the queue.
   * @note This method may only be called from the main thread and will wait indefinitely for the existing render tasks to complete
   * [WIP]
   */
  public addAndWait(task: Task): void { this.addTask(task); this.waitForIdle(); }
}
