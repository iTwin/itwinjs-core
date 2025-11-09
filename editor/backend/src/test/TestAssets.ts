import { EditCommandArgs, ImmediateCommand } from "../IModelEditCommand";

export interface SquareCommandArgs extends EditCommandArgs {
  value: number;
}

// Simple command that takes a numerical value and multiples it by itself
export class SquareCommand extends ImmediateCommand<SquareCommandArgs, number> {

  // Multiples the input value by itself
  public async performSquareOperation(args: SquareCommandArgs): Promise<number> {
    return args.value * args.value;
  }

  // Basic getter for the argument value
  public async getArgumentValue(args: SquareCommandArgs): Promise<number> {
    return args.value;
  }

  // Cubes the input value by calling the square operation and multiplying the result by the input value
  public async performCubeOperation(args: SquareCommandArgs): Promise<number> {
    const squaredValue = this.performSquareOperation(args)
    const squareCommand = new SquareCommand(this.iModel)

    return await squaredValue * await squareCommand.execute(
      async () => squareCommand.getArgumentValue(args)
    );
  }
}

export interface PythagorasArgs extends EditCommandArgs {
  sideA: number;
  sideB: number;
}

// Simple command that calculates the hypotenuse of a right triangle
export class Pythagoras extends ImmediateCommand<PythagorasArgs, number> {

  // Perform a^2 + b^2 directly without nested commands
  public async simpleStep1(args: PythagorasArgs): Promise<number> {
    return (args.sideA * args.sideA) + (args.sideB * args.sideB);
  }

  // Get square root of given value
  public async simpleStep2(value: number): Promise<number> {
    return Math.sqrt(value);
  }

  // Calculate the hypotenuse using the two steps without nested commands
  public async calculateHypotenuse(args: PythagorasArgs): Promise<number> {
    return await this.simpleStep2(await this.simpleStep1(args));
  }

  // Perform a^2 + b^2 asynchronously using nested SquareCommands
  public async performStep1Async(args: PythagorasArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this.iModel);
    const sideBSquareCommand = new SquareCommand(this.iModel);

    const [sideASquared, sideBSquared] = await Promise.all([
      sideASquareCommand.execute(
        async () => sideASquareCommand.performSquareOperation({ value: args.sideA })
      ),
      sideBSquareCommand.execute(
        async () => sideBSquareCommand.performSquareOperation({ value: args.sideB })
      )
    ]);

    return sideASquared + sideBSquared;
  }

  // Perform a^2 + b^2 synchronously using nested SquareCommands
  public async performStep1Sync(args: PythagorasArgs): Promise<number> {
    const sideASquareCommand = new SquareCommand(this.iModel);
    const sideBSquareCommand = new SquareCommand(this.iModel);

    const sideASquared = await sideASquareCommand.execute(
      async () => sideASquareCommand.performSquareOperation({ value: args.sideA })
    );
    const sideBSquared = await sideBSquareCommand.execute(
      async () => sideBSquareCommand.performSquareOperation({ value: args.sideB })
    );

    return sideASquared + sideBSquared;
  }

  // Calculate the hypotenuse using nested SquareCommands - Async
  public async calculateHypotenuseWithCommandsAsync(args: PythagorasArgs): Promise<number> {
    const step1Value = await this.performStep1Async(args);
    const pythagorasCommand = new Pythagoras(this.iModel);

    return await pythagorasCommand.execute(
      async () => pythagorasCommand.simpleStep2(step1Value)
    );
  }

  // Calculate the hypotenuse using nested SquareCommands - Sync
  public async calculateHypotenuseWithCommandsSync(args: PythagorasArgs): Promise<number> {
    const step1Value = await this.performStep1Sync(args);
    const pythagorasCommand = new Pythagoras(this.iModel);

    return await pythagorasCommand.execute(
      async () => pythagorasCommand.simpleStep2(step1Value)
    );
  }
}