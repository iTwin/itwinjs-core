*** **Work In Progress** ***

# Current Design Overview:
The iTwin.js Editing API is a minimalist framework, intentionally kept so to ensure flexibility.
However, on closer inspection of how the API is being used in OpenSite+, it's clear that this design creates some significant challenges for applications, which they are left to handle by themselves.

The current API provides the basic building blocks but lacks some protective guardrails which leaves the doors open for possible race conditions, data inconsistencies/corruption and general lifecycle management errors to name a few.

# API Drawbacks/Limitations:
Based on how applications like OpenSite+ have used the editing API, we can identify a few gaps where the OS+ developers had to step in and fill those.
Some of them are:

| Limitation | Description |
|----------|----------|
| Transaction locks | There is no protection from external `saveChanges`/`abandonChanges` being called while a command is active.  |
| External Async Commands | A user can externally trigger a command such as `reverseTxns`, `discardChanges`, `pullChanges`, etc. while an edit command is in progress. |
| State machine: | EditCommand has no state tracking. A user can write an edit command with a double commit/an abandon followed by a commit. |
| Auto rollback | If something goes wrong in the command or maybe when committing/abandoning, we don't have a way to rolling back the changes done till that point. |
| Lack of a query mechanism for frontend | The UI has no reliable way to find out which command is running, or to find out if it is safe to save/abandon changes. |
| No enforcement of commit/abandons | A user can write a command that fails to commit/abandon changes at the end of the execution. There is no enforcement of this on EditCommand. |
| Long running async ops | There is minimal support for long running async operations and an increased likelihood of an external save/commit/undo being triggered mid execution. |
| Cancelling commands | No way of cancelling ongoing async operations (significant for long-running commands). |


# New Editing API design:

## Edit Scope

