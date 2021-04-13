/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as Yargs from "yargs";
import { assert, Guid, GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { ContextRegistryClient } from "@bentley/context-registry-client";
import { BackendLoggerCategory, BackendRequestContext, IModelDb, IModelHost, IModelJsFs, SnapshotDb } from "@bentley/imodeljs-backend";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { IModelHubUtils } from "./IModelHubUtils";
import { Transformer } from "./Transformer";

const loggerCategory = "imodel-transformer";

interface CommandLineArgs {
  hub?: string;
  sourceFile?: string;
  sourceContextId?: GuidString;
  sourceIModelId?: GuidString;
  sourceIModelName?: string;
  sourceStartChangeSetId?: string;
  sourceEndChangeSetId?: string;
  targetFile: string;
  targetContextId?: GuidString;
  targetIModelId?: GuidString;
  targetIModelName?: string;
  clean?: boolean;
  logChangeSets: boolean;
  logNamedVersions: boolean;
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

    // used if the source iModel is on iModelHub
    Yargs.option("sourceContextId", { desc: "The iModelHub context containing the source iModel", type: "string" });
    Yargs.option("sourceIModelId", { desc: "The guid of the source iModel", type: "string", default: undefined });
    Yargs.option("sourceIModelName", { desc: "The name of the source iModel", type: "string", default: undefined });
    Yargs.option("sourceStartChangeSetId", { desc: "The starting changeSet of the source iModel to transform", type: "string", default: undefined });
    Yargs.option("sourceEndChangeSetId", { desc: "The ending changeSet of the source iModel to transform", type: "string", default: undefined });

    // used if the target iModel is a snapshot
    Yargs.option("targetFile", { desc: "The full path to the target iModel", type: "string" });

    // used if the target iModel is on iModelHub
    Yargs.option("targetContextId", { desc: "The iModelHub context containing the target iModel", type: "string" });
    Yargs.option("targetIModelId", { desc: "The guid of the target iModel", type: "string", default: undefined });
    Yargs.option("targetIModelName", { desc: "The name of the target iModel", type: "string", default: undefined });

    // target iModel management options
    Yargs.option("clean", { desc: "If true, refetch briefcases and clean/delete the target before beginning", type: "boolean", default: undefined });

    // print/debug options
    Yargs.option("logChangeSets", { desc: "If true, log the list of changeSets", type: "boolean", default: false });
    Yargs.option("logNamedVersions", { desc: "If true, log the list of named versions", type: "boolean", default: false });

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
    Logger.setLevel(loggerCategory, LogLevel.Info);

    if (true) { // set to true to enable additional low-level transformation logging
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }

    let requestContext: AuthorizedClientRequestContext | BackendRequestContext;
    let contextRegistry: ContextRegistryClient | undefined;
    let sourceDb: IModelDb;
    let targetDb: IModelDb;
    let processChanges = false;

    if (args.sourceContextId || args.targetContextId) {
      requestContext = await IModelHubUtils.getAuthorizedClientRequestContext();
      contextRegistry = new ContextRegistryClient();
    } else {
      requestContext = new BackendRequestContext();
    }

    if (args.sourceContextId) {
      // source is from iModelHub
      assert(requestContext instanceof AuthorizedClientRequestContext);
      assert(undefined !== contextRegistry);
      assert(undefined !== args.sourceIModelId);
      const sourceContextId = Guid.normalize(args.sourceContextId);
      const sourceIModelId = Guid.normalize(args.sourceIModelId);
      const sourceEndVersion = args.sourceEndChangeSetId ? IModelVersion.asOfChangeSet(args.sourceEndChangeSetId) : IModelVersion.latest();
      const sourceContext = await contextRegistry.getProject(requestContext, {
        $filter: `$id+eq+'${sourceContextId}'`,
      });
      assert(undefined !== sourceContext);
      Logger.logInfo(loggerCategory, `sourceContextId=${sourceContextId}, name=${sourceContext.name}`);
      Logger.logInfo(loggerCategory, `sourceIModelId=${sourceIModelId}`);
      if (args.sourceStartChangeSetId) {
        processChanges = true;
        Logger.logInfo(loggerCategory, `sourceStartChangeSetId=${args.sourceStartChangeSetId}`);
      }
      if (args.sourceEndChangeSetId) {
        Logger.logInfo(loggerCategory, `sourceEndChangeSetId=${args.sourceEndChangeSetId}`);
      }

      if (args.logChangeSets) {
        await IModelHubUtils.logChangeSets(requestContext, sourceIModelId, loggerCategory);
      }

      if (args.logNamedVersions) {
        await IModelHubUtils.logNamedVersions(requestContext, sourceIModelId, loggerCategory);
      }

      sourceDb = await IModelHubUtils.downloadAndOpenBriefcase(requestContext, sourceContextId, sourceIModelId, sourceEndVersion);
    } else {
      // source is a local snapshot file
      assert(undefined !== args.sourceFile);
      const sourceFile = path.normalize(args.sourceFile);
      Logger.logInfo(loggerCategory, `sourceFile=${sourceFile}`);
      sourceDb = SnapshotDb.openFile(sourceFile);
    }

    if (args.targetContextId) {
      // target is from iModelHub
      assert(requestContext instanceof AuthorizedClientRequestContext);
      assert(undefined !== args.targetIModelId || undefined !== args.targetIModelName, "must be able to identify the iModel by either name or id");
      const targetContextId = Guid.normalize(args.targetContextId);
      let targetIModelId = args.targetIModelId ? Guid.normalize(args.targetIModelId) : undefined;
      if (undefined !== args.targetIModelName) {
        assert(undefined === targetIModelId, "should not specify targetIModelId if targetIModelName is specified");
        targetIModelId = await IModelHubUtils.queryIModelId(requestContext, targetContextId, args.targetIModelName);
        if ((args.clean) && (undefined !== targetIModelId)) {
          await IModelHost.iModelClient.iModels.delete(requestContext, targetContextId, targetIModelId);
          targetIModelId = undefined;
        }
        if (undefined === targetIModelId) {
          // create target iModel if it doesn't yet exist or was just cleaned/deleted above
          const targetHubIModel = await IModelHost.iModelClient.iModels.create(requestContext, targetContextId, args.targetIModelName);
          targetIModelId = targetHubIModel.id;
        }
      }
      assert(undefined !== targetIModelId);
      Logger.logInfo(loggerCategory, `targetContextId=${targetContextId}`);
      Logger.logInfo(loggerCategory, `targetIModelId=${targetIModelId}`);

      if (args.logChangeSets) {
        await IModelHubUtils.logChangeSets(requestContext, targetIModelId, loggerCategory);
      }

      if (args.logNamedVersions) {
        await IModelHubUtils.logNamedVersions(requestContext, targetIModelId, loggerCategory);
      }

      targetDb = await IModelHubUtils.downloadAndOpenBriefcase(requestContext, targetContextId, targetIModelId, IModelVersion.latest());
    } else {
      assert(undefined !== args.targetFile);
      // target is a local snapshot file
      const targetFile = args.targetFile ? path.normalize(args.targetFile) : "";
      // clean target output file before continuing (regardless of args.clean value)
      if (IModelJsFs.existsSync(targetFile)) {
        IModelJsFs.removeSync(targetFile);
      }
      targetDb = SnapshotDb.createEmpty(targetFile, {
        rootSubject: { name: `${sourceDb.rootSubject.name}-Transformed` },
        ecefLocation: sourceDb.ecefLocation,
      });
    }

    let excludeSubCategories: string[] | undefined;
    if (args.excludeSubCategories) {
      excludeSubCategories = args.excludeSubCategories.split(",");
    }

    const options = {
      simplifyElementGeometry: args.simplifyElementGeometry,
      combinePhysicalModels: args.combinePhysicalModels,
      deleteUnusedGeometryParts: args.deleteUnusedGeometryParts,
      excludeSubCategories,
    };

    if (processChanges) {
      assert(requestContext instanceof AuthorizedClientRequestContext);
      assert(undefined !== args.sourceStartChangeSetId);
      await Transformer.transformChanges(requestContext, sourceDb, targetDb, args.sourceStartChangeSetId, options);
    } else {
      await Transformer.transformAll(requestContext, sourceDb, targetDb, options);
    }

    sourceDb.close();
    targetDb.close();
    await IModelHost.shutdown();
  } catch (error) {
    process.stdout.write(`${error.message}\n${error.stack}`);
  }
})();
