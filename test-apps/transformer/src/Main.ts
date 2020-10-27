/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EOL } from "os";
import * as path from "path";
import { GetMetaDataFunction, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, IModelHost, IModelJsFs } from "@bentley/imodeljs-backend";
import { CloneRepositoryModel } from "./CloneRepositoryModel";
import { PhysicalModelCombiner } from "./PhysicalModelCombiner";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();
  if (true) {
    const sourceDirectoryName = "D:/data/bim/snapshots";
    const sourceBaseName = "fmg";
    // const sourceBaseName = "shell4";
    // const sourceBaseName = "shell-full-1015";
    // const sourceBaseName = "shell-full-1018";
    // const sourceBaseName = "cassia-05";
    const sourceFileName = path.join(sourceDirectoryName, `${sourceBaseName}.bim`);
    const targetFileName = path.join(__dirname, `${sourceBaseName}-optimized.bim`);
    initializeLogging(path.join(__dirname, `${sourceBaseName}-log.txt`));
    await PhysicalModelCombiner.combine(sourceFileName, targetFileName);
  } else {
    const sourceFileName = "D:/data/bim/snapshots/467d20b7-cf9b-4407-9052-237790253db7.bim";
    const targetFileName1 = path.join(__dirname, "fmg-repository-model.bim");
    process.stdout.write(`CloneRepositoryModel ${sourceFileName} --> ${targetFileName1}${EOL}`);
    await CloneRepositoryModel.clone(sourceFileName, targetFileName1);
    const targetFileName2 = path.join(__dirname, "fmg-physical-combined.bim");
    process.stdout.write(`PhysicalModelCombiner ${targetFileName1} --> ${targetFileName2}${EOL}`);
    await PhysicalModelCombiner.combine(targetFileName1, targetFileName2);
  }
  await IModelHost.shutdown();
})();

function initializeLogging(logFileName: string): void {
  // initialize logging
  if (IModelJsFs.existsSync(logFileName)) {
    IModelJsFs.removeSync(logFileName);
  }
  Logger.initialize(
    (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Error   |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
    (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Warning |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
    (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Info    |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
    (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Trace   |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
  );
  Logger.setLevelDefault(LogLevel.Error);
  Logger.setLevel("Progress", LogLevel.Info);
  Logger.setLevel("Memory", LogLevel.Info);
  if (true) {
    Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
    Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
    Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
  }
}