The editing API now implements an [EditScope](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/editor/backend/src/IModelEditCommand.ts#L85), which lies at the heart of the api.
Every edit command contains an edit scope which controls the command's lifecycle.

The EditScope class is responsible for the following:
1. Co-ordinating with other edit scopes to ensure a single command runs at a time.
2. Runs the command's business logic.
3. Ensures the changes get saved/abandoned as per the execution results and command exepectations.

The edit scopes for the various commands being executed are tracked by the [IModelDb class](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/core/backend/src/IModelDb.ts#L267).

## Edit commands:

The commands are broadly classified into two types:
1. Immediate Commands
2. Interactive Commands

### EditCommand Arguments
While these 2 categories are at a broad level, there can be immediate commands which perform wildly different actions.
Each command can be unique and therefore the api should provide a way to implement it atomically while maintaining a loose coupling with the tool or other commands.
Every command needs a certain set of arguments specific to the command's logic to be executed.

The api provides the [EditCommandArgs Interface](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/editor/backend/src/IModelEditCommand.ts#L77) which can be extended to define an interface specific to the command in question.

Example: Consider a simple command to add two numbers. The interface will look something like this:
```
export interface AddCommandArgs extends EditCommandArgs {
  firstNumber: number;
  secondNumber: number;
}
```

Or, maybe a command which inserts a PhysicalElement into the iModel:
```
interface TestElementProps extends PhysicalElementProps {
  intProperty?: number;
  stringProperty?: string;
  doubleProperty?: number;
}

/**
 * Arguments for creating an element
 */
export interface CreateElementArgs extends EditCommandArgs {
  userLabel: string;
  testElementProps: TestElementProps;
}
```

Commands can be written to reuse interfaces as per the need

### Immediate Commands:

Immediate commands execute their assigned tasks *immediately* without further input. They are of a fire-and-forget kind.
The editing API introduces a new abstract class [ImmediateCommand](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/editor/backend/src/IModelEditCommand.ts#L369C17-L369C23) which provides a way for the user to implement Immediate commands.

The user needs to do the following in order to create a new immediate command:
1. Create a subclass of the ImmediateCommand class.
2. Specify the [arguments](#editcommand-arguments) that the command needs to run as well as the expected result type.
3. Override the function [run](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/editor/backend/src/IModelEditCommand.ts#L370) to implement the command specific business logic.
4. Instantiate the command and execute it as per need by calling the execute method.

Example: Consider a simple command to add two numbers:
```
export interface AddCommandArgs extends EditCommandArgs {
  firstNumber: number;
  secondNumber: number;
}

// Simple command that takes two numerical values and adds them
export class AddCommand extends ImmediateCommand<AddCommandArgs, number> {

  // Adds the two input values
  protected async run(args: AddCommandArgs): Promise<number> {
    return args.firstNumber + args.secondNumber;
  }
}

// Execute the command
const sumCommand = new AddCommand(this._iModel);
await sumCommand.execute({ firstNumber: 2, secondNumber: 3, description: "Perform 2 + 3" });
```

The user does not need to worry about the command's scope or whether any other command might interfere during the execution.
The command's edit scope handles those duties.

#### Behind-the-scenes
When the command's execute method is called, it creates an edit scope which gets queued on the IModelDb waiting for its turn.
There is a polling mechanism in the edit scope (placeholder for now, might switch to a more async handler in the future), which checks if it is the active command.
If it is, then the command starts executing.
Any subsequent command coming in will get queued and wait for its turn.
Once the active command is completed, the edit scope will save/abandon the changes, dequeue itself and the next command will become active.
With the current polling mechanism, if a command waits for too long and runs out of retries, it will throw an error and dequeue itself.

### Interactive Commands

Interactive command or *long-spanning* commands are those which do much more than execute just a single task.
The user might start the command, do a number of things while the command is active, and finally end it.
The editing API introduces a new abstract class [InteractiveCommand](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/editor/backend/src/IModelEditCommand.ts#L400) which provides a way for the user to implement Interactive commands.
The interactive command does not provide any `run` function to be overridden. How the command works is entirely up to the user to implement.
The user can add any number of functions to perform the varied tasks an interactive command might entail.
However, in order to make the command scope safe, the user need to invoke these functions through the execute function.

The interactive command logic should be between two calls to startCommandScope() and endCommandScope().
The startCommandScope() creates a new edit scope for the interactive commands and waits to be activated.
The endCommandScope() function wraps up the edit scope and saves/abandons the changes as per the command's expectations.

The user needs to do the following in order to create a new interactive command:
1. Create a subclass of the InteractiveCommand class.
2. Specify the [arguments](#editcommand-arguments) that the command needs to run as well as the expected result type.
3. Implement the functions that the command class needs to execute.
4. The functions which are required to be scope safe should be passed as arguments to the execute function.
5. Use the startCommandScope() and endCommandScope() functions to mark the lifecycle of the interactive command.

Example: Consider an interactive command to create/manipulate a polygon
```
export interface PolygonEditorArgs extends EditCommandArgs {
  modelId: Id64String;
  categoryId: Id64String;
}

export class InteractivePolygonEditor extends InteractiveCommand<PolygonEditorArgs, Id64String[]> {
  private _vertexElementIds: Id64String[] = [];
  private _modelId?: Id64String;
  private _categoryId?: Id64String;

  public async initialize(modelId: Id64String, categoryId: Id64String): Promise<void> {
    this._modelId = modelId;
    this._categoryId = categoryId;
  }

  /**
   * Add multiple vertices at once using nested ImmediateCommands.
   */
  public async addVertices(vertices: Array<{ x: number, y: number }>): Promise<Id64String[]> {
    return this.execute(async () => {
      const elementIds: Id64String[] = [];

      if (!this._modelId || !this._categoryId) {
        throw new Error("PolygonEditor not initialized with modelId and categoryId");
      }

      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const createCmd = new CreateElementCommand(this._iModel);
        const elementId = await createCmd.execute({
          userLabel: `BatchVertex-${i}`,
          testElementProps: {
            classFullName: "TestEditCommand:TestElement",
            model: this._modelId,
            category: this._categoryId,
            code: Code.createEmpty(),
            vertex: `(${vertex.x}, ${vertex.y})`,
          },
        });
        this._vertexElementIds.push(elementId);
        elementIds.push(elementId);
      }

      return elementIds;
    });
  }

  /**
   * Remove the last vertex from the polygon by deleting its element.
   */
  public async removeLastVertex(): Promise<void> {
    if (this._vertexElementIds.length === 0) {
      throw new Error("No vertices to remove");
    }
    const elementId = this._vertexElementIds.pop();
    if (!elementId) {
      throw new Error("Failed to get last vertex element ID");
    }
    this._iModel.elements.deleteElement(elementId);
  }

  /**
   * Move a vertex to a new position by using an immediate command.
   */
  public async moveVertex(index: number, newX: number, newY: number): Promise<Id64String> {
    return this.execute(async () => {
      if (index < 0 || index >= this._vertexElementIds.length) {
        throw new Error("Invalid vertex index");
      }

      const elementId = this._vertexElementIds[index];
      const updateCmd = new UpdateElementCommand(this._iModel);

      const updateArgs: UpdateElementArgs = {
        elementId,
        intProperty: 0,
        doubleProperty: 0,
        vertex: `(${newX}, ${newY})`,
      };

      await updateCmd.execute(updateArgs);
      return elementId;
    });
  }
}

// Example usage of the interactive command:
async function usePolygonEditor(iModel: IModelDb, modelId: Id64String, categoryId: Id64String) {
  const editor = new InteractivePolygonEditor(iModel);

  await editor.startCommandScope();
  try {
    await editor.initialize(modelId, categoryId);

    // Add vertices
    const vertexIds = await editor.addVertices([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]);

    // Move a vertex
    await editor.moveVertex(1, 15, 0);

    // Remove last vertex if needed
    await editor.removeLastVertex();

    await editor.endCommandScope();
  } catch (error) {
    await editor.abandonChanges();
    throw error;
  }
}
```

The functions that are manipulating the iModel in some way (insert/update) require to be scope safe i.e. they should be the only ones interacting with the iModel at that point in time.
The function [execute<T>(operation: () => Promise<T>): Promise<T>](https://github.com/iTwin/itwinjs-core/blob/db59e058d8f528f6ee6ffcd085799131ba8e7071/editor/backend/src/IModelEditCommand.ts#L442) ensures atomicity of the particular funtion logic.
The user can implement helper functions that don't use the execute function to carry out async tasks that don't require iModelDb manipulation.

Only one interactive command can be executed at a time.
While immediate commands will get queued and wait patiently for their turn, an interactive command that comes in while another is executing will throw an error right away.

### Nesting commands

One of the main goals of this redesign was to ensure commands can be written to be loosely coupled, highly defined and reusable.
The api provides this functionality by making commands akin to OOP classes.

Commands can be nested within other commands on multiple levels.

Example: Consider a command to calculate the hypotenuse of a right angled triangle using the Pythagoras theorem.
```
export interface AddCommandArgs extends EditCommandArgs {
  firstNumber: number;
  secondNumber: number;
}

// Simple command that takes two numerical values and adds them
export class AddCommand extends ImmediateCommand<AddCommandArgs, number> {

  // Adds the two input values
  protected async run(args: AddCommandArgs): Promise<number> {
    return args.firstNumber + args.secondNumber;
  }
}

export interface SquareCommandArgs extends EditCommandArgs {
  value: number;
}

// Simple command that takes a numerical value and multiples it by itself
export class SquareCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  protected async run(args: SquareCommandArgs): Promise<number> {
    return args.value * args.value;
  }
}

// This command reuses the arguments from the Square command
export class SquareRootCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  protected async run(args: SquareCommandArgs): Promise<number> {
    return Math.sqrt(args.value);
  }
}

export interface SumOfSquaresArgs extends EditCommandArgs {
  firstNumber: number;
  secondNumber: number;
}

// Simple command that takes a numerical value and multiples it by itself
export class SumOfSquaresCommand extends ImmediateCommand<SumOfSquaresArgs, number> {

  // Multiples the input value by itself
  protected async run(args: SumOfSquaresArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const [sideASquared, sideBSquared] = await Promise.all([
      sideASquareCommand.execute({ value: args.firstNumber, description: "Square first number" }),
      sideBSquareCommand.execute({ value: args.secondNumber, description: "Square second number" })
    ]);

    const sumCommand = new AddCommand(this._iModel);
    return await sumCommand.execute({ firstNumber: sideASquared, secondNumber: sideBSquared, description: "Sum of squares" });
  }
}

export interface PythagorasArgs extends EditCommandArgs {
  sideA: number;
  sideB: number;
}

// Simple command that calculates the hypotenuse of a right triangle
export class PythagorasCommand extends ImmediateCommand<PythagorasArgs, number> {
  // Get square root of given value
  public async simpleSquareRoot(value: number): Promise<number> {
    return Math.sqrt(value);
  }

  // Calculate the hypotenuse using multiple-level nested Commands - Sync
  protected async run(args: PythagorasArgs): Promise<number> {
    const sumOfSquaresCommand = new SumOfSquaresCommand(this._iModel);
    const sumOfSquares = await sumOfSquaresCommand.execute({ firstNumber: args.sideA, secondNumber: args.sideB })

    return await this.simpleSquareRoot(sumOfSquares);
  }
}
```

The example above illustrates multi-level nesting of commands.

The `PythagorasCommand` class has overriden the `run` function to implement the logic to calculate the hypotenuse of the triangle.
The class promises to return a number.

The class uses the `SumOfSquaresCommand` class to get the value for the first step of the theorem.
Internally `SumOfSquaresCommand` uses another class `SquareCommand` to get the squares of the 2 arguments followed by the `AddCommand` to get the final sum.
The `run` function then calls a helper function from it's class to get the square root of the value returned by the nested command calls.

If you note the way `SumOfSquaresCommand` has its logic written, the two calls it makes to get the squares of the two numbers happens asynchronously.
Both the nested command invocations of `SquareCommand` are independent of each other and can be executed in parallel without their edit scopes interfering and causing an unnecessary bottleneck.

While the nested commands do create their own edit scopes, they do not save/abandon their changes. The save/abandon happens at the end of the top-most command's execution.

> Note: The code is set up to not queue nested commands and allow the user to run them async.
My idea was to give the onus to the user to ensure they are running their logic correctly and not executing nested commands in a way that might trigger a race condition.
However, this contradicts the original need to have an edit scope and to bring the responsibilty back into itwinjs-core.
Will have to update the nested command behavior. Serializing all is not optimal and the user might have unrelated commands that are safe to execute in parallel.
Maybe give user different API calls that serialize or parallelize nested commands for the parent command ?
Food for thought...


TODO:

1. Review the polling mechanism used to queue edit scopes. Look into a bit more efficient way to signal when a scope becomes active.
2. It was straightforward with saves, the parent can call save on the whole lot.
But what about abandon?
If a nested command fails, do we abandon just the changes made by the command ?
I think the all or none approach would be better. The parent can abandon the whole command's work.
But what if this command failed, but another nested command succeeded?
Maybe have a way to signal to the calling command to fail right away ?
3. If a command throws, the command scope/lifecycle is not handled/ended properly at the moment.
4. Queueing of nested commands which can cause conficts if called async.
5. Just like saveChanges and abandonChanges, there are other iModel APIs that should not be allowed during an active command
viz discardChanges, reverseTxns, reinstateTxns, pullChanges, pushChanges, revertAndPushChanges, et cetera.
These functions need to be updated and tests must be added for those as well.
6. Look into locking behavior during active edit commands.

> This remains an open design requiring further discussion.