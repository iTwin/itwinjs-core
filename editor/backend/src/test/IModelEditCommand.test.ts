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

  it.only("test calling external commands at once", async () => {
    const pythagorasCommand1 = new Pythagoras(iModelDb);
    const pythagorasCommand2 = new Pythagoras(iModelDb);
    const [hypotenuse1, hypotenuse2] = await Promise.all([
      pythagorasCommand1.execute(
        async () => pythagorasCommand1.calcHypotenuseWithCommandsAsync({ sideA: 5, sideB: 12 })
      ),
      pythagorasCommand2.execute(
        async () => pythagorasCommand2.calcHypotenuseWithCommandsAsync({ sideA: 8, sideB: 15 })
      )
    ]);
    expect(hypotenuse1).to.equal(13);
    expect(hypotenuse2).to.equal(17);
  });

  // TODO Rohit: Fix this
  // Need to sort out how multiple nested command execution will work with edit scopes
  it.skip("Calculate the hypotenuse using multiple nested SquareCommands - Async", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calcHypotenuseWithMultipleNestedCommands({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });
});
