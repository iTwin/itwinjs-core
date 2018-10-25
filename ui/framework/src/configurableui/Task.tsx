/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WorkflowTask */

import ItemDefBase from "./ItemDefBase";
import { ItemProps } from "./ItemProps";
import { WorkflowManager } from "./Workflow";
import { FrontstageManager } from "./FrontstageManager";

// -----------------------------------------------------------------------------
// TaskDef, TasksDef, WorkflowDef and WorkflowsDef
// -----------------------------------------------------------------------------

/** Properties for a [[Task]] */
export interface TaskProps extends ItemProps {
  id: string;
  primaryStageId: string;
}

/** List of Task Properties */
export interface TaskPropsList {
  tasks: TaskProps[];
}

// -----------------------------------------------------------------------------
// Task class
// -----------------------------------------------------------------------------

/** Task class.
 */
export class Task extends ItemDefBase {
  public taskId: string;
  public primaryStageId: string;

  constructor(taskProps: TaskProps) {
    super(taskProps);

    this.taskId = taskProps.id;
    this.primaryStageId = taskProps.primaryStageId;
  }

  public get id(): string {
    return this.taskId;
  }

  public execute(): void {
  }

  public toolbarReactNode(_index: number): React.ReactNode {
    return null;
  }

  public get isActive(): boolean {
    let isActive = false;

    if (WorkflowManager.activeWorkflow && WorkflowManager.activeWorkflow.activeTask === this)
      isActive = true;

    return isActive;
  }

  public async onActivated(): Promise<void> {
    const frontstage = FrontstageManager.findFrontstageDef(this.primaryStageId);
    if (frontstage)
      await FrontstageManager.setActiveFrontstageDef(frontstage);
  }
}

// -----------------------------------------------------------------------------
// TaskManager class
// -----------------------------------------------------------------------------

/** Task Manager class.
 */
export class TaskManager {
  private static _tasks: Map<string, Task> = new Map<string, Task>();

  public static loadTasks(taskListDef: TaskPropsList) {
    this.loadTaskDefs(taskListDef.tasks);
  }

  public static loadTaskDefs(taskDefs: TaskProps[]) {
    taskDefs.map((taskDef, _index) => {
      this.loadTaskDef(taskDef);
    });
  }

  public static loadTaskDef(taskDef: TaskProps) {
    const task = new Task(taskDef);
    this.addTask(taskDef.id, task);
  }

  public static findTask(taskId: string): Task | undefined {
    return this._tasks.get(taskId);
  }

  public static addTask(taskId: string, task: Task) {
    this._tasks.set(taskId, task);
  }
}

// export default WorkflowsDef;
