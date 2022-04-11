/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Element, IModelDb, IModelHost, IModelJsNative, Relationship, SnapshotDb } from "@itwin/core-backend";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test";
import { Id64String, StopWatch } from "@itwin/core-bentley";
import { ElementProps } from "@itwin/core-common";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { IModelImporter } from "../../IModelImporter";
import { IModelTransformer, IModelTransformOptions } from "../../IModelTransformer";
import { assertIdentityTransformation } from "../IModelTransformerUtils";

describe("test resuming transformations", () => {
  it("simple single crash transform resumption", async () => {
    // here to test that types work when calling resumeTransformation
    class CrashingTransformer extends IModelTransformer {
      public elementExportsUntilCrash = 10;
      public override onExportElement(sourceElement: Element): void {
        if (this.elementExportsUntilCrash === 0) throw Error("crash");
        const result = super.onExportElement(sourceElement);
        this.elementExportsUntilCrash--;
        return result;
      }
    }

    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb = SnapshotDb.openFile(sourceFileName);

    async function transformWithCrashAndRecover() {
      const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationCrash.bim");
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      let transformer = new CrashingTransformer(sourceDb, targetDb);
      let crashed = false;

      try {
        await transformer.processSchemas();
        await transformer.processAll();
      } catch (transformerErr) {
        try {
          const dumpPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
          const state = transformer.serializeState(dumpPath);
          transformer = CrashingTransformer.resumeTransformation(state, sourceDb, targetDb);
          transformer.elementExportsUntilCrash = -1; // do not crash this time
          crashed = true;
        } catch (err) {
          assert.fail((err as Error).message);
        }
      }
      expect(crashed).to.be.true;
      return targetDb;
    }

    async function transformNoCrash(): Promise<IModelDb> {
      const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationNoCrash.bim");
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformer.processSchemas();
      await transformer.processAll();
      return targetDb;
    }

    const crashingTarget = await transformWithCrashAndRecover();
    const regularTarget = await transformNoCrash();

    await assertIdentityTransformation(regularTarget, crashingTarget, { context: { findTargetElementId: (id) => id }});
  });

  // change "skip" to "only" to test some huge local model that is not worth putting in the actual tests
  it.skip("local test", async () => {
    class CrashingTransformer extends IModelTransformer {
      public elementExportsUntilCrash = 2_500_000; // this model has 3 million elements and relationships so this should be a good crash point
      public override onExportElement(sourceElement: Element): void {
        if (this.elementExportsUntilCrash === 0) throw Error("crash");
        const result = super.onExportElement(sourceElement);
        this.elementExportsUntilCrash--;
        return result;
      }
    }

    const sourceDb = SnapshotDb.openFile("/home/mike/shell.bim");

    async function transformWithCrashAndRecover() {
      const targetDbPath = "/tmp/shell-out.bim";
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      let transformer = new CrashingTransformer(sourceDb, targetDb);

      let crashed = false;
      try {
        await transformer.processSchemas();
        await transformer.processAll();
      } catch (transformerErr) {
        try {
          const dumpPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
          const state = transformer.serializeState(dumpPath);
          transformer = CrashingTransformer.resumeTransformation(state, sourceDb, targetDb);
          transformer.elementExportsUntilCrash = -1; // do not crash this time
          crashed = true;
        } catch (err) {
          assert.fail((err as Error).message);
        }
      }

      expect(crashed).to.be.true;

      return targetDb;
    }

    async function transformNoCrash(): Promise<IModelDb> {
      const targetDbPath = "/tmp/shell-out2.bim";
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new IModelTransformer(sourceDb, targetDb);
      await transformer.processSchemas();
      await transformer.processAll();
      return targetDb;
    }

    const crashingTarget = await transformWithCrashAndRecover();
    const regularTarget = await transformNoCrash();

    // TODO: need to make this
    await assertIdentityTransformation(regularTarget, crashingTarget, { context: { findTargetElementId: (id) => id }});
  });

  // replace "skip" with "only" to run several transformations with random native platform and transformer api method errors thrown
  // you may control the amount of tests ran with the following environment variables
  // TRANSFORMER_RESUMPTION_TEST_TOTAL_NON_CRASHING_TRANSFORMATIONS (defaults to 5)
  // TRANSFORMER_RESUMPTION_TEST_TARGET_TOTAL_CRASHING_TRANSFORMATIONS (defaults to 50)
  // TRANSFORMER_RESUMPTION_TEST_MAX_CRASHING_TRANSFORMATIONS (defaults to 200)
  it.only("crashing transforms stats gauntlet", async () => {
    let crashingEnabled = false;
    let crashableCallsMade = 0;

    class CountingImporter extends IModelImporter {
      public owningTransformer: CrashingTransformer | undefined;
      public override importElement(elementProps: ElementProps): Id64String {
        if (this.owningTransformer === undefined)
          throw Error("uninitialized, '_owningTransformer' must have been set before transformations");
        ++this.owningTransformer.importedEntities;
        return super.importElement(elementProps);
      }
    }

    /** this class services two functions,
     * 1. make sure transformations can be resumed by subclasses with different constructor argument types
     * 2. count the operations that are expected to be done less during a transformation
     */
    class CrashingTransformer extends IModelTransformer {
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

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(
      IModelHost.platform
    )) as [keyof typeof IModelHost["platform"], PropertyDescriptor][]) {
      const superValue: unknown = descriptor.value;
      if (typeof superValue === "function" && descriptor.writable) {
        sinon.replace(IModelHost.platform, key, function (this: IModelJsNative.DgnDb, ...args: any[]) {
          crashableCallsMade++;
          if (crashingEnabled) {
            const METHOD_CRASH_PROBABILITY = 1/800;
            // this does not at all test mid-method crashes... that might be doable by racing timeouts on async functions...
            if (crashingEnabled && Math.random() <= METHOD_CRASH_PROBABILITY) throw Error("fake native crash");
          }
          const isConstructor = (o: Function): o is new(...a: any[]) => any => "prototype" in o;
          if (isConstructor(superValue))
            return new superValue(...args);
          else return superValue.call(this, ...args);
        });
      }
    }

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(
      IModelTransformer.prototype
    )) as [keyof IModelTransformer, PropertyDescriptor][]) {
      const superValue: unknown = descriptor.value;
      if (typeof superValue === "function" && descriptor.writable) {
        sinon.replace(IModelTransformer.prototype, key, function (this: IModelTransformer, ...args: any[]) {
          crashableCallsMade++;
          if (crashingEnabled) {
            const METHOD_CRASH_PROBABILITY = 1/800;
            // this does not at all test mid-method crashes... that might be doable by racing timeouts on async functions...
            if (crashingEnabled && Math.random() <= METHOD_CRASH_PROBABILITY) throw Error("fake crash");
          }
          return superValue.call(this, ...args);
        });
      }
    }

    async function runAndCompareWithControl(crashingEnabledForThisTest: boolean) {
      const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const sourceDb = SnapshotDb.openFile(sourceFileName);

      async function transformWithCrashAndRecover() {
        const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationCrash.bim");
        const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
        let transformer = new CrashingTransformer({ source: sourceDb, target: targetDb });
        const MAX_ITERS = 100;
        let crashCount = 0;
        let timer: StopWatch;

        crashingEnabled = crashingEnabledForThisTest;

        for (let i = 0; i <= MAX_ITERS; ++i) {
          timer = new StopWatch();
          timer.start();
          try {
            await transformer.processSchemas();
            await transformer.processAll();
            break;
          } catch (transformerErr) {
            try {
              crashCount++;
              const dumpPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
              crashingEnabled = false;
              const state = transformer.serializeState(dumpPath);
              transformer = CrashingTransformer.resumeTransformation(state, { source: sourceDb, target: targetDb });
              crashingEnabled = true;
              crashableCallsMade = 0;
              console.log(`crashed after ${timer.elapsed.seconds} seconds`); // eslint-disable-line no-console
            } catch (err) {
              assert.fail((err as Error).message);
            }
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

      async function transformNoCrash(): Promise<IModelDb> {
        crashingEnabled = false;
        const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationNoCrash.bim");
        const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
        const transformer = new IModelTransformer(sourceDb, targetDb);
        await transformer.processSchemas();
        await transformer.processAll();
        return targetDb;
      }

      const { resultDb: crashingTarget, ...crashingTransformResult } = await transformWithCrashAndRecover();
      const regularTarget = await transformNoCrash();

      await assertIdentityTransformation(regularTarget, crashingTarget, { context: { findTargetElementId: (id) => id }});
      return crashingTransformResult;
    }

    const fmtter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

    const percent = (n: number) => `${fmtter.format(100 * n)}%`;

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
    console.log(`the average non crashing transformation took ${
      fmtter.format(avgNonCrashingTransformationsTime)
    } and made ${
      fmtter.format(avgCrashableCallsMade)
    } native calls.`);

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
      const _proportionOfNonCrashingEntityExports = result.importedEntityCount / avgExportedEntityCount;
      const ratioOfCallsToTime = proportionOfNonCrashingTransformCalls / proportionOfNonCrashingTransformTime;
      /* eslint-disable no-console */
      console.log(`final resuming transformation took | ${
        percent(proportionOfNonCrashingTransformTime)
      } as much time  | ${
        percent(proportionOfNonCrashingTransformCalls)
      } as many calls | ${
        percent(proportionOfNonCrashingEntityImports)
      } as many imported elements |`);
      console.log(`ratio of call/time proportions when resumes is: ${ratioOfCallsToTime}`);
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
