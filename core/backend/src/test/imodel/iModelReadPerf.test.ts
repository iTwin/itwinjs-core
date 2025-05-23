import { IModelTestUtils } from "../IModelTestUtils";
import { SnapshotDb } from "../../core-backend";
import { assert } from "chai";
import { BisCodeSpec, Code, IModel } from "@itwin/core-common";
import { Logger, LogLevel } from "@itwin/core-bentley";

describe.only("iModel Read Performance Test", () => {
  let iModel: SnapshotDb;

  beforeEach(async () => {
    const sourceFileName = "xl.bim";

    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Info);

    Logger.logInfo("ReadPerfTest", "Opening bim file...");
    IModelTestUtils.registerTestBimSchema();
    iModel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("ReadPerf", sourceFileName), IModelTestUtils.resolveAssetFile(sourceFileName));
    Logger.logInfo("ReadPerfTest", "Bim file opened");
  });

  afterEach(() => {
    iModel.close();
  });

  it("should read 5000 elements from an iModel", async () => {
    const partitionId = iModel.elements.insertElement({
      classFullName: "BisCore:PhysicalPartition",
      model: IModel.repositoryModelId,
      parent: {
        relClassName: "BisCore:SubjectOwnsPartitionElements",
        id: IModel.rootSubjectId,
      },
      code: new Code({
        spec: iModel.codeSpecs.getByName(BisCodeSpec.informationPartitionElement).id,
        scope: IModel.rootSubjectId,
        value: "physical model",
      }),
    });


    Logger.logInfo("ReadPerfTest", "Beginning read test...");

    let rowCount = 0;
    for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element LIMIT 5000")) {
      const id =iModel.relationships.insertInstance({
        classFullName: "BisCore:ElementHasLinks",
        sourceId: partitionId,
        targetId: row.ECInstanceId,
      });

      Logger.logInfo("ReadPerfTest", `Row: ${++rowCount}, Inserted relationship: ${id}`);
      assert.isDefined(row[0]);
    }

    iModel.saveChanges();
    // // eslint-disable-next-line @typescript-eslint/no-deprecated
    // iModel.withPreparedStatement(`SELECT * FROM bis.Element`, (stmt: ECSqlStatement): number => {
    //   if (stmt.step() === DbResult.BE_SQLITE_ROW) {
    //     timePrevious = timeElapsed;
    //     timeElapsed += Date.now() - timer;
    //     console.log(`Row: ${rowCount}, Time Elapsed: ${timeElapsed - timePrevious}ms`);
    //   }
    //     rowCount++;
    // });
  });

});