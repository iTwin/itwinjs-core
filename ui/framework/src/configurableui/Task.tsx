/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Task */

import ItemDefBase from "./ItemDefBase";
import { ItemProps } from "./ItemProps";
import { WorkflowManager } from "./Workflow";
import { FrontstageManager } from "./FrontstageManager";

// -----------------------------------------------------------------------------
// TaskDef, TasksDef, WorkflowDef and WorkflowsDef
// -----------------------------------------------------------------------------

/** Properties for a Task */
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

  constructor(taskDef: TaskProps) {
    super(taskDef);

    this.taskId = taskDef.id;
    this.primaryStageId = taskDef.primaryStageId;
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

  public onActivated(): void {
    const frontstage = FrontstageManager.findFrontstageDef(this.primaryStageId);
    if (frontstage)
      FrontstageManager.setActiveFrontstageDef(frontstage);
  }
}

// -----------------------------------------------------------------------------
// TaskManager class
// -----------------------------------------------------------------------------

/** Task Manager class.
 */
export class TaskManager {
  private static _tasks: { [taskId: string]: Task } = {};

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

  public static findTask(taskId: string): Task {
    return this._tasks[taskId];
  }

  public static addTask(taskId: string, task: Task) {
    this._tasks[taskId] = task;
  }
}

// export default WorkflowsDef;
