/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EOL } from "os";
import * as path from "path";
import { GetMetaDataFunction, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, IModelHost, IModelJsFs } from "@bentley/imodeljs-backend";
import { PhysicalModelCombiner } from "./PhysicalModelCombiner";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();
  // const sourceDirectoryName = "D:/data/bim/snapshots";
  const sourceDirectoryName = "D:/data/bim/bechtel";
  const sourceBaseName = "bechtel-source";
  // const sourceBaseName = "fmg";
  // const sourceBaseName = "shell4";
  // const sourceBaseName = "shell-full-1015";
  // const sourceBaseName = "shell-full-1018";
  // const sourceBaseName = "cassia-05";
  const sourceFileName = path.join(sourceDirectoryName, `${sourceBaseName}.bim`);
  const targetFileName = path.join(__dirname, `${sourceBaseName}-optimized.bim`);
  initializeLogging(); // path.join(__dirname, `${sourceBaseName}-log.txt`));
  await PhysicalModelCombiner.combine(sourceFileName, targetFileName);
  await IModelHost.shutdown();
})();

function initializeLogging(logFileName?: string): void {
  // initialize logging
  if (undefined === logFileName) {
    Logger.initializeToConsole();
  } else {
    if (IModelJsFs.existsSync(logFileName)) {
      IModelJsFs.removeSync(logFileName);
    }
    Logger.initialize(
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Error   |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Warning |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Info    |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => IModelJsFs.appendFileSync(logFileName, `Trace   |${category}| ${message}${getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : ""}${EOL}`),
    );
  }
  Logger.setLevelDefault(LogLevel.Error);
  Logger.setLevel("Progress", LogLevel.Info);
  Logger.setLevel("Memory", LogLevel.Info);
  if (false) {
    Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
    Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
    Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
  }
}
