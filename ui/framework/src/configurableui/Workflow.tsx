/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Workflow */

import { UiEvent } from "@bentley/ui-core";

import { IconLabelProps } from "./IconLabelSupport";
import ItemDefBase from "./ItemDefBase";
import { ItemProps } from "./ItemProps";
import { Task, TaskManager } from "./Task";

// -----------------------------------------------------------------------------
//  WorkflowDef and WorkflowsDef
// -----------------------------------------------------------------------------

/** Properties for a Workflow.
 */
export interface WorkflowProps extends ItemProps {
  id: string;
  defaultTaskId: string;
  tasks: string[];
  isDefault?: boolean;
}

/** Properties for a TaskPicker.
 */
export interface TaskPickerProps extends IconLabelProps {
  classid: string;
}

/** Workflow Properties List definition.
 */
export interface WorkflowPropsList {
  defaultWorkflowId: string;
  taskPicker: TaskPickerProps;
  workflows: WorkflowProps[];
}

// -----------------------------------------------------------------------------
// Workflow class
// -----------------------------------------------------------------------------

/** Workflow class.
 */
export class Workflow extends ItemDefBase {
  public workflowId: string;
  public defaultTaskId: string;
  public activeTaskId: string | null = null;
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
      this._tasks.set(taskId, TaskManager.findTask(taskId));
    });
  }

  public get id(): string {
    return this.workflowId;
  }

  public execute(): void {
  }

  public toolbarReactNode(_index: number): React.ReactNode {
    return null;
  }

  public get activeTask(): Task | undefined {
    if (!this.activeTaskId)
      return undefined;

    return this._tasks.get(this.activeTaskId);
  }

  public getTask(taskId: string): Task | undefined {
    return this._tasks.get(taskId);
  }

  public get lastActiveTask(): Task | undefined {
    if (!this.activeTaskId) {
      return this.getTask(this.defaultTaskId);
    }

    return this.getTask(this.activeTaskId);
  }

  public get isActive(): boolean {
    let isActive = false;

    if (WorkflowManager.activeWorkflow === this)
      isActive = true;

    return isActive;
  }

  public setActiveTask(task: Task) {
    this.activeTaskId = task.taskId;
    task.onActivated();
    WorkflowManager.onTaskActivatedEvent.emit({ task, taskId: task.id });
  }

  public getSortedTasks(_onlyVisible?: boolean): Task[] {
    const sortedTasks = new Array<Task>();

    for (const key in this._tasks) {
      if (this._tasks.hasOwnProperty(key)) {
        const task: Task | undefined = this._tasks.get(key);
        if (task && task.isVisible)
          sortedTasks.push(task);
      }
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
  private static _workflows: { [workflowId: string]: Workflow } = {};
  private static _activeWorkflow: Workflow;
  private static _defaultWorkflowId: string;
  private static _taskPickerDef: TaskPickerProps;
  private static _workflowActivatedEvent: WorkflowActivatedEvent = new WorkflowActivatedEvent();
  private static _taskActivatedEvent: TaskActivatedEvent = new TaskActivatedEvent();

  public static get onWorkflowActivatedEvent(): WorkflowActivatedEvent { return this._workflowActivatedEvent; }
  public static get onTaskActivatedEvent(): TaskActivatedEvent { return this._taskActivatedEvent; }

  public static loadWorkflows(workflowsDef: WorkflowPropsList) {
    this._defaultWorkflowId = workflowsDef.defaultWorkflowId;
    this._taskPickerDef = workflowsDef.taskPicker;
    WorkflowManager.loadWorkflowDefs(workflowsDef.workflows);
  }

  public static loadWorkflowDefs(workflowDefs: WorkflowProps[]) {
    workflowDefs.map((workflowDef, _index) => {
      WorkflowManager.loadWorkflowDef(workflowDef);
    });
  }

  public static loadWorkflowDef(workflowDef: WorkflowProps) {
    const workflow = new Workflow(workflowDef);
    WorkflowManager.addWorkflow(workflowDef.id, workflow);
  }

  public static findWorkflow(workflowId: string): Workflow {
    return this._workflows[workflowId];
  }

  public static addWorkflow(workflowId: string, workflow: Workflow) {
    this._workflows[workflowId] = workflow;
  }

  public static setActiveWorkflow(workflow: Workflow) {
    this._activeWorkflow = workflow;
    WorkflowManager.onWorkflowActivatedEvent.emit({ workflow, workflowId: workflow.id });
  }

  public static setActiveWorkflowAndTask(workflow: Workflow, task: Task) {
    if (!workflow.isActive)
      this.setActiveWorkflow(workflow);

    if (!task.isActive)
      workflow.setActiveTask(task);
  }

  public static get activeWorkflow(): Workflow {
    return this._activeWorkflow;
  }

  public static get defaultWorkflowId(): string {
    return this._defaultWorkflowId;
  }

  public static get taskPickerDef(): TaskPickerProps {
    return this._taskPickerDef;
  }

  public static getSortedWorkflows(): Workflow[] {
    const sortedWorkflows = new Array<Workflow>();

    for (const key in this._workflows) {
      if (this._workflows.hasOwnProperty(key)) {
        sortedWorkflows.push(this._workflows[key]);
      }
    }

    sortedWorkflows.sort((a: Workflow, b: Workflow) => {
      return a.label.localeCompare(b.label);
    });

    return sortedWorkflows;
  }
}

// export default WorkflowsDef;
