/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb, Element, HubMock, IModelDb, IModelHost, IModelJsNative, Relationship, SnapshotDb, SQLiteDb } from "@itwin/core-backend";
import * as BackendTestUtils from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, DbResult, GuidString, Id64, Id64String, StopWatch } from "@itwin/core-bentley";
import { ChangesetId, ElementProps } from "@itwin/core-common";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { IModelImporter } from "../../IModelImporter";
import { IModelExporter } from "../../IModelExporter";
import { IModelTransformer, IModelTransformOptions } from "../../IModelTransformer";
import { assertIdentityTransformation, HubWrappers, IModelTransformerTestUtils } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";

import "./TransformerTestStartup"; // calls startup/shutdown IModelHost before/after all tests

const formatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** format a proportion (number between 0 and 1) to a percent */
const percent = (n: number) => `${formatter.format(100 * n)}%`;

class CountingImporter extends IModelImporter {
  public owningTransformer: CountingTransformer | undefined;
  public override importElement(elementProps: ElementProps): Id64String {
    if (this.owningTransformer === undefined)
      throw Error("uninitialized, '_owningTransformer' must have been set before transformations");
    ++this.owningTransformer.importedEntities;
    return super.importElement(elementProps);
  }
}

/** this class services two functions,
 * 1. make sure transformations can be resumed by subclasses with different constructor argument types
 * 2. count operations that should not be reperformed by a resumed transformation
 */
class CountingTransformer extends IModelTransformer {
  public importedEntities = 0;
  public exportedEntities = 0;
  constructor(opts: {
    source: IModelDb;
    target: IModelDb;
    options?: IModelTransformOptions;
  }) {
    super(
      opts.source,
      new CountingImporter(opts.target),
      opts.options
    );
    (this.importer as CountingImporter).owningTransformer = this;
  }
  public override onExportElement(sourceElement: Element) {
    ++this.exportedEntities;
    return super.onExportElement(sourceElement);
  }
  public override onExportRelationship(sourceRelationship: Relationship) {
    ++this.exportedEntities;
    return super.onExportRelationship(sourceRelationship);
  }
}

/** a transformer that executes a callback after X element exports */
class CountdownTransformer extends IModelTransformer {
  public relationshipExportsUntilCall: number | undefined;
  public elementExportsUntilCall: number | undefined;
  public callback: (() => Promise<void>) | undefined;
  public constructor(...args: ConstructorParameters<typeof IModelTransformer>) {
    super(...args);
    const _this = this; // eslint-disable-line @typescript-eslint/no-this-alias
    const oldExportElem = this.exporter.exportElement; // eslint-disable-line @typescript-eslint/unbound-method
    this.exporter.exportElement = async function (...args) {
      if (_this.elementExportsUntilCall === 0) await _this.callback?.();
      if (_this.elementExportsUntilCall !== undefined)
        _this.elementExportsUntilCall--;
      return oldExportElem.call(this, ...args);
    };
    const oldExportRel = this.exporter.exportRelationship; // eslint-disable-line @typescript-eslint/unbound-method
    this.exporter.exportRelationship = async function (...args) {
      if (_this.relationshipExportsUntilCall === 0) await _this.callback?.();
      if (_this.relationshipExportsUntilCall !== undefined)
        _this.relationshipExportsUntilCall--;
      return oldExportRel.call(this, ...args);
    };
  }
}

/** a transformer that crashes on the nth element export, set `elementExportsUntilCall` to control the count */
class CountdownToCrashTransformer extends CountdownTransformer {
  public constructor(...args: ConstructorParameters<typeof CountdownTransformer>) {
    super(...args);
    this.callback = () => { throw Error("crash"); };
  }
}

/**
 * Wraps all IModel native addon functions and constructors in a randomly throwing wrapper,
 * as well as all IModelTransformer functions
 * @note you must call sinon.restore at the end of any test that uses this
 */
