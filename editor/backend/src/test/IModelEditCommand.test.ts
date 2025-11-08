import { expect } from "chai";
import { EditCommandArgs, ImmediateCommand } from "../IModelEditCommand";
import { IModelDb, IModelHost, IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { join } from "path";

describe("IModelEditCommand", () => {
  const outputDir = join(KnownLocations.tmpdir, "output");
  let iModelDb: IModelDb;
  let iModelPath: string;

  before(() => {
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
  })

  describe("Simple Immediate command", () => {

    beforeEach(async () => {
      await IModelHost.startup();
      iModelDb = StandaloneDb.createEmpty(join(KnownLocations.tmpdir, "output", "IModelEditCommandTest.bim"), {
        rootSubject: { name: "IModelEditCommandTest", description: "Test of the IModelEditCommand class." },
      });
      iModelPath = iModelDb.pathName;
    });

    afterEach(async () => {
      iModelDb.close();
      IModelJsFs.unlinkSync(iModelPath);
      await IModelHost.shutdown();
    });

    interface SquareCommandArgs extends EditCommandArgs {
      value: number;
    }

    // Simple command that takes a numerical value and multiples it by itself`
    class SquareCommand extends ImmediateCommand<SquareCommandArgs, number> {

      public async performSquareOperation(args: SquareCommandArgs): Promise<number> {
        return args.value * args.value;
      }

      public async getArgumentValue(args: SquareCommandArgs): Promise<number> {
        return args.value;
      }

      public async performCubeOperation(args: SquareCommandArgs): Promise<number> {
        const squaredValue = this.performSquareOperation(args);

        const squareCommand = new SquareCommand(this.iModel);

        return await squaredValue * await squareCommand.execute(
          { value: args.value },
          async (squareArgs: SquareCommandArgs) => squareCommand.getArgumentValue(squareArgs)
        );
      }
    }

    it.skip("Simple immediate command test", async () => {
      const squareCommand = new SquareCommand(iModelDb);

      const squaredResult = await squareCommand.execute(
        { value: 2 },
        async (args: SquareCommandArgs) => squareCommand.performSquareOperation(args)
      );
      expect(squaredResult).to.equal(4);
    });

    interface PythagorasArgs extends EditCommandArgs {
      sideA: number;
      sideB: number;
    }

    // Simple command that calculates the hypotenuse of a right triangle
    class Pythagoras extends ImmediateCommand<PythagorasArgs, number> {

      public async simpleStep1(args: PythagorasArgs): Promise<number> {
        return args.sideA * args.sideA + args.sideB * args.sideB;
      }

      public async simpleStep2(value: number): Promise<number> {
        return Math.sqrt(value);
      }

      public async calculateHypotenuse(args: PythagorasArgs): Promise<number> {
        const squareValue = await this.simpleStep1(args);

        const pythagorasCommand = new Pythagoras(this.iModel);

        return await pythagorasCommand.execute(
          { sideA: args.sideA, sideB: args.sideB },
          async () => pythagorasCommand.simpleStep2(squareValue)
        );
      }

      // Perform a^2 + b^2
      public async performStep1(args: PythagorasArgs): Promise<number> {
        const sideASquareCommand = new SquareCommand(this.iModel);
        const sideBSquareCommand = new SquareCommand(this.iModel);

        const [sideASquared, sideBSquared] = await Promise.all([
          sideASquareCommand.execute(
            { value: args.sideA },
            async (squareArgs: SquareCommandArgs) => sideASquareCommand.getArgumentValue(squareArgs)
          ),
          sideBSquareCommand.execute(
            { value: args.sideB },
            async (squareArgs: SquareCommandArgs) => sideBSquareCommand.getArgumentValue(squareArgs)
          )
        ]);

        return sideASquared + sideBSquared;
      }

      public async calculateHypotenuseWithCommands(args: PythagorasArgs): Promise<number> {
        const step1Value = await this.performStep1(args);

        const pythagorasCommand = new Pythagoras(this.iModel);

        return await pythagorasCommand.execute(
          { sideA: args.sideA, sideB: args.sideB },
          async () => pythagorasCommand.simpleStep2(step1Value)
        );
      }
    }

    it.skip("Nested simple immediate command test", async () => {
      const squareCommand = new Pythagoras(iModelDb);

      const squaredResult = await squareCommand.execute(
        { sideA: 3, sideB: 4 },
        async (args: PythagorasArgs) => squareCommand.calculateHypotenuse(args)
      );
      expect(squaredResult).to.equal(5);
    });

    it("Multiple commands", async () => {
      const squareCommand = new Pythagoras(iModelDb);

      const squaredResult = await squareCommand.execute(
        { sideA: 3, sideB: 4 },
        async (args: PythagorasArgs) => squareCommand.calculateHypotenuseWithCommands(args)
      );
      expect(squaredResult).to.equal(5);
    });
  });
});
