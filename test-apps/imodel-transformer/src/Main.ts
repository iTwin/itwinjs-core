/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as Yargs from "yargs";
import { Config, Guid, GuidString, IModelStatus, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, BriefcaseDb, BriefcaseManager, IModelDb, IModelHost, IModelJsFs, SnapshotDb } from "@bentley/imodeljs-backend";
import { IModelError, IModelVersion } from "@bentley/imodeljs-common";
import { progressLoggerCategory, Transformer } from "./Transformer";
import { IModelHubUtils } from "./IModelHubUtils";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

interface CommandLineArgs {
  hub?: string;
  sourceFile?: string;
  sourceContextId?: string;
  sourceIModelId?: GuidString;
  sourceIModelName?: string;
  targetFile: string;
  clean?: boolean;
  simplifyElementGeometry?: boolean;
  combinePhysicalModels?: boolean;
  deleteUnusedGeometryParts?: boolean;
  excludeSubCategories?: string;
}

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  try {
    Yargs.usage("Transform the specified source iModel into a new target iModel");

    // iModelHub environment options
    Yargs.option("hub", { desc: "The iModelHub environment: prod | qa | dev", type: "string", default: "prod" });

    // used if the source iModel is a snapshot
    Yargs.option("sourceFile", { desc: "The full path to the source iModel", type: "string" });
    // Yargs.demandOption("sourceFile");

    // used if the source iModel is on iModelHub
    Yargs.option("sourceContextId", { desc: "The iModelHub context containing the source iModel", type: "string" });
    Yargs.option("sourceIModelId", { desc: "The guid of the source iModel", type: "string", default: undefined });
    Yargs.option("sourceIModelName", { desc: "The name of the source iModel", type: "string", default: undefined });
    // Yargs.option("sourceStartChangeSetId", { desc: "The starting changeSet of the source iModel to transform", type: "string", default: undefined });
    // Yargs.option("sourceEndChangeSetId", { desc: "The ending changeSet of the source iModel to transform", type: "string", default: undefined });

    // used if the target iModel is a snapshot
    Yargs.option("targetFile", { desc: "The full path to the target iModel", type: "string" });

    // used if the target iModel is on iModelHub
    Yargs.option("targetContextId", { desc: "The iModelHub context containing the target iModel", type: "string" });
    Yargs.option("targetIModelId", { desc: "The guid of the target iModel", type: "string", default: undefined });
    Yargs.option("targetIModelName", { desc: "The name of the target iModel", type: "string", default: undefined });
    // Yargs.demandOption("targetFile");

    // target iModel management options
    Yargs.option("clean", { desc: "If true, clean/delete the target before beginning", type: "boolean", default: undefined });

    // transformation options
    Yargs.option("simplifyElementGeometry", { desc: "Simplify element geometry upon import into target iModel", type: "boolean", default: false });
    Yargs.option("combinePhysicalModels", { desc: "Combine all source PhysicalModels into a single PhysicalModel in the target iModel", type: "boolean", default: false });
    Yargs.option("deleteUnusedGeometryParts", { desc: "Delete unused GeometryParts from the target iModel", type: "boolean", default: false });
    Yargs.option("excludeSubCategories", { desc: "Exclude geometry in the specified SubCategories (names with comma separators) from the target iModel", type: "string" });

    const args = Yargs.parse() as Yargs.Arguments<CommandLineArgs>;

    IModelHubUtils.setHubEnvironment(args.hub);
    await IModelHost.startup();
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
    Logger.setLevel(progressLoggerCategory, LogLevel.Info);

    if (false) { // set to true to enable additional low-level transformation logging
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }

    Logger.logInfo(progressLoggerCategory, `sourceContextId=${args.sourceContextId}`);
    Logger.logInfo(progressLoggerCategory, `sourceIModelId=${args.sourceIModelId}`);

    let requestContext: AuthorizedClientRequestContext | undefined;
    let sourceDb: IModelDb;
    let targetDb: IModelDb;

    if (args.sourceContextId) {
      requestContext = await IModelHubUtils.getAuthorizedClientRequestContext();
      const sourceContextId = args.sourceContextId;
      const sourceIModelId = args.sourceIModelId ? Guid.normalize(args.sourceIModelId) : undefined;
      const sourceBriefcaseProps = await BriefcaseManager.downloadBriefcase(requestContext, {
        contextId: sourceContextId,
        iModelId: sourceIModelId!,
        asOf: IModelVersion.latest().toJSON(),
      });
      sourceDb = await BriefcaseDb.open(requestContext, {
        fileName: sourceBriefcaseProps.fileName,
      });
    } else {
      Yargs.demandOption("sourceFile");
      const sourceFile = args.sourceFile ? path.normalize(args.sourceFile) : "";
      sourceDb = SnapshotDb.openFile(sourceFile);
    }

    let excludeSubCategories: string[] | undefined;
    if (args.excludeSubCategories) {
      excludeSubCategories = args.excludeSubCategories.split(",");
    }

    // validate source iModel exists before continuing

    if (args.targetFile === "x") { // WIP
      // target is on iModelHub
      throw new Error("not implemented yet!");
    } else {
      Yargs.demandOption("targetFile");
      // target is a local snapshot file
      const targetFile = args.targetFile ? path.normalize(args.targetFile) : "";
      // clean target output file before continuing
      if (IModelJsFs.existsSync(targetFile)) {
        IModelJsFs.removeSync(targetFile);
      }
      targetDb = SnapshotDb.createEmpty(targetFile, {
        rootSubject: { name: `${sourceDb.rootSubject.name}-Transformed` },
        ecefLocation: sourceDb.ecefLocation,
      });
    }

    await Transformer.transformAll(sourceDb, targetDb, {
      simplifyElementGeometry: args.simplifyElementGeometry,
      combinePhysicalModels: args.combinePhysicalModels,
      deleteUnusedGeometryParts: args.deleteUnusedGeometryParts,
      excludeSubCategories,
    });
    sourceDb.close();
    targetDb.close();
    await IModelHost.shutdown();
  } catch (error) {
    process.stdout.write(`${error.message}\n${error.stack}`);
  }
})();
