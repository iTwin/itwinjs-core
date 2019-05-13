/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WorkflowTask */

import { ItemDefBase } from "../shared/ItemDefBase";
import { ItemProps } from "../shared/ItemProps";
import { WorkflowManager } from "./Workflow";
import { FrontstageManager } from "../frontstage/FrontstageManager";

/** Properties for a [[Task]]
 * @public
 */
export interface TaskProps extends ItemProps {
  id: string;
  primaryStageId: string;
}

/** List of Task Properties
 * @public
 */
export interface TaskPropsList {
  tasks: TaskProps[];
}

// -----------------------------------------------------------------------------

/** Task class.
 * A Task is a specific piece of work to accomplish.
 * A Task refers to a Frontstage to activate.
 * @public
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

  public get isActive(): boolean {
    let isActive = false;

    if (WorkflowManager.activeWorkflow && WorkflowManager.activeWorkflow.activeTask === this)
      isActive = true;

    return isActive;
  }

  public set isActive(_: boolean) {
    // do nothing - needed because subclassing from ItemDefBase
  }

  public async onActivated(): Promise<void> {
    const frontstage = FrontstageManager.findFrontstageDef(this.primaryStageId);
    if (frontstage)
      await FrontstageManager.setActiveFrontstageDef(frontstage);
  }
}

// -----------------------------------------------------------------------------

/** Task Manager class.
 * @public
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
