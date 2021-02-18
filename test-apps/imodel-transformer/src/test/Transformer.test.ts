/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, IModelHost, IModelJsFs, SnapshotDb } from "@bentley/imodeljs-backend";
import { progressLoggerCategory, Transformer } from "../Transformer";

describe("imodel-transformer", () => {
  before(async () => {
    await IModelHost.startup();

    if (false) { // set to true to enable logging
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(progressLoggerCategory, LogLevel.Info);
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  function initOutputFile(fileBaseName: string) {
    const outputDirName = path.join(__dirname, "output");
    if (!IModelJsFs.existsSync(outputDirName)) {
      IModelJsFs.mkdirSync(outputDirName);
    }
    const outputFileName = path.join(outputDirName, fileBaseName);
    if (IModelJsFs.existsSync(outputFileName)) {
      IModelJsFs.removeSync(outputFileName);
    }
    return outputFileName;
  }

  it("should transform an iModel", async () => {
    const sourceDbFile = "../../core/backend/src/test/assets/CompatibilityTestSeed.bim";
    assert.isTrue(IModelJsFs.existsSync(sourceDbFile));
    const sourceDb = SnapshotDb.openFile(sourceDbFile);

    const targetDbFileName = initOutputFile("CompatibilityTestSeed-Transformed.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFileName, {
      rootSubject: { name: `${sourceDb.rootSubject.name}-Transformed` },
      ecefLocation: sourceDb.ecefLocation,
    });

    await Transformer.transformAll(sourceDb, targetDb);
    sourceDb.close();
    targetDb.close();
  });
});
