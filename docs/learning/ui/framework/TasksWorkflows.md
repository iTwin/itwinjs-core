# Workflows and Tasks

A **Workflow** is a defined sequence of tasks used to accomplish a goal.
A **Task** is a specific piece of work to accomplish.
A Task specifies a **Frontstage** to activate.

## Defining a Task List

The following shows how to define a couple of Tasks and load them into the TaskManager.
Each task references a Frontstage by an Id that has been registered with the FrontstageManager.
When the Task is launched or activated, the Frontstage is also activated.

```ts
const taskPropsList: TaskPropsList = {
  tasks: [
    {
      id: "Task1",
      primaryStageId: "Test1",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:backstage.task1",
    },
    {
      id: "Task2",
      primaryStageId: "Test2",
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:backstage.task2",
    },
  ],
};

ConfigurableUiManager.loadTasks(taskPropsList);
```

## Defining a Workflow

The following shows how to define a Workflow and load it into the WorkflowManager. It references tasks `Task1` and `Task2` defined above.

```ts
const workflowProps: WorkflowProps = {
  id: "ExampleWorkflow",
  iconSpec: "icon-placeholder",
  labelKey: "SampleApp:Test.my-label",
  defaultTaskId: "task1",
  tasks: ["Task1", "Task2"],
};

ConfigurableUiManager.loadWorkflow(workflowProps);
```

## Launching a Task from the Backstage

A Task can be launched from the Backstage using the **TaskLaunchBackstageItem** Backstage item.

```tsx
<TaskLaunchBackstageItem workflowId="ExampleWorkflow" taskId="Task1"
  labelKey="SampleApp:backstage.viewIModelTask" descriptionKey="SampleApp:backstage.iModelStage"
  iconSpec="icon-placeholder" />
```

## Setting a Workflow and Task active programmatically

A Task can be set active programmatically using `WorkflowManager.setActiveWorkflowAndTask`.

```ts
const workflow = WorkflowManager.findWorkflow("ExampleWorkflow");
if (workflow) {
  const task = workflow.getTask("Task1");
  if (task) {
    await WorkflowManager.setActiveWorkflowAndTask(workflow, task);
  }
}
```

## API Reference

<!--- - [ Workflows and Tasks ]( $appui-react:WorkflowTask ) -->
