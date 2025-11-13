import { EditCommandArgs, ImmediateCommand, InteractiveCommand, makeScopeSafe } from "../IModelEditCommand";

// This rule was deprecated in ESLint v8.46.0.
/* eslint-disable @typescript-eslint/return-await */

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

// Simple command that takes a numerical value and multiples it by itself
export class AddCommand extends ImmediateCommand<AddCommandArgs, number> {

  // Adds the two input values
  @makeScopeSafe
  public async performAddOperation(args: AddCommandArgs): Promise<number> {
    return args.firstNumber + args.secondNumber;
  }
}

// Simple command that takes a numerical value and multiples it by itself
export class SquareCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  @makeScopeSafe
  public async performSquareOperation(args: SquareCommandArgs): Promise<number> {
    return args.value * args.value;
  }
}

// Simple command that takes a numerical value and gets the square root
export class SquareRootCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  @makeScopeSafe
  public async performSquareRootOperation(args: SquareCommandArgs): Promise<number> {
    return Math.sqrt(args.value);
  }
}

// Simple command that takes a numerical value and multiples it by itself
export class SumOfSquaresCommand extends ImmediateCommand<SumOfSquaresArgs, number> {

  // Multiples the input value by itself
  @makeScopeSafe
  public async performSumOfSquaresOperation(args: SumOfSquaresArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const [sideASquared, sideBSquared] = await Promise.all([
      sideASquareCommand.performSquareOperation({ value: args.firstNumber }),
      sideBSquareCommand.performSquareOperation({ value: args.secondNumber })
    ]);

    const sumCommand = new AddCommand(this._iModel);
    return await sumCommand.performAddOperation({ firstNumber: sideASquared, secondNumber: sideBSquared });
  }
}

// Simple command that calculates the hypotenuse of a right triangle
export class PythagorasCommand extends ImmediateCommand<PythagorasArgs, number> {

  // Perform a^2 + b^2 directly without nested commands
  public async simpleSumOfSquares(args: PythagorasArgs): Promise<number> {
    return (args.sideA * args.sideA) + (args.sideB * args.sideB);
  }

  // Get square root of given value
  public async simpleSquareRoot(value: number): Promise<number> {
    return Math.sqrt(value);
  }

  // Calculate the hypotenuse using the two steps without nested commands
  @makeScopeSafe
  public async calcHypotenuse(args: PythagorasArgs): Promise<number> {
    return await this.simpleSquareRoot(await this.simpleSumOfSquares(args));
  }

  // Perform a^2 + b^2 asynchronously using nested SquareCommands
  @makeScopeSafe
  public async sumOfSquaresAsync(args: PythagorasArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const [sideASquared, sideBSquared] = await Promise.all([
      sideASquareCommand.performSquareOperation({ value: args.sideA }),
      sideBSquareCommand.performSquareOperation({ value: args.sideB })
    ]);

    const sumCommand = new AddCommand(this._iModel);
    return await sumCommand.performAddOperation({ firstNumber: sideASquared, secondNumber: sideBSquared });
  }

  // Perform a^2 + b^2 synchronously using nested SquareCommands
  @makeScopeSafe
  public async sumOfSquaresSync(args: PythagorasArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const sideASquared = await sideASquareCommand.performSquareOperation({ value: args.sideA });
    const sideBSquared = await sideBSquareCommand.performSquareOperation({ value: args.sideB });

    return sideASquared + sideBSquared;
  }

  // Calculate the hypotenuse using a single-level nested SquareCommands - Async
  @makeScopeSafe
  public async calcHypotenuseWithCommandsAsync(args: PythagorasArgs): Promise<number> {
    const step1Value = await this.sumOfSquaresAsync(args);

    return await this.simpleSquareRoot(step1Value);
  }

  // Calculate the hypotenuse using single-level nested SquareCommands - Sync
  @makeScopeSafe
  public async calcHypotenuseWithCommandsSync(args: PythagorasArgs): Promise<number> {
    const step1Value = await this.sumOfSquaresSync(args);

    return await this.simpleSquareRoot(step1Value);
  }

  // Calculate the hypotenuse using multiple-level nested Commands - Sync
  @makeScopeSafe
  public async calcHypotenuseWithMultipleNestedCommands(args: PythagorasArgs): Promise<number> {
    const sumOfSquaresCommand = new SumOfSquaresCommand(this._iModel);
    const sumOfSquares = await sumOfSquaresCommand.performSumOfSquaresOperation({ firstNumber: args.sideA, secondNumber: args.sideB })

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

  // Get the current sum of squares (a^2 + b^2)
  @makeScopeSafe
  public async getSumOfSquares(): Promise<number> {
    if (this._sideA === undefined || this._sideB === undefined) {
      throw new Error("Both sides must be set before calculating sum of squares");
    }
    return (this._sideA * this._sideA) + (this._sideB * this._sideB);
  }

  // Calculate and return the hypotenuse
  @makeScopeSafe
  public async calcHypotenuse(args: PythagorasArgs): Promise<number> {
    // Set the sides
    await this.setSideA(args.sideA);
    await this.setSideB(args.sideB);

    // Calculate sum of squares
    const sumOfSquares = await this.getSumOfSquares();

    // Calculate hypotenuse
    return Math.sqrt(sumOfSquares);
  }

  // Calculate hypotenuse using nested immediate commands
  @makeScopeSafe
  public async calcHypotenuseWithNestedCommands(args: PythagorasArgs): Promise<number> {
    // Use immediate commands for square operations
    const squareCommand = new SquareCommand(this._iModel);
    const [sideASquared, sideBSquared] = await Promise.all([
      squareCommand.performSquareOperation({ value: args.sideA }),
      squareCommand.performSquareOperation({ value: args.sideB })
    ]);

    const squareRootCommand = new SquareRootCommand(this._iModel);
    const result = await squareRootCommand.performSquareRootOperation({ value: sideASquared + sideBSquared });
    return result;
  }
}

// Interactive command for managing a polygon
export class InteractivePolygonEditor extends InteractiveCommand<EditCommandArgs, string> {
  private _vertices: Array<{ x: number, y: number }> = [];

  @makeScopeSafe
  public async addVertex(x: number, y: number): Promise<void> {
    this._vertices.push({ x, y });
  }

  @makeScopeSafe
  public async removeLastVertex(): Promise<void> {
    if (this._vertices.length === 0) {
      throw new Error("No vertices to remove");
    }
    this._vertices.pop();
  }

  @makeScopeSafe
  public async moveVertex(index: number, newX: number, newY: number): Promise<void> {
    if (index < 0 || index >= this._vertices.length) {
      throw new Error("Invalid vertex index");
    }
    this._vertices[index] = { x: newX, y: newY };
  }

  @makeScopeSafe
  public async getVertexCount(): Promise<number> {
    return this._vertices.length;
  }

  @makeScopeSafe
  public async getPolygonDescription(): Promise<string> {
    return `Polygon with ${this._vertices.length} vertices: ${JSON.stringify(this._vertices)}`;
  }
}