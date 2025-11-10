import { expect } from "chai";
import { IModelDb, IModelHost, IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { join } from "path";
import { InteractivePolygonEditor, InteractivePythagoras, Pythagoras, SquareCommand } from "./TestAssets";

describe("IModelEditCommand", () => {
  const outputDir = join(KnownLocations.tmpdir, "output");
  let iModelDb: IModelDb;
  let iModelPath: string;

  before(() => {
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
  })

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

  it("Square a number using an immediate command", async () => {
    const squareCommand = new SquareCommand(iModelDb);

    const squaredResult = await squareCommand.execute(
      async () => squareCommand.performSquareOperation({ value: 2 })
    );
    expect(squaredResult).to.equal(4);
  });

  it("Calculate the hypotenuse using an immediate command", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calcHypotenuse({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });

  it("Calculate the hypotenuse using a nested SquareCommand - Sync", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calcHypotenuseWithCommandsSync({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });

  it("Calculate the hypotenuse using a nested SquareCommand - Async", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });

  it("Call multiple commands concurrently (race condition)", async () => {
    const pythagorasCommand1 = new Pythagoras(iModelDb);
    const pythagorasCommand2 = new Pythagoras(iModelDb);
    const pythagorasCommand3 = new Pythagoras(iModelDb);
    const pythagorasCommand4 = new Pythagoras(iModelDb);
    const [hypotenuse1, hypotenuse2, hypotenuse3, hypotenuse4] = await Promise.all([
      pythagorasCommand1.execute(
        async () => pythagorasCommand1.calcHypotenuseWithCommandsAsync({ sideA: 5, sideB: 12 })
      ),
      pythagorasCommand2.execute(
        async () => pythagorasCommand2.calcHypotenuseWithCommandsAsync({ sideA: 8, sideB: 15 })
      ),
      pythagorasCommand3.execute(
        async () => pythagorasCommand3.calcHypotenuseWithCommandsAsync({ sideA: 7, sideB: 24 })
      ),
      pythagorasCommand4.execute(
        async () => pythagorasCommand4.calcHypotenuseWithCommandsAsync({ sideA: 9, sideB: 40 })
      ),
    ]);
    expect(hypotenuse1).to.equal(13);
    expect(hypotenuse2).to.equal(17);
    expect(hypotenuse3).to.equal(25);
    expect(hypotenuse4).to.equal(41);
  });

  it("High concurrency with many commands", async () => {
    const commandCount = 20;
    const commands = Array.from({ length: commandCount }, () => new SquareCommand(iModelDb));

    const results = await Promise.all(
      commands.map(async (cmd, i) =>
        cmd.execute(async () => cmd.performSquareOperation({ value: i + 1 }))
      )
    );

    // Verify all results are correct
    results.forEach((result, i) => {
      expect(result).to.equal((i + 1) * (i + 1));
    });
  });

  // Real-world scenario: Alternating external and nested commands
  it("Alternating external commands with nested commands", async () => {
    const pyth1 = new Pythagoras(iModelDb);
    const pyth2 = new Pythagoras(iModelDb);
    const square = new SquareCommand(iModelDb);

    const [result1, result2, result3] = await Promise.all([
      pyth1.execute(async () => pyth1.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 })),
      square.execute(async () => square.performSquareOperation({ value: 7 })),
      pyth2.execute(async () => pyth2.calcHypotenuseWithCommandsAsync({ sideA: 5, sideB: 12 })),
    ]);

    expect(result1).to.equal(5);
    expect(result2).to.equal(49);
    expect(result3).to.equal(13);
  });

  it("Commands with different execution times", async () => {
    const fastCommand = new SquareCommand(iModelDb);
    const slowCommand = new Pythagoras(iModelDb);
    const anotherFastCommand = new SquareCommand(iModelDb);

    // Start all at once - slow one should not block the queue unfairly
    const [fast1, slow, fast2] = await Promise.all([
      fastCommand.execute(async () => fastCommand.performSquareOperation({ value: 2 })),
      slowCommand.execute(async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 10000));
        return slowCommand.calcHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 });
      }),
      anotherFastCommand.execute(async () => anotherFastCommand.performSquareOperation({ value: 3 })),
    ]);

    expect(fast1).to.equal(4);
    expect(slow).to.equal(5);
    expect(fast2).to.equal(9);
  });

  // TODO Rohit: Fix this
  // Need to sort out how multiple nested command execution will work with edit scopes
  it("Calculate the hypotenuse using multiple nested SquareCommands - Async", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calcHypotenuseWithMultipleNestedCommands({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });

  describe.skip("InteractiveCommand Tests", () => {
    it("Simple interactive command - calculate hypotenuse", async () => {
      const interactivePythagoras = new InteractivePythagoras(iModelDb);

      const hypotenuse = await interactivePythagoras.calcHypotenuse({ sideA: 6, sideB: 8 });
      expect(hypotenuse).to.equal(10);
    });

    it("Interactive command with nested immediate commands", async () => {
      const interactivePythagoras = new InteractivePythagoras(iModelDb);

      const hypotenuse = await interactivePythagoras.calcHypotenuseWithNestedCommands({ sideA: 5, sideB: 12 });
      expect(hypotenuse).to.equal(13);
    });

    it("Interactive command with multiple updates (simulating UI drag)", async () => {
      const interactivePythagoras = new InteractivePythagoras(iModelDb);

      // Start with 3,4 and do 5 small random updates
      const hypotenuse = await interactivePythagoras.calcHypotenuseWithMultipleUpdates(3, 4, 5);

      // Result should be close to 5, but not exactly due to random updates
      // Just verify it's a reasonable number
      expect(hypotenuse).to.be.greaterThan(4.5);
      expect(hypotenuse).to.be.lessThan(5.5);
    });

    it("Multiple concurrent interactive commands", async () => {
      const command1 = new InteractivePythagoras(iModelDb);
      const command2 = new InteractivePythagoras(iModelDb);
      const command3 = new InteractivePythagoras(iModelDb);

      const [result1, result2, result3] = await Promise.all([
        command1.calcHypotenuse({ sideA: 3, sideB: 4 }),
        command2.calcHypotenuse({ sideA: 5, sideB: 12 }),
        command3.calcHypotenuse({ sideA: 8, sideB: 15 }),
      ]);

      expect(result1).to.equal(5);
      expect(result2).to.equal(13);
      expect(result3).to.equal(17);
    });

    it("Mix of immediate and interactive commands", async () => {
      const immediateCmd = new SquareCommand(iModelDb);
      const interactiveCmd = new InteractivePythagoras(iModelDb);
      const anotherImmediateCmd = new Pythagoras(iModelDb);

      const [immediate1, interactive, immediate2] = await Promise.all([
        immediateCmd.execute(async () => immediateCmd.performSquareOperation({ value: 7 })),
        interactiveCmd.calcHypotenuse({ sideA: 6, sideB: 8 }),
        anotherImmediateCmd.execute(async () => anotherImmediateCmd.calcHypotenuse({ sideA: 9, sideB: 12 })),
      ]);

      expect(immediate1).to.equal(49);
      expect(interactive).to.equal(10);
      expect(immediate2).to.equal(15);
    });

    it("Polygon editor - add and remove vertices", async () => {
      const polygonEditor = new InteractivePolygonEditor(iModelDb);

      await polygonEditor.startCommandScope();
      try {
        await polygonEditor.addVertex(0, 0);
        await polygonEditor.addVertex(10, 0);
        await polygonEditor.addVertex(10, 10);
        await polygonEditor.addVertex(0, 10);

        const count = await polygonEditor.getVertexCount();
        expect(count).to.equal(4);

        await polygonEditor.removeLastVertex();
        const countAfterRemove = await polygonEditor.getVertexCount();
        expect(countAfterRemove).to.equal(3);

        const description = await polygonEditor.getPolygonDescription();
        expect(description).to.include("3 vertices");

        await polygonEditor.saveChanges("Created polygon");
      } catch (error) {
        await polygonEditor.abandonChanges();
        throw error;
      } finally {
        await polygonEditor.endCommandScope();
      }
    });

    it("Polygon editor - move vertices", async () => {
      const polygonEditor = new InteractivePolygonEditor(iModelDb);

      await polygonEditor.startCommandScope();
      try {
        await polygonEditor.addVertex(0, 0);
        await polygonEditor.addVertex(5, 5);
        await polygonEditor.addVertex(10, 0);

        // Move the middle vertex
        await polygonEditor.moveVertex(1, 5, 10);

        const description = await polygonEditor.getPolygonDescription();
        expect(description).to.include('"x":5,"y":10');

        await polygonEditor.saveChanges("Moved vertex");
      } catch (error) {
        await polygonEditor.abandonChanges();
        throw error;
      } finally {
        await polygonEditor.endCommandScope();
      }
    });

    it("Interactive command error handling - abandon on error", async () => {
      const polygonEditor = new InteractivePolygonEditor(iModelDb);

      await polygonEditor.startCommandScope();
      try {
        await polygonEditor.addVertex(0, 0);

        // Try to remove from empty should throw
        await polygonEditor.removeLastVertex();
        await polygonEditor.removeLastVertex(); // This should throw

        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("No vertices to remove");
        await polygonEditor.abandonChanges();
      } finally {
        await polygonEditor.endCommandScope();
      }
    });

    it("High concurrency with interactive commands", async () => {
      const commandCount = 10;
      const commands = Array.from({ length: commandCount }, () => new InteractivePythagoras(iModelDb));

      const results = await Promise.all(
        commands.map((cmd, i) =>
          cmd.calcHypotenuse({ sideA: i + 3, sideB: i + 4 })
        )
      );

      // Verify all results are correct (each is sqrt((i+3)^2 + (i+4)^2))
      results.forEach((result, i) => {
        const expected = Math.sqrt((i + 3) * (i + 3) + (i + 4) * (i + 4));
        expect(result).to.equal(expected);
      });
    });

    it("Interactive command with slow operations", async () => {
      const interactiveCmd = new InteractivePythagoras(iModelDb);

      await interactiveCmd.startCommandScope();
      try {
        // Simulate slow operations
        await interactiveCmd.setSideA(3);
        await new Promise(resolve => setTimeout(resolve, 100));

        await interactiveCmd.setSideB(4);
        await new Promise(resolve => setTimeout(resolve, 100));

        const sumOfSquares = await interactiveCmd.getSumOfSquares();
        expect(sumOfSquares).to.equal(25);

        await interactiveCmd.saveChanges("Completed slow operations");
      } catch (error) {
        await interactiveCmd.abandonChanges();
        throw error;
      } finally {
        await interactiveCmd.endCommandScope();
      }
    });

    it("Nested interactive command within immediate command", async () => {
      // This tests if an interactive command can be called from within an immediate command
      const immediateCmd = new Pythagoras(iModelDb);

      const result = await immediateCmd.execute(async () => {
        // Create and run an interactive command as a nested operation
        const interactiveCmd = new InteractivePythagoras(iModelDb);
        const nestedResult = await interactiveCmd.calcHypotenuse({ sideA: 3, sideB: 4 });

        // Do some additional work in the immediate command
        return nestedResult * 2;
      });

      expect(result).to.equal(10); // 5 * 2
    });
  });
});
