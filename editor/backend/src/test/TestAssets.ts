import { EditCommandArgs, ImmediateCommand } from "../IModelEditCommand";

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
  public async performAddOperation(args: AddCommandArgs): Promise<number> {
    return args.firstNumber + args.secondNumber;
  }
}

// Simple command that takes a numerical value and multiples it by itself
export class SquareCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  public async performSquareOperation(args: SquareCommandArgs): Promise<number> {
    return args.value * args.value;
  }
}

// Simple command that takes a numerical value and multiples it by itself
export class SumOfSquaresCommand extends ImmediateCommand<SumOfSquaresArgs, number> {

  // Multiples the input value by itself
  public async performSumOfSquaresOperation(args: SumOfSquaresArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const [sideASquared, sideBSquared] = await Promise.all([
      sideASquareCommand.execute(
        async () => sideASquareCommand.performSquareOperation({ value: args.firstNumber })
      ),
      sideBSquareCommand.execute(
        async () => sideBSquareCommand.performSquareOperation({ value: args.secondNumber })
      )
    ]);

    const sumCommand = new AddCommand(this._iModel);
    return await sumCommand.execute(
      async () => sumCommand.performAddOperation({ firstNumber: sideASquared, secondNumber: sideBSquared })
    );
  }
}

// Simple command that calculates the hypotenuse of a right triangle
export class Pythagoras extends ImmediateCommand<PythagorasArgs, number> {

  // Perform a^2 + b^2 directly without nested commands
  public async simpleSumOfSquares(args: PythagorasArgs): Promise<number> {
    return (args.sideA * args.sideA) + (args.sideB * args.sideB);
  }

  // Get square root of given value
  public async simpleSquareRoot(value: number): Promise<number> {
    return Math.sqrt(value);
  }

  // Calculate the hypotenuse using the two steps without nested commands
  public async calcHypotenuse(args: PythagorasArgs): Promise<number> {
    return await this.simpleSquareRoot(await this.simpleSumOfSquares(args));
  }

  // Perform a^2 + b^2 asynchronously using nested SquareCommands
  public async sumOfSquaresAsync(args: PythagorasArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const [sideASquared, sideBSquared] = await Promise.all([
      sideASquareCommand.execute(
        async () => sideASquareCommand.performSquareOperation({ value: args.sideA })
      ),
      sideBSquareCommand.execute(
        async () => sideBSquareCommand.performSquareOperation({ value: args.sideB })
      )
    ]);

    const sumCommand = new AddCommand(this._iModel);
    return await sumCommand.execute(
      async () => sumCommand.performAddOperation({ firstNumber: sideASquared, secondNumber: sideBSquared })
    );
  }

  // Perform a^2 + b^2 synchronously using nested SquareCommands
  public async sumOfSquaresSync(args: PythagorasArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this._iModel);
    const sideBSquareCommand = new SquareCommand(this._iModel);

    const sideASquared = await sideASquareCommand.execute(
      async () => sideASquareCommand.performSquareOperation({ value: args.sideA })
    );
    const sideBSquared = await sideBSquareCommand.execute(
      async () => sideBSquareCommand.performSquareOperation({ value: args.sideB })
    );

    return sideASquared + sideBSquared;
  }

  // Calculate the hypotenuse using a single-level nested SquareCommands - Async
  public async calcHypotenuseWithCommandsAsync(args: PythagorasArgs): Promise<number> {
    const step1Value = await this.sumOfSquaresAsync(args);

    return await this.simpleSquareRoot(step1Value);
  }

  // Calculate the hypotenuse using single-level nested SquareCommands - Sync
  public async calcHypotenuseWithCommandsSync(args: PythagorasArgs): Promise<number> {
    const step1Value = await this.sumOfSquaresSync(args);

    return await this.simpleSquareRoot(step1Value);
  }

  // Calculate the hypotenuse using multiple-level nested Commands - Sync
  public async calcHypotenuseWithMultipleNestedCommands(args: PythagorasArgs): Promise<number> {
    const sumOfSquaresCommand = new SumOfSquaresCommand(this._iModel);
    const sumOfSquares = await sumOfSquaresCommand.execute(
      async () => sumOfSquaresCommand.performSumOfSquaresOperation({ firstNumber: args.sideA, secondNumber: args.sideB })
    );

    return await this.simpleSquareRoot(sumOfSquares);
  }
}