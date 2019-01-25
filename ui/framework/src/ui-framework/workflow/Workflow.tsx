/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WorkflowTask */

import { UiEvent } from "@bentley/ui-core";

import { ItemDefBase } from "../shared/ItemDefBase";
import { ItemProps } from "../shared/ItemProps";
import { Task, TaskManager } from "./Task";

// -----------------------------------------------------------------------------
//  WorkflowDef and WorkflowsDef
// -----------------------------------------------------------------------------

/** Properties for a [[Workflow]].
 */
export interface WorkflowProps extends ItemProps {
  id: string;
  defaultTaskId: string;
  tasks: string[];
  isDefault?: boolean;
}

/** Workflow Properties List definition.
 */
export interface WorkflowPropsList {
  defaultWorkflowId: string;
  workflows: WorkflowProps[];
}

// -----------------------------------------------------------------------------
// Workflow class
// -----------------------------------------------------------------------------

/** Workflow class.
 */
export class Workflow extends ItemDefBase {
  /** Id of the Workflow */
  public workflowId: string;
  /** Default Task Id */
  public defaultTaskId: string;
  /** Active Task Id */
  public activeTaskId: string | null = null;
  /** Indicates whether this Workflow is the default */
  public isDefault: boolean;

  private _taskIds: string[];
  private _tasks: Map<string, Task> = new Map<string, Task>();

  constructor(workflowDef: WorkflowProps) {
    super(workflowDef);

    this.workflowId = workflowDef.id;
    this.defaultTaskId = workflowDef.defaultTaskId;
    this._taskIds = workflowDef.tasks;
    this.isDefault = (workflowDef.isDefault !== undefined) ? workflowDef.isDefault : true;

    this._taskIds.map((taskId: string, _index: number) => {
      const task = TaskManager.findTask(taskId);
      if (task)
        this._tasks.set(taskId, task);
    });
  }

  /** Gets the Id of the Workflow. */
  public get id(): string {
    return this.workflowId;
  }

  /** Gets the active Task. */
  public get activeTask(): Task | undefined {
    if (!this.activeTaskId)
      return undefined;

    return this._tasks.get(this.activeTaskId);
  }

  /** Gets a Task with a given Id.
   * @param taskId Id of the Task to get
   */
  public getTask(taskId: string): Task | undefined {
    return this._tasks.get(taskId);
  }

  /** Gets the last active Task. If no Task is active, it returns the default Task.
   */
  public get lastActiveTask(): Task | undefined {
    if (!this.activeTaskId) {
      return this.getTask(this.defaultTaskId);
    }

    return this.getTask(this.activeTaskId);
  }

  /** Determines if the Workflow is active.
   */
  public get isActive(): boolean {
    let isActive = false;

    if (WorkflowManager.activeWorkflow === this)
      isActive = true;

    return isActive;
  }

  public set isActive(_: boolean) {
    // do nothing - needed because subclassing from ItemDefBase
  }

  /** Sets a Task as active.
   * @param task  The Task to set as active
   */
  public setActiveTask(task: Task) {
    this.activeTaskId = task.taskId;
    task.onActivated(); // tslint:disable-line:no-floating-promises
    WorkflowManager.onTaskActivatedEvent.emit({ task, taskId: task.id });
  }

  /** Gets an array of sorted Tasks in the Workflow. */
  public getSortedTasks(): Task[] {
    const sortedTasks = new Array<Task>();

    for (const key of this._tasks.keys()) {
      const task: Task | undefined = this._tasks.get(key);
      if (task && task.isVisible)
        sortedTasks.push(task);
    }

    sortedTasks.sort((a: Task, b: Task) => {
      return a.label.localeCompare(b.label);
    });

    return sortedTasks;
  }

}

/** Workflow Activated Event Args class.
 */
export interface WorkflowActivatedEventArgs {
  workflowId: string;
  workflow: Workflow;
}

/** Workflow Activated Event class.
 */
export class WorkflowActivatedEvent extends UiEvent<WorkflowActivatedEventArgs> { }

/** Task Activated Event Args class.
 */
export interface TaskActivatedEventArgs {
  taskId: string;
  task: Task;
}

/** Task Activated Event class.
 */
export class TaskActivatedEvent extends UiEvent<TaskActivatedEventArgs> { }

// -----------------------------------------------------------------------------
// WorkflowManager class
// -----------------------------------------------------------------------------

/** Workflow Manager class.
 */
export class WorkflowManager {
  private static _workflows: Map<string, Workflow> = new Map<string, Workflow>();
  private static _activeWorkflow: Workflow;
  private static _defaultWorkflowId: string;

  /** Get Workflow Activated event. */
  public static readonly onWorkflowActivatedEvent = new WorkflowActivatedEvent();
  /** Get Task Activated event. */
  public static readonly onTaskActivatedEvent = new TaskActivatedEvent();

  /** Loads one or more Workflows.
   * @param workflowPropsList  the list of Workflows to load
   */
  public static loadWorkflows(workflowPropsList: WorkflowPropsList) {
    this._defaultWorkflowId = workflowPropsList.defaultWorkflowId;
    WorkflowManager.loadWorkflowDefs(workflowPropsList.workflows);
  }

  private static loadWorkflowDefs(workflowDefs: WorkflowProps[]) {
    workflowDefs.map((workflowProps: WorkflowProps) => {
      WorkflowManager.loadWorkflow(workflowProps);
    });
  }

  /** Loads a Workflow.
   * @param workflowProps  Properties of the Workflow to load
   */
  public static loadWorkflow(workflowProps: WorkflowProps) {
    const workflow = new Workflow(workflowProps);
    WorkflowManager.addWorkflow(workflowProps.id, workflow);
  }

  /** Adds a Workflow.
   * @param workflowId  Id of the Workflow to add
   * @param workflow    The Workflow to add
   */
  public static addWorkflow(workflowId: string, workflow: Workflow) {
    this._workflows.set(workflowId, workflow);
  }

  /** Finds a Workflow with a given Id.
   * @param workflowId  Id of the Workflow to find
   * @returns The Workflow if found, or undefined if not found
   */
  public static findWorkflow(workflowId: string): Workflow | undefined {
    return this._workflows.get(workflowId);
  }

  /** Sets the active Workflow
   * @param workflow  The Workflow to set as active
   */
  public static setActiveWorkflow(workflow: Workflow): void {
    this._activeWorkflow = workflow;
    WorkflowManager.onWorkflowActivatedEvent.emit({ workflow, workflowId: workflow.id });
  }

  /** Sets the active Workflow and Task
   * @param workflow  The Workflow to set as active
   * @param task      The Task to set as active
   */
  public static async setActiveWorkflowAndTask(workflow: Workflow, task: Task): Promise<void> {
    if (!workflow.isActive)
      this.setActiveWorkflow(workflow);

    if (!task.isActive)
      workflow.setActiveTask(task);
  }

  /** Gets the active Workflow */
  public static get activeWorkflow(): Workflow {
    return this._activeWorkflow;
  }

  /** Gets the Id of the default Workflow */
  public static get defaultWorkflowId(): string {
    return this._defaultWorkflowId;
  }

  public static getSortedWorkflows(): Workflow[] {
    const sortedWorkflows = new Array<Workflow>();

    for (const key of this._workflows.keys()) {
      const workflow = this._workflows.get(key);
      // istanbul ignore else
      if (workflow) {
        sortedWorkflows.push(workflow);
      }
    }

    sortedWorkflows.sort((a: Workflow, b: Workflow) => {
      return a.label.localeCompare(b.label);
    });

    return sortedWorkflows;
  }
}
