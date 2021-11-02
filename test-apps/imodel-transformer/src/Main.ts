/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as Yargs from "yargs";
import { assert, Guid, GuidString, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import { ProjectsAccessClient } from "@itwin/projects-client";
import { Version } from "@bentley/imodelhub-client";
import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import { IModelDb, IModelHost, IModelHostConfiguration, IModelJsFs, SnapshotDb, StandaloneDb } from "@itwin/core-backend";
import { BriefcaseIdValue, ChangesetId, ChangesetIndex, ChangesetProps, IModelVersion } from "@itwin/core-common";
import { TransformerLoggerCategory } from "@itwin/core-transformer";
import { ElementUtils } from "./ElementUtils";
import { IModelHubUtils } from "./IModelHubUtils";
import { loggerCategory, Transformer, TransformerOptions } from "./Transformer";

interface CommandLineArgs {
  hub?: string;
  sourceFile?: string;
  sourceITwinId?: GuidString;
  sourceIModelId?: GuidString;
  sourceIModelName?: string;
  sourceStartChangesetId?: ChangesetId;
  sourceStartChangesetIndex?: ChangesetIndex;
  sourceEndChangesetId?: ChangesetId;
  sourceEndChangesetIndex?: ChangesetIndex;
  /** location of a target snapshot iModel to transform */
  targetFile: string;
  /** location to create a new target file */
  targetDestination: string;
  targetITwinId?: GuidString;
  targetIModelId?: GuidString;
  targetIModelName?: string;
  clean?: boolean;
  logChangesets: boolean;
  logNamedVersions: boolean;
  logProvenanceScopes: boolean;
  logTransformer: boolean;
  validation: boolean;
  simplifyElementGeometry?: boolean;
  combinePhysicalModels?: boolean;
  exportViewDefinition?: Id64String;
  deleteUnusedGeometryParts?: boolean;
  noProvenance?: boolean;
  includeSourceProvenance?: boolean;
  excludeSubCategories?: string;
  excludeCategories?: string;
}

void (async () => {
  try {
    Yargs.usage("Transform the specified source iModel into a new target iModel");
    Yargs.strict();

    // iModelHub environment options
    Yargs.option("hub", { desc: "The iModelHub environment: prod | qa | dev", type: "string", default: "prod" });

    // used if the source iModel is a snapshot
    Yargs.option("sourceFile", { desc: "The full path to the source iModel", type: "string" });

    // used if the source iModel is on iModelHub
    Yargs.option("sourceITwinId", { desc: "The iModelHub iTwin containing the source iModel", type: "string" });
    Yargs.option("sourceIModelId", { desc: "The guid of the source iModel", type: "string", default: undefined });
    Yargs.option("sourceIModelName", { desc: "The name of the source iModel", type: "string", default: undefined });
    Yargs.option("sourceStartChangesetId", { desc: "The starting changeset of the source iModel to transform", type: "string", default: undefined });
    Yargs.option("sourceStartChangesetIndex", { desc: "The starting changeset of the source iModel to transform", type: "number", default: undefined });
    Yargs.option("sourceEndChangesetId", { desc: "The ending changeset of the source iModel to transform", type: "string", default: undefined });
    Yargs.option("sourceEndChangesetIndex", { desc: "The ending changeset of the source iModel to transform", type: "number", default: undefined });

    // used if the target iModel is a new snapshot
    Yargs.option("targetDestination", { desc: "The destination path where to create the target iModel", type: "string" });
    // used if the target iModel is a standalone db
    Yargs.option("targetFile", { desc: "The full path to the target iModel", type: "string" });

    // used if the target iModel is on iModelHub
    Yargs.option("targetITwinId", { desc: "The iModelHub iTwin containing the target iModel", type: "string" });
    Yargs.option("targetIModelId", { desc: "The guid of the target iModel", type: "string", default: undefined });
    Yargs.option("targetIModelName", { desc: "The name of the target iModel", type: "string", default: undefined });

    // target iModel management options
    Yargs.option("clean", { desc: "If true, refetch briefcases and clean/delete the target before beginning", type: "boolean", default: undefined });

    // print/debug options
    Yargs.option("logChangesets", { desc: "If true, log the list of changesets", type: "boolean", default: false });
    Yargs.option("logNamedVersions", { desc: "If true, log the list of named versions", type: "boolean", default: false });
    Yargs.option("logProvenanceScopes", { desc: "If true, log the provenance scopes in the source and target iModels", type: "boolean", default: false });
    Yargs.option("logTransformer", { desc: "If true, turn on verbose logging for iModel transformation", type: "boolean", default: false });
    Yargs.option("validation", { desc: "If true, perform extra and potentially expensive validation to assist with finding issues and confirming results", type: "boolean", default: false });

    // transformation options
    Yargs.option("simplifyElementGeometry", { desc: "Simplify element geometry upon import into target iModel", type: "boolean", default: false });
    Yargs.option("combinePhysicalModels", { desc: "Combine all source PhysicalModels into a single PhysicalModel in the target iModel", type: "boolean", default: false });
    Yargs.option("exportViewDefinition", { desc: "Only export elements that would be visible using the specified ViewDefinition Id", type: "string", default: undefined });
    Yargs.option("deleteUnusedGeometryParts", { desc: "Delete unused GeometryParts from the target iModel", type: "boolean", default: false });
    Yargs.option("excludeSubCategories", { desc: "Exclude geometry in the specified SubCategories (names with comma separators) from the target iModel", type: "string" });
    Yargs.option("excludeCategories", { desc: "Exclude a categories (names with comma separators) and their elements from the target iModel", type: "string" });
    Yargs.option("noProvenance", { desc: "If true, IModelTransformer should not record its provenance.", type: "boolean", default: false });
    Yargs.option("includeSourceProvenance", { desc: "Include existing provenance from the source iModel in the target iModel", type: "boolean", default: false });

    const args = Yargs.parse() as Yargs.Arguments<CommandLineArgs>;

    IModelHubUtils.setHubEnvironment(args.hub);

    const iModelHost = new IModelHostConfiguration();
    iModelHost.hubAccess = new IModelHubBackend();

    await IModelHost.startup(iModelHost);
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
    Logger.setLevel(loggerCategory, LogLevel.Info);

    if (args.logTransformer) { // optionally enable verbose transformation logging
      Logger.setLevel(TransformerLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(TransformerLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(TransformerLoggerCategory.IModelTransformer, LogLevel.Trace);
    }

    let iTwinAccessClient: ProjectsAccessClient | undefined;
    let sourceDb: IModelDb;
    let targetDb: IModelDb;
    const processChanges = args.sourceStartChangesetIndex || args.sourceStartChangesetId;

    const accessToken = await IModelHubUtils.getAccessToken();
    if (args.sourceITwinId || args.targetITwinId) {
      iTwinAccessClient = new ProjectsAccessClient();
    }

    if (args.sourceITwinId) {
      // source is from iModelHub
      assert(undefined !== iTwinAccessClient);
      assert(undefined !== args.sourceIModelId);
      const sourceITwinId = Guid.normalize(args.sourceITwinId);
      const sourceIModelId = Guid.normalize(args.sourceIModelId);
      let sourceEndVersion = IModelVersion.latest();
      Logger.logInfo(loggerCategory, `sourceITwinId=${sourceITwinId}`);
      Logger.logInfo(loggerCategory, `sourceIModelId=${sourceIModelId}`);
      if (args.sourceStartChangesetIndex || args.sourceStartChangesetId) {
        assert(!(args.sourceStartChangesetIndex && args.sourceStartChangesetId), "Pick single way to specify starting changeset");
        if (args.sourceStartChangesetIndex) {
          args.sourceStartChangesetId = await IModelHubUtils.queryChangesetId(accessToken, sourceIModelId, args.sourceStartChangesetIndex);
        } else {
          args.sourceStartChangesetIndex = await IModelHubUtils.queryChangesetIndex(accessToken, sourceIModelId, args.sourceStartChangesetId!);
        }
        Logger.logInfo(loggerCategory, `sourceStartChangesetIndex=${args.sourceStartChangesetIndex}`);
        Logger.logInfo(loggerCategory, `sourceStartChangesetId=${args.sourceStartChangesetId}`);
      }
      if (args.sourceEndChangesetIndex || args.sourceEndChangesetId) {
        assert(!(args.sourceEndChangesetIndex && args.sourceEndChangesetId), "Pick single way to specify ending changeset");
        if (args.sourceEndChangesetIndex) {
          args.sourceEndChangesetId = await IModelHubUtils.queryChangesetId(accessToken, sourceIModelId, args.sourceEndChangesetIndex);
        } else {
          args.sourceEndChangesetIndex = await IModelHubUtils.queryChangesetIndex(accessToken, sourceIModelId, args.sourceEndChangesetId!);
        }
        sourceEndVersion = IModelVersion.asOfChangeSet(args.sourceEndChangesetId!);
        Logger.logInfo(loggerCategory, `sourceEndChangesetIndex=${args.sourceEndChangesetIndex}`);
        Logger.logInfo(loggerCategory, `sourceEndChangesetId=${args.sourceEndChangesetId}`);
      }

      if (args.logChangesets) {
        await IModelHubUtils.forEachChangeset(accessToken, sourceIModelId, (changeset: ChangesetProps) => {
          Logger.logInfo(loggerCategory, `sourceChangeset: index=${changeset.index}, id="${changeset.id}", description="${changeset.description}"}`);
        });
      }

      if (args.logNamedVersions) {
        await IModelHubUtils.forEachNamedVersion(accessToken, sourceIModelId, (namedVersion: Version) => {
          Logger.logInfo(loggerCategory, `sourceNamedVersion: id="${namedVersion.id}", changesetId="${namedVersion.changeSetId}", name="${namedVersion.name}"`);
        });
      }

      sourceDb = await IModelHubUtils.downloadAndOpenBriefcase({
        accessToken,
        iTwinId: sourceITwinId,
        iModelId: sourceIModelId,
        asOf: sourceEndVersion.toJSON(),
        briefcaseId: BriefcaseIdValue.Unassigned, // A "pull only" briefcase can be used since the sourceDb is opened read-only
      });
    } else {
      // source is a local snapshot file
      assert(undefined !== args.sourceFile);
      const sourceFile = path.normalize(args.sourceFile);
      Logger.logInfo(loggerCategory, `sourceFile=${sourceFile}`);
      sourceDb = SnapshotDb.openFile(sourceFile);
    }

    if (args.validation) {
      // validate that there are no issues with the sourceDb to ensure that IModelTransformer is starting from a consistent state
      ElementUtils.validateCategorySelectors(sourceDb);
      ElementUtils.validateModelSelectors(sourceDb);
      ElementUtils.validateDisplayStyles(sourceDb);
    }

    if (args.targetITwinId) {
      // target is from iModelHub
      assert(undefined !== args.targetIModelId || undefined !== args.targetIModelName, "must be able to identify the iModel by either name or id");
      const targetITwinId = Guid.normalize(args.targetITwinId);
      let targetIModelId = args.targetIModelId ? Guid.normalize(args.targetIModelId) : undefined;
      if (undefined !== args.targetIModelName) {
        assert(undefined === targetIModelId, "should not specify targetIModelId if targetIModelName is specified");
        targetIModelId = await IModelHubUtils.queryIModelId(accessToken, targetITwinId, args.targetIModelName);
        if ((args.clean) && (undefined !== targetIModelId)) {
          await IModelHost.hubAccess.deleteIModel({ accessToken, iTwinId: targetITwinId, iModelId: targetIModelId });
          targetIModelId = undefined;
        }
        if (undefined === targetIModelId) {
          // create target iModel if it doesn't yet exist or was just cleaned/deleted above
          targetIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken, iTwinId: targetITwinId, iModelName: args.targetIModelName });
        }
      }
      assert(undefined !== targetIModelId);
      Logger.logInfo(loggerCategory, `targetITwinId=${targetITwinId}`);
      Logger.logInfo(loggerCategory, `targetIModelId=${targetIModelId}`);

      if (args.logChangesets) {
        await IModelHubUtils.forEachChangeset(accessToken, targetIModelId, (changeset: ChangesetProps) => {
          Logger.logInfo(loggerCategory, `targetChangeset:  index="${changeset.index}", id="${changeset.id}", description="${changeset.description}"`);
        });
      }

      if (args.logNamedVersions) {
        await IModelHubUtils.forEachNamedVersion(accessToken, targetIModelId, (namedVersion: Version) => {
          Logger.logInfo(loggerCategory, `targetNamedVersion: id="${namedVersion.id}", changesetId="${namedVersion.changeSetId}", name="${namedVersion.name}"`);
        });
      }

      targetDb = await IModelHubUtils.downloadAndOpenBriefcase({
        accessToken,
        iTwinId: targetITwinId,
        iModelId: targetIModelId,
      });
    } else if (args.targetDestination) {
      const targetDestination = args.targetDestination ? path.normalize(args.targetDestination) : "";
      assert(!processChanges, "cannot process changes because targetDestination creates a new iModel");
      // clean target output destination before continuing (regardless of args.clean value)
      if (IModelJsFs.existsSync(targetDestination)) {
        IModelJsFs.removeSync(targetDestination);
      }
      targetDb = StandaloneDb.createEmpty(targetDestination, { // use StandaloneDb instead of SnapshotDb to enable processChanges testing
        rootSubject: { name: `${sourceDb.rootSubject.name}-Transformed` },
        ecefLocation: sourceDb.ecefLocation,
      });
    } else {
      // target is a local standalone file
      assert(undefined !== args.targetFile);
      targetDb = StandaloneDb.openFile(args.targetFile);
    }

    if (args.logProvenanceScopes) {
      const sourceScopeIds = ElementUtils.queryProvenanceScopeIds(sourceDb);
      if (sourceScopeIds.size === 0) {
        Logger.logInfo(loggerCategory, "Source Provenance Scope: Not Found");
      } else {
        sourceScopeIds.forEach((scopeId) => Logger.logInfo(loggerCategory, `Source Provenance Scope: ${scopeId} ${sourceDb.elements.getElement(scopeId).getDisplayLabel()}`));
      }
      const targetScopeIds = ElementUtils.queryProvenanceScopeIds(targetDb);
      if (targetScopeIds.size === 0) {
        Logger.logInfo(loggerCategory, "Target Provenance Scope: Not Found");
      } else {
        targetScopeIds.forEach((scopeId) => Logger.logInfo(loggerCategory, `Target Provenance Scope: ${scopeId} ${targetDb.elements.getElement(scopeId).getDisplayLabel()}`));
      }
    }

    const transformerOptions: TransformerOptions = {
      ...args,
      excludeSubCategories: args.excludeSubCategories?.split(","),
      excludeCategories: args.excludeCategories?.split(","),
    };

    if (processChanges) {
      assert(undefined !== args.sourceStartChangesetId);
      await Transformer.transformChanges(accessToken, sourceDb, targetDb, args.sourceStartChangesetId, transformerOptions);
    } else {
      await Transformer.transformAll(sourceDb, targetDb, transformerOptions);
    }

    if (args.exportViewDefinition) {
      ElementUtils.insertViewDefinition(targetDb, "Default", true);
    }

    if (args.validation) {
      // validate that there are no issues with the targetDb after transformation
      ElementUtils.validateCategorySelectors(targetDb);
      ElementUtils.validateModelSelectors(targetDb);
      ElementUtils.validateDisplayStyles(targetDb);
    }

    sourceDb.close();
    targetDb.close();
    await IModelHost.shutdown();
  } catch (error: any) {
    process.stdout.write(`${error.message}\n${error.stack}`);
  }
})();