function setupCrashingNativeAndTransformer({
  methodCrashProbability = 1 / 800,
  onCrashableCallMade,
}: {
  methodCrashProbability?: number;
  onCrashableCallMade?(): void;
} = {}) {
  let crashingEnabled = false;
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(IModelHost.platform)
  ) as [keyof typeof IModelHost["platform"], PropertyDescriptor][]) {
    const superValue: unknown = descriptor.value;
    if (typeof superValue === "function" && descriptor.writable) {
      sinon.replace(
        IModelHost.platform,
        key,
        function (this: IModelJsNative.DgnDb, ...args: any[]) {
          onCrashableCallMade?.();
          if (crashingEnabled) {
            // this does not at all test mid-method crashes... that might be doable by racing timeouts on async functions...
            if (crashingEnabled && Math.random() <= methodCrashProbability)
              throw Error("fake native crash");
          }
          const isConstructor = (o: Function): o is new (...a: any[]) => any =>
            "prototype" in o;
          if (isConstructor(superValue)) return new superValue(...args);
          else return superValue.call(this, ...args);
        }
      );
    }
  }

  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(IModelTransformer.prototype)
  ) as [keyof IModelTransformer, PropertyDescriptor][]) {
    const superValue: unknown = descriptor.value;
    if (typeof superValue === "function" && descriptor.writable) {
      sinon.replace(
        IModelTransformer.prototype,
        key,
        function (this: IModelTransformer, ...args: any[]) {
          onCrashableCallMade?.();
          if (crashingEnabled) {
            // this does not at all test mid-method crashes... that might be doable by racing timeouts on async functions...
            if (crashingEnabled && Math.random() <= methodCrashProbability)
              throw Error("fake crash");
          }
          return superValue.call(this, ...args);
        }
      );
    }
  }

  return {
    enableCrashes: (val = true) => {
      crashingEnabled = val;
    },
  };
}

async function transformWithCrashAndRecover<
  Transformer extends IModelTransformer,
  DbType extends IModelDb
>({
  sourceDb,
  targetDb,
  transformer,
  disableCrashing,
  transformerProcessing = async (t, time = 0) => {
    if (time === 0) await t.processSchemas();
    await t.processAll();
  },
}: {
  sourceDb: DbType;
  targetDb: DbType;
  transformer: Transformer;
  /* what processing to do for the transform; default impl is above */
  transformerProcessing?: (transformer: Transformer, time?: number) => Promise<void>;
  disableCrashing?: (transformer: Transformer) => void;
}) {
  let crashed = false;
  try {
    await transformerProcessing(transformer);
  } catch (transformerErr) {
    expect((transformerErr as Error).message).to.equal("crash");
    crashed = true;
    const dumpPath = IModelTransformerTestUtils.prepareOutputFile(
      "IModelTransformerResumption",
      "transformer-state.db"
    );
    transformer.saveStateToFile(dumpPath);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TransformerClass = transformer.constructor as typeof IModelTransformer;
    transformer = TransformerClass.resumeTransformation(dumpPath, sourceDb, targetDb) as Transformer;
    disableCrashing?.(transformer);
    await transformerProcessing(transformer);
  }

  expect(crashed).to.be.true;
  return targetDb;
}

/** this utility is for consistency and readability, it doesn't provide any actual abstraction */
async function transformNoCrash<
  Transformer extends IModelTransformer
>({
  targetDb,
  transformer,
  transformerProcessing = async (t) => { await t.processSchemas(); await t.processAll(); },
}: {
  sourceDb: IModelDb;
  targetDb: IModelDb;
  transformer: Transformer;
  transformerProcessing?: (transformer: Transformer) => Promise<void>;
}): Promise<IModelDb> {
  await transformerProcessing(transformer);
  return targetDb;
}

describe("test resuming transformations", () => {
  let iTwinId: GuidString;
  let accessToken: AccessToken;
  let seedDbId: GuidString;
  let seedDb: BriefcaseDb;

  before(async () => {
    HubMock.startup("IModelTransformerResumption", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
    accessToken = await HubWrappers.getAccessToken(BackendTestUtils.TestUserType.Regular);
    const seedPath = IModelTransformerTestUtils.prepareOutputFile("IModelTransformerResumption", "seed.bim");
    SnapshotDb.createEmpty(seedPath, { rootSubject: { name: "resumption-tests-seed" } });
    seedDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "ResumeTestsSeed", description: "seed for resumption tests", version0: seedPath, noLocks: true });
    seedDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: seedDbId });
    await BackendTestUtils.ExtensiveTestScenario.prepareDb(seedDb);
    BackendTestUtils.ExtensiveTestScenario.populateDb(seedDb);
    seedDb.saveChanges();
    await seedDb.pushChanges({ accessToken, description: "populated seed db" });
  });

  after(async () => {
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, seedDb);
    HubMock.shutdown();
  });

  it("resume old state after partially committed changes", async () => {
    const sourceDb = seedDb;

    const [regularTransformer, regularTarget] = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb2", description: "non crashing target", noLocks: true });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformNoCrash({ sourceDb, targetDb, transformer });
      targetDb.saveChanges();
      return [transformer, targetDb] as const;
    })();

    const [resumedTransformer, resumedTarget] = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb1", description: "crashingTarget", noLocks: true });
      let targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      let changesetId: ChangesetId;
      const dumpPath = IModelTransformerTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
      let transformer = new CountdownTransformer(sourceDb, targetDb);
      // after exporting 10 elements, save and push changes
      transformer.elementExportsUntilCall = 10;
      transformer.callback = async () => {
        targetDb.saveChanges();
        await targetDb.pushChanges({ accessToken, description: "early state save" });
        transformer.saveStateToFile(dumpPath);
        changesetId = targetDb.changeset.id;
        // now after another 10 exported elements, interrupt for resumption
        transformer.elementExportsUntilCall = 10;
        transformer.callback = () => {
          throw Error("interrupt");
        };
      };
      let interrupted = false;
      try {
        await transformer.processSchemas();
        // will trigger the callback after 10 exported elements, which triggers another
        // callback to be installed for after 20 elements, to throw an error to interrupt the transformation
        await transformer.processAll();
      } catch (transformerErr) {
        expect((transformerErr as Error).message).to.equal("interrupt");
        interrupted = true;
        // redownload to simulate restarting without any JS state
        expect(targetDb.nativeDb.hasUnsavedChanges()).to.be.true;
        targetDb.close();
        targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
        expect(targetDb.nativeDb.hasUnsavedChanges()).to.be.false;
        expect(targetDb.changeset.id).to.equal(changesetId!);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const TransformerClass = transformer.constructor as typeof IModelTransformer;
        transformer = TransformerClass.resumeTransformation(dumpPath, sourceDb, targetDb) as CountdownTransformer;
        await transformer.processAll();
        targetDb.saveChanges();
        return [transformer, targetDb] as const;
      }
      expect(interrupted, "should have interrupted rather than completing").to.be.true;
      throw Error("unreachable");
    })();

    const [elemMap, codeSpecMap, aspectMap] = new Array(3).fill(undefined).map(() => new Map<Id64String, Id64String>());
    for (const [className, findMethod, map] of [
      ["bis.Element", "findTargetElementId", elemMap],
      ["bis.CodeSpec", "findTargetCodeSpecId", codeSpecMap],
      ["bis.ElementAspect", "findTargetAspectId", aspectMap],
    ] as const) {
      for await (const [sourceElemId] of sourceDb.query(`SELECT ECInstanceId from ${className}`)) {
        const idInRegular = regularTransformer.context[findMethod](sourceElemId);
        const idInResumed = resumedTransformer.context[findMethod](sourceElemId);
        map.set(idInRegular, idInResumed);
      }
    }

    await assertIdentityTransformation(regularTarget, resumedTarget, {
      findTargetElementId: (id) => elemMap.get(id) ?? Id64.invalid,
      findTargetCodeSpecId: (id) => codeSpecMap.get(id) ?? Id64.invalid,
      findTargetAspectId: (id) => aspectMap.get(id) ?? Id64.invalid,
    });
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, resumedTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, regularTarget);
  });

  it("simple single crash transform resumption", async () => {
    const sourceDbId = await IModelHost.hubAccess.createNewIModel({
      iTwinId,
      iModelName: "sourceDb1",
      description: "a db called sourceDb1",
      noLocks: true,
      version0: seedDb.pathName,
    });
    const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: sourceDbId });

    const crashingTarget = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb1", description: "crashingTarget", noLocks: true });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
      transformer.elementExportsUntilCall = 10;
      await transformWithCrashAndRecover({
        sourceDb, targetDb, transformer, disableCrashing(t) {
          t.elementExportsUntilCall = undefined;
        },
      });
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    const regularTarget = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb2", description: "non crashing target", noLocks: true });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformNoCrash({ sourceDb, targetDb, transformer });
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    await assertIdentityTransformation(regularTarget, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, sourceDb);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, regularTarget);
  });

  it("should fail to resume from an old target", async () => {
    const sourceDbId = await IModelHost.hubAccess.createNewIModel({
      iTwinId,
      iModelName: "sourceDb1",
      description: "a db called sourceDb1",
      noLocks: true,
      version0: seedDb.pathName,
    });
    const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: sourceDbId });

    const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb1", description: "crashingTarget", noLocks: true });
    let targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
    const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
    transformer.elementExportsUntilCall = 10;
    let crashed = false;
    try {
      await transformer.processSchemas();
      await transformer.processAll();
    } catch (transformerErr) {
      expect((transformerErr as Error).message).to.equal("crash");
      crashed = true;
      const dumpPath = IModelTransformerTestUtils.prepareOutputFile(
        "IModelTransformerResumption",
        "transformer-state.db"
      );
      transformer.saveStateToFile(dumpPath);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const TransformerClass = transformer.constructor as typeof IModelTransformer;
      // redownload targetDb so that it is reset to the old state
      targetDb.close();
      targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      expect(
        () => TransformerClass.resumeTransformation(dumpPath, sourceDb, targetDb)
      ).to.throw(/does not have the expected provenance/);
    }

    expect(crashed).to.be.true;
    transformer.dispose();
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, sourceDb);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, targetDb);
    return targetDb;
  });

  /* eslint-disable @typescript-eslint/naming-convention */
  it("should fail to resume from a different(ly named) transformer classes", async () => {
    async function testResumeCrashTransformerWithClasses({
      StartTransformerClass = IModelTransformer,
      StartImporterClass = IModelImporter,
      StartExporterClass = IModelExporter,
      ResumeTransformerClass = StartTransformerClass,
      ResumeImporterClass = StartImporterClass,
      ResumeExporterClass = StartExporterClass,
    }: {
      StartTransformerClass?: typeof IModelTransformer;
      StartImporterClass?: typeof IModelImporter;
      StartExporterClass?: typeof IModelExporter;
      ResumeTransformerClass?: typeof IModelTransformer;
      ResumeImporterClass?: typeof IModelImporter;
      ResumeExporterClass?: typeof IModelExporter;
    } = {}) {
      const sourceDb = seedDb;
      const targetDb = SnapshotDb.createFrom(
        seedDb,
        IModelTransformerTestUtils.prepareOutputFile(
          "IModelTransformerResumption",
          "ResumeDifferentClass.bim"
        )
      );

      const transformer = new StartTransformerClass(new StartExporterClass(sourceDb), new StartImporterClass(targetDb));
      let crashed = false;
      try {
        await transformer.processSchemas();
        await transformer.processAll();
      } catch (transformerErr) {
        expect((transformerErr as Error).message).to.equal("crash");
        crashed = true;
        const dumpPath = IModelTransformerTestUtils.prepareOutputFile(
          "IModelTransformerResumption",
          "transformer-state.db"
        );
        transformer.saveStateToFile(dumpPath);
        expect(() =>
          ResumeTransformerClass.resumeTransformation(
            dumpPath,
            new ResumeExporterClass(sourceDb),
            new ResumeImporterClass(targetDb),
          )
        ).to.throw(/it is not.*valid to resume with a different.*class/);
      }

      expect(crashed).to.be.true;
      transformer.dispose();
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, targetDb);
    }

    class CrashOn2Transformer extends CountdownToCrashTransformer {
      public constructor(...args: ConstructorParameters<typeof CountdownToCrashTransformer>) {
        super(...args);
        this.elementExportsUntilCall = 2;
      }
    }

    class DifferentTransformerClass extends CrashOn2Transformer { }
    class DifferentImporterClass extends IModelImporter { }
    class DifferentExporterClass extends IModelExporter { }

    await testResumeCrashTransformerWithClasses({ StartTransformerClass: CrashOn2Transformer, ResumeTransformerClass: DifferentTransformerClass });
    await testResumeCrashTransformerWithClasses({ StartTransformerClass: CrashOn2Transformer, ResumeImporterClass: DifferentImporterClass });
    await testResumeCrashTransformerWithClasses({ StartTransformerClass: CrashOn2Transformer, ResumeExporterClass: DifferentExporterClass });
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  it("should save custom additional state", async () => {
    class AdditionalStateImporter extends IModelImporter {
      public state1 = "importer";
      protected override getAdditionalStateJson() { return { state1: this.state1 }; }
      protected override loadAdditionalStateJson(additionalState: any) { this.state1 = additionalState.state1; }
    }
    class AdditionalStateExporter extends IModelExporter {
      public state1 = "exporter";
      protected override getAdditionalStateJson() { return { state1: this.state1 }; }
      protected override loadAdditionalStateJson(additionalState: any) { this.state1 = additionalState.state1; }
    }
    class AdditionalStateTransformer extends IModelTransformer {
      public state1 = "default";
      public state2 = 42;
      protected override saveStateToDb(db: SQLiteDb): void {
        super.saveStateToDb(db);
        db.executeSQL("CREATE TABLE additionalState (state1 TEXT, state2 INTEGER)");
        db.saveChanges();
        db.withSqliteStatement(`INSERT INTO additionalState (state1) VALUES (?)`, (stmt) => {
          stmt.bindString(1, this.state1);
          expect(stmt.step()).to.equal(DbResult.BE_SQLITE_DONE);
        });
      }
      protected override loadStateFromDb(db: SQLiteDb): void {
        super.loadStateFromDb(db);
        db.withSqliteStatement(`SELECT state1 FROM additionalState`, (stmt) => {
          expect(stmt.step()).to.equal(DbResult.BE_SQLITE_ROW);
          this.state1 = stmt.getValueString(0);
        });
      }
      protected override getAdditionalStateJson() { return { state2: this.state2 }; }
      protected override loadAdditionalStateJson(additionalState: any) { this.state2 = additionalState.state2; }
    }

    const sourceDb = seedDb;
    const targetDb = SnapshotDb.createEmpty(
      IModelTransformerTestUtils.prepareOutputFile(
        "IModelTransformerResumption",
        "CustomAdditionalState.bim"
      ),
      { rootSubject: { name: "CustomAdditionalStateTest" } }
    );

    const transformer = new AdditionalStateTransformer(new AdditionalStateExporter(sourceDb), new AdditionalStateImporter(targetDb));
    transformer.state1 = "transformer-state-1";
    transformer.state2 = 43;
    (transformer.importer as AdditionalStateImporter).state1 = "importer-state-1";
    (transformer.exporter as AdditionalStateExporter).state1 = "exporter-state-1";

    const dumpPath = IModelTransformerTestUtils.prepareOutputFile(
      "IModelTransformerResumption",
      "transformer-state.db"
    );
    transformer.saveStateToFile(dumpPath);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TransformerClass = transformer.constructor as typeof AdditionalStateTransformer;
    transformer.dispose();
    const resumedTransformer = TransformerClass.resumeTransformation(dumpPath, new AdditionalStateExporter(sourceDb), new AdditionalStateImporter(targetDb));
    expect(resumedTransformer).not.to.equal(transformer);
    expect(resumedTransformer.state1).to.equal(transformer.state1);
    expect(resumedTransformer.state2).to.equal(transformer.state2);
    expect((resumedTransformer.importer as AdditionalStateImporter).state1).to.equal((transformer.importer as AdditionalStateImporter).state1);
    expect((resumedTransformer.exporter as AdditionalStateExporter).state1).to.equal((transformer.exporter as AdditionalStateExporter).state1);

    resumedTransformer.dispose();
    targetDb.close();
  });

  it("should fail to resume from an old target while processing relationships", async () => {
    const sourceDb = seedDb;

    const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb1", description: "crashingTarget", noLocks: true });
    let targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
    const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
    transformer.relationshipExportsUntilCall = 2;
    let crashed = false;
    try {
      await transformer.processSchemas();
      await transformer.processAll();
    } catch (transformerErr) {
      expect((transformerErr as Error).message).to.equal("crash");
      crashed = true;
      const dumpPath = IModelTransformerTestUtils.prepareOutputFile(
        "IModelTransformerResumption",
        "transformer-state.db"
      );
      transformer.saveStateToFile(dumpPath);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const TransformerClass = transformer.constructor as typeof IModelTransformer;
      transformer.dispose();
      // redownload targetDb so that it is reset to the old state
      targetDb.close();
      targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      expect(
        () => TransformerClass.resumeTransformation(dumpPath, sourceDb, targetDb)
      ).to.throw(/does not have the expected provenance/);
    }

    expect(crashed).to.be.true;
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, targetDb);
    return targetDb;
  });

  it("should succeed to resume from an up-to-date target while processing relationships", async () => {
    const sourceDb = seedDb;

    const crashingTarget = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb1", description: "crashingTarget", noLocks: true });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
      transformer.relationshipExportsUntilCall = 2;
      let crashed = false;
      try {
        await transformer.processSchemas();
        await transformer.processAll();
      } catch (transformerErr) {
        expect((transformerErr as Error).message).to.equal("crash");
        crashed = true;
        const dumpPath = IModelTransformerTestUtils.prepareOutputFile(
          "IModelTransformerResumption",
          "transformer-state.db"
        );
        transformer.saveStateToFile(dumpPath);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const TransformerClass = transformer.constructor as typeof CountdownToCrashTransformer;
        TransformerClass.resumeTransformation(dumpPath, sourceDb, targetDb);
        transformer.relationshipExportsUntilCall = undefined;
        await transformer.processAll();
      }

      expect(crashed).to.be.true;
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    const regularTarget = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName: "targetDb2", description: "non crashing target", noLocks: true });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformNoCrash({ sourceDb, targetDb, transformer });
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    await assertIdentityTransformation(regularTarget, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, regularTarget);
  });

  it("processChanges crash and resume", async () => {
    const sourceDbId = await IModelHost.hubAccess.createNewIModel({
      iTwinId,
      iModelName: "sourceDb1",
      description: "a db called sourceDb1",
      noLocks: true,
    });
    const sourceDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: sourceDbId });
    await BackendTestUtils.ExtensiveTestScenario.prepareDb(sourceDb);
    BackendTestUtils.ExtensiveTestScenario.populateDb(sourceDb);
    sourceDb.saveChanges();
    await sourceDb.pushChanges({ accessToken, description: "populated source db" });

    const targetDbRev0Path = IModelTransformerTestUtils.prepareOutputFile("IModelTransformerResumption", "processChanges-targetDbRev0.bim");
    const targetDbRev0 = SnapshotDb.createFrom(sourceDb, targetDbRev0Path);
    const provenanceTransformer = new IModelTransformer(sourceDb, targetDbRev0, { wasSourceIModelCopiedToTarget: true });
    await provenanceTransformer.processAll();
    provenanceTransformer.dispose();
    targetDbRev0.saveChanges();

    BackendTestUtils.ExtensiveTestScenario.updateDb(sourceDb);
    sourceDb.saveChanges();
    await sourceDb.pushChanges({ accessToken, description: "updated source db" });

    const regularTarget = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({
        iTwinId,
        iModelName: "targetDb1",
        description: "non crashing target",
        noLocks: true,
        version0: targetDbRev0Path,
      });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformNoCrash({
        sourceDb, targetDb, transformer,
        async transformerProcessing(t) {
          await t.processChanges(accessToken);
        },
      });
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    const crashingTarget = await (async () => {
      const targetDbId = await IModelHost.hubAccess.createNewIModel({
        iTwinId,
        iModelName: "targetDb2",
        description: "crashing target",
        noLocks: true,
        version0: targetDbRev0Path,
      });
      const targetDb = await HubWrappers.downloadAndOpenBriefcase({ accessToken, iTwinId, iModelId: targetDbId });
      const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
      transformer.elementExportsUntilCall = 10;
      await transformWithCrashAndRecover({
        sourceDb, targetDb, transformer, disableCrashing(t) {
          t.elementExportsUntilCall = undefined;
        }, async transformerProcessing(t) {
          await t.processChanges(accessToken);
        },
      });
      targetDb.saveChanges();
      await targetDb.pushChanges({ accessToken, description: "completed transformation that crashed" });
      transformer.dispose();
      return targetDb;
    })();

    await assertIdentityTransformation(regularTarget, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, sourceDb);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, regularTarget);
  });

  // env variables:
  // TRANSFORMER_RESUMPTION_TEST_SINGLE_MODEL_ELEMENTS_BEFORE_CRASH (defaults to 2_500_000)
  // TRANSFORMER_RESUMPTION_TEST_SINGLE_MODEL_PATH (defaults to the likely invalid "huge-model.bim")
  // change "skip" to "only" to test local models
  it.skip("local test single model", async () => {
    const sourceDb = SnapshotDb.openFile("./huge-model.bim");

    const crashingTarget = await (async () => {
      const targetDbPath = "/tmp/huge-model-out.bim";
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
      transformer.elementExportsUntilCall = Number(process.env.TRANSFORMER_RESUMPTION_TEST_SINGLE_MODEL_ELEMENTS_BEFORE_CRASH) || 2_500_000;
      await transformWithCrashAndRecover({
        sourceDb, targetDb, transformer, disableCrashing(t) {
          t.elementExportsUntilCall = undefined;
        },
      });
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    const regularTarget = await (async () => {
      const targetDbPath = "/tmp/huge-model-out.bim";
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformNoCrash({ sourceDb, targetDb, transformer });
      targetDb.saveChanges();
      transformer.dispose();
      return targetDb;
    })();

    await assertIdentityTransformation(regularTarget, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, crashingTarget);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, regularTarget);
  });

  // replace "skip" with "only" to run several transformations with random native platform and transformer api method errors thrown
  // you may control the amount of tests ran with the following environment variables
  // TRANSFORMER_RESUMPTION_TEST_TOTAL_NON_CRASHING_TRANSFORMATIONS (defaults to 5)
  // TRANSFORMER_RESUMPTION_TEST_TARGET_TOTAL_CRASHING_TRANSFORMATIONS (defaults to 50)
  // TRANSFORMER_RESUMPTION_TEST_MAX_CRASHING_TRANSFORMATIONS (defaults to 200)
  it.skip("crashing transforms stats gauntlet", async () => {
    let crashableCallsMade = 0;
    const { enableCrashes } = setupCrashingNativeAndTransformer({ onCrashableCallMade() { ++crashableCallsMade; } });
    // TODO: don't run a new control test to compare with every crash test,
    // right now trying to run assertIdentityTransform against the control transform target dbs in the control loop yields
    // BE_SQLITE_ERROR: Failed to prepare 'select * from (SELECT ECInstanceId FROM bis.Element) limit :sys_ecdb_count offset :sys_ecdb_offset'. The data source ECDb (parameter 'dataSourceECDb') must be a connection to the same ECDb file as the ECSQL parsing ECDb connection (parameter 'ecdb').
    // until that is investigated/fixed, the slow method here is used
    async function runAndCompareWithControl(crashingEnabledForThisTest: boolean) {
      const sourceFileName = IModelTransformerTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const sourceDb = SnapshotDb.openFile(sourceFileName);

      async function transformWithMultipleCrashesAndRecover() {
        const targetDbPath = IModelTransformerTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationCrash.bim");
        const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
        let transformer = new CountingTransformer({ source: sourceDb, target: targetDb });
        const MAX_ITERS = 100;
        let crashCount = 0;
        let timer: StopWatch;

        enableCrashes(crashingEnabledForThisTest);

        for (let i = 0; i <= MAX_ITERS; ++i) {
          timer = new StopWatch();
          timer.start();
          try {
            await transformer.processSchemas();
            await transformer.processAll();
            break;
          } catch (transformerErr) {
            crashCount++;
            const dumpPath = IModelTransformerTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
            enableCrashes(false);
            transformer.saveStateToFile(dumpPath);
            transformer = CountingTransformer.resumeTransformation(dumpPath, { source: sourceDb, target: targetDb });
            enableCrashes(true);
            crashableCallsMade = 0;
            console.log(`crashed after ${timer.elapsed.seconds} seconds`); // eslint-disable-line no-console
          }
          if (i === MAX_ITERS) assert.fail("crashed too many times");
        }
        console.log(`completed after ${crashCount} crashes`); // eslint-disable-line no-console
        const result = {
          resultDb: targetDb,
          finalTransformationTime: timer!.elapsedSeconds,
          finalTransformationCallsMade: crashableCallsMade,
          crashCount,
          importedEntityCount: transformer.importedEntities,
          exportedEntityCount: transformer.exportedEntities,
        };
        crashableCallsMade = 0;
        return result;
      }

      const { resultDb: crashingTarget, ...crashingTransformResult } = await transformWithMultipleCrashesAndRecover();

      const regularTarget = await (async () => {
        const targetDbPath = IModelTransformerTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationNoCrash.bim");
        const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
        const transformer = new IModelTransformer(sourceDb, targetDb);
        enableCrashes(false);
        return transformNoCrash({ sourceDb, targetDb, transformer });
      })();

      await assertIdentityTransformation(regularTarget, crashingTarget);
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, crashingTarget);
      await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, regularTarget);
      return crashingTransformResult;
    }

    let totalCrashableCallsMade = 0;
    let totalNonCrashingTransformationsTime = 0.0;
    let totalImportedEntities = 0;
    let totalExportedEntities = 0;
    const totalNonCrashingTransformations = Number(process.env.TRANSFORMER_RESUMPTION_TEST_TOTAL_NON_CRASHING_TRANSFORMATIONS) || 5;
    for (let i = 0; i < totalNonCrashingTransformations; ++i) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const result = await runAndCompareWithControl(false);
      totalCrashableCallsMade += result.finalTransformationCallsMade;
      totalNonCrashingTransformationsTime += result.finalTransformationTime;
      totalImportedEntities += result.importedEntityCount;
      totalExportedEntities += result.exportedEntityCount;
    }
    const avgNonCrashingTransformationsTime = totalNonCrashingTransformationsTime / totalNonCrashingTransformations;
    const avgCrashableCallsMade = totalCrashableCallsMade / totalNonCrashingTransformations;
    const avgImportedEntityCount = totalImportedEntities / totalNonCrashingTransformations;
    const avgExportedEntityCount = totalExportedEntities / totalNonCrashingTransformations;

    // eslint-disable-next-line no-console
    console.log(`the average non crashing transformation took ${formatter.format(avgNonCrashingTransformationsTime)} and made ${formatter.format(avgCrashableCallsMade)} native calls.`);

    let totalCrashingTransformationsTime = 0.0;
    const targetTotalCrashingTransformations = Number(process.env.TRANSFORMER_RESUMPTION_TEST_TARGET_TOTAL_CRASHING_TRANSFORMATIONS) || 50;
    const MAX_CRASHING_TRANSFORMS = Number(process.env.TRANSFORMER_RESUMPTION_TEST_MAX_CRASHING_TRANSFORMATIONS) || 200;
    let totalCrashingTransformations = 0;
    for (let i = 0; i < MAX_CRASHING_TRANSFORMS && totalCrashingTransformations < targetTotalCrashingTransformations; ++i) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const result = await runAndCompareWithControl(true);
      if (result.crashCount === 0) continue;
      totalCrashingTransformations++;
      const proportionOfNonCrashingTransformTime = result.finalTransformationTime / avgNonCrashingTransformationsTime;
      const proportionOfNonCrashingTransformCalls = result.finalTransformationCallsMade / avgCrashableCallsMade;
      const proportionOfNonCrashingEntityImports = result.importedEntityCount / avgImportedEntityCount;
      expect(result.exportedEntityCount).to.equal(avgExportedEntityCount);
      const _ratioOfCallsToTime = proportionOfNonCrashingTransformCalls / proportionOfNonCrashingTransformTime;
      const _ratioOfImportsToTime = proportionOfNonCrashingEntityImports / proportionOfNonCrashingTransformTime;
      /* eslint-disable no-console */
      console.log(`final resuming transformation took | ${percent(proportionOfNonCrashingTransformTime)} time | ${percent(proportionOfNonCrashingTransformCalls)} calls | ${percent(proportionOfNonCrashingEntityImports)} element imports |`);
      /* eslint-enable no-console */
      totalCrashingTransformationsTime += result.finalTransformationTime;
    }
    const avgCrashingTransformationsTime = totalCrashingTransformationsTime / totalCrashingTransformations;
    /* eslint-disable no-console */
    console.log(`avg crashable calls made: ${avgCrashableCallsMade}`);
    console.log(`avg non-crashing transformations time: ${avgNonCrashingTransformationsTime}`);
    console.log(`avg crash-resuming+completing transformations time: ${avgCrashingTransformationsTime}`);
    /* eslint-enable no-console */
    sinon.restore();
  });
});
