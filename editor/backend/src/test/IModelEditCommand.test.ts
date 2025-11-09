import { expect } from "chai";
import { IModelDb, IModelHost, IModelJsFs, KnownLocations, StandaloneDb } from "@itwin/core-backend";
import { join } from "path";
import { SquareCommand, Pythagoras } from "./TestAssets";

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

  it("Cube a number using an immediate command", async () => {
    const squareCommand = new SquareCommand(iModelDb);

    const cubedResult = await squareCommand.execute(
      async () => squareCommand.performCubeOperation({ value: 2 })
    );
    expect(cubedResult).to.equal(8);
  });

  it("Calculate the hypotenuse using an immediate command", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calculateHypotenuse({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });

  it("Calculate the hypotenuse using a nested SquareCommand - Sync", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calculateHypotenuseWithCommandsSync({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });

  it("Calculate the hypotenuse using a nested SquareCommand - Async", async () => {
    const pythagorasCommand = new Pythagoras(iModelDb);

    const hypotenuse = await pythagorasCommand.execute(
      async () => pythagorasCommand.calculateHypotenuseWithCommandsAsync({ sideA: 3, sideB: 4 })
    );
    expect(hypotenuse).to.equal(5);
  });
});
