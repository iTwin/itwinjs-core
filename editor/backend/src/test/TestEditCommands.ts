import { EditCommandArgs, ImmediateCommand, InteractiveCommand } from "../IModelEditCommand";
import { Code } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { CreateElementCommand, UpdateElementArgs, UpdateElementCommand } from "./ElementEditCommands";

// This rule was deprecated in ESLint v8.46.0.
/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable no-console */

export interface AddCommandArgs extends EditCommandArgs {
  firstNumber: number;
  secondNumber: number;
}

export interface SquareCommandArgs extends EditCommandArgs {
  value: number;
}

export interface PythagorasArgs extends EditCommandArgs {
  sideA: number;
  sideB: number;
}

export interface SumOfSquaresArgs extends EditCommandArgs {
  firstNumber: number;
  secondNumber: number;
}

// Simple command that takes two numerical values and adds them.
export class AddCommand extends ImmediateCommand<AddCommandArgs, number> {

  // Adds the two input values
  protected async run(args: AddCommandArgs): Promise<number> {
    return args.firstNumber + args.secondNumber;
  }
}

// Simple command that takes a numerical value and multiples it by itself
export class SquareCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  protected async run(args: SquareCommandArgs): Promise<number> {
    return args.value * args.value;
  }
}

// Simple command that takes a numerical value and gets the square.
export class SquareRootCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  protected async run(args: SquareCommandArgs): Promise<number> {
    return Math.sqrt(args.value);
  }
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

export class InteractivePythagorasCommand extends InteractiveCommand<PythagorasArgs, number> {
  private _sideA?: number;
  private _sideB?: number;

  // Simulate accepting user input (e.g., from UI)
  public async acceptInputNumber(): Promise<number> {
    return Math.random() * 100;
  }

  // Set side A of the triangle
  public async setSideA(value: number): Promise<void> {
    this._sideA = value;
  }

  // Set side B of the triangle
  public async setSideB(value: number): Promise<void> {
    this._sideB = value;
  }

  public async getSumOfSquares(): Promise<number> {
    if (this._sideA === undefined || this._sideB === undefined) {
      throw new Error("Both sides must be set before calculating sum of squares");
    }
    return (this._sideA * this._sideA) + (this._sideB * this._sideB);
  }

  public async calcHypotenuse(args: PythagorasArgs): Promise<number> {
    // Set the sides
    await this.setSideA(args.sideA);
    await this.setSideB(args.sideB);

    // Calculate sum of squares
    const sumOfSquares = await this.getSumOfSquares();

    // Calculate hypotenuse
    return Math.sqrt(sumOfSquares);
  }

  public async calcHypotenuseWithNestedCommands(args: PythagorasArgs): Promise<number> {
    return this.execute(async () => {
      // Use immediate commands for square operations
      const squareCommand = new SquareCommand(this._iModel);
      const [sideASquared, sideBSquared] = await Promise.all([
        squareCommand.execute({ value: args.sideA }),
        squareCommand.execute({ value: args.sideB })
      ]);

      const squareRootCommand = new SquareRootCommand(this._iModel);
      const result = await squareRootCommand.execute({ value: sideASquared + sideBSquared });
      return result;
    });
  }
}

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
            intProperty: 0,
            doubleProperty: 0,
            stringProperty: `(${vertex.x}, ${vertex.y})`,
          },
        });

        console.log(`Added vertex ElementId: ${elementId} at position (${vertex.x}, ${vertex.y})`);
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

    console.log(`Removing vertex ElementId: ${this._vertexElementIds[this._vertexElementIds.length - 1]}`);
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
        stringProperty: `(${newX}, ${newY})`,
      };

      console.log(`Moving vertex index ${index} (ElementId: ${elementId}) to new position (${newX}, ${newY})`);
      await updateCmd.execute(updateArgs);
      return elementId;
    });
  }

  /**
   * Update multiple vertices at once.
   * Demonstrates concurrent nested command execution.
   */
  public async updateMultipleVertices(updates: Array<{ index: number, x: number, y: number }>): Promise<Id64String[]> {
    return this.execute(async () => {
      const updatePromises = updates.map(async (update) => {
        if (update.index < 0 || update.index >= this._vertexElementIds.length) {
          throw new Error(`Invalid vertex index: ${update.index}`);
        }

        const elementId = this._vertexElementIds[update.index];
        const updateCmd = new UpdateElementCommand(this._iModel);

        await updateCmd.execute({
          elementId,
          intProperty: 0,
          doubleProperty: 0,
          stringProperty: `(${update.x}, ${update.y})`,
        });

        return elementId;
      });

      return await Promise.all(updatePromises);
    });
  }

  /**
   * Get the count of vertices in the polygon.
   */
  public async getVertexCount(): Promise<number> {
    return this._vertexElementIds.length;
  }

  /**
   * Get all vertex element IDs.
   */
  public async getVertexElementIds(): Promise<Id64String[]> {
    return [...this._vertexElementIds];
  }

  /**
   * Validate the command result by checking all vertex elements exist.
   */
  public override async validateCommandResult(result?: Id64String[]): Promise<boolean> {
    if (!result) return true;

    // Verify all vertex elements exist in the database
    for (const elementId of result) {
      const element = this._iModel.elements.tryGetElement(elementId);
      if (!element) {
        return false;
      }
    }

    return true;
  }
}