import { expect } from "chai";
import { IModelDb, IModelHost, IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { join } from "path";
import { Pythagoras, SquareCommand } from "./TestAssets";

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
});
