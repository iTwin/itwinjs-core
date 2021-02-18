/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as Yargs from "yargs";
import { IModelStatus, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, IModelHost, IModelJsFs, SnapshotDb } from "@bentley/imodeljs-backend";
import { IModelError } from "@bentley/imodeljs-common";
import { progressLoggerCategory, Transformer } from "./Transformer";

interface CommandLineArgs {
  source: string;
  target: string;
  simplifyElementGeometry?: boolean;
  combinePhysicalModels?: boolean;
}

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  try {
    Yargs.usage("Transform the specified source iModel into a new target iModel");
    Yargs.option("source", { desc: "The full path to the source iModel", type: "string" });
    Yargs.option("target", { desc: "The full path to the target iModel", type: "string" });
    Yargs.demandOption("source");
    Yargs.demandOption("target");
    Yargs.option("simplifyElementGeometry", { desc: "Simplify element geometry upon import into target iModel", type: "boolean", default: false });
    Yargs.option("combinePhysicalModels", { desc: "Combine all source PhysicalModels into a single PhysicalModel in the target iModel", type: "boolean", default: false });
    const args = Yargs.parse() as Yargs.Arguments<CommandLineArgs>;

    await IModelHost.startup();
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
    Logger.setLevel(progressLoggerCategory, LogLevel.Info);

    if (false) { // set to true to enable additional low-level transformation logging
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }

    // validate source iModel exists before continuing
    if (!IModelJsFs.existsSync(args.source)) {
      throw new IModelError(IModelStatus.NotFound, "source iModel not found", Logger.logError);
    }
    const sourceDb = SnapshotDb.openFile(args.source);

    // clean target output file before continuing
    if (IModelJsFs.existsSync(args.target)) {
      IModelJsFs.removeSync(args.target);
    }
    const targetDb = SnapshotDb.createEmpty(args.target, {
      rootSubject: { name: `${sourceDb.rootSubject.name}-Transformed` },
      ecefLocation: sourceDb.ecefLocation,
    });

    await Transformer.transformAll(sourceDb, targetDb, {
      simplifyElementGeometry: args.simplifyElementGeometry,
      combinePhysicalModels: args.combinePhysicalModels,
    });
    sourceDb.close();
    targetDb.close();
    await IModelHost.shutdown();
  } catch (error) {
    process.stdout.write(`${error.message}\n${error.stack}`);
  }
})();
