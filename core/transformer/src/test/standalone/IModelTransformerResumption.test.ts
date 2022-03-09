/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Element, IModelDb, IModelHost, IModelJsNative, SnapshotDb } from "@itwin/core-backend";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test";
import { StopWatch } from "@itwin/core-bentley";
import { assert } from "chai";
import * as sinon from "sinon";
import { IModelTransformer, IModelTransformOptions } from "../../IModelTransformer";
import { assertIdentityTransformation } from "../IModelTransformerUtils";

describe.only("test resuming transformations", () => {
  it("simple single crash transform resumption", async () => {
    // here to test that types work when calling resumeTransformation
    class CrashingTransformer extends IModelTransformer {
      private _nonCrashingCallsLeft = 10;
      public override onExportElement(sourceElement: Element): void {
        if (this._nonCrashingCallsLeft === 0) throw Error("crash");
        const result = super.onExportElement(sourceElement);
        this._nonCrashingCallsLeft--;
        return result;
      }
    }

    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb = SnapshotDb.openFile(sourceFileName);

    async function transformWithCrashAndRecover() {
      const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationCrash.bim");
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      let transformer = new CrashingTransformer(sourceDb, targetDb);

      try {
        await transformer.processSchemas();
        await transformer.processAll();
      } catch (transformerErr) {
        try {
          const dumpPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
          const state = transformer.serializeState(dumpPath);
          transformer = CrashingTransformer.resumeTransformation(state, sourceDb, targetDb);
        } catch (err) {
          assert.fail((err as Error).message);
        }
      }
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

  // replace "skip" with "only" to run several transformations with random native platform and transformer api method errors thrown
  it.skip("crashing transforms stats gauntlet", async () => {
    let crashingEnabled = false;
    let crashableCallsMade = 0;

    // here to test that types work when calling resumeTransformation
    class CrashingTransformer extends IModelTransformer {
      constructor(opts: {
        source: IModelDb;
        target: IModelDb;
        options?: IModelTransformOptions;
      }) {
        super(opts.source, opts.target, opts.options);
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
    const totalNonCrashingTransformations = 5;
    for (let i = 0; i < totalNonCrashingTransformations; ++i) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const { finalTransformationTime, finalTransformationCallsMade } = await runAndCompareWithControl(false);
      totalCrashableCallsMade += finalTransformationCallsMade;
      totalNonCrashingTransformationsTime += finalTransformationTime;
    }
    const avgNonCrashingTransformationsTime = totalNonCrashingTransformationsTime / totalNonCrashingTransformations;
    const avgCrashableCallsMade = totalCrashableCallsMade / totalNonCrashingTransformations;

    let totalCrashingTransformationsTime = 0.0;
    const totalCrashingTransformations = 50;
    for (let i = 0; i < totalCrashingTransformations; ++i) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const { finalTransformationTime, finalTransformationCallsMade } = await runAndCompareWithControl(true);
      const proportionOfNonCrashingTransformTime = finalTransformationTime / avgNonCrashingTransformationsTime;
      const proportionOfNonCrashingTransformCalls = finalTransformationCallsMade / avgCrashableCallsMade;
      const ratioOfCallsToTime = proportionOfNonCrashingTransformCalls / proportionOfNonCrashingTransformTime;
      /* eslint-disable no-console */
      console.log(`the finishing resuming transformation took ${
        percent(proportionOfNonCrashingTransformTime)
      } as much time as a regular transform and made ${
        percent(proportionOfNonCrashingTransformCalls)
      } the amount of transformation and native calls.`);
      console.log(`ratio of call/time proportions when resumes is: ${ratioOfCallsToTime}`);
      /* eslint-enable no-console */
      totalCrashingTransformationsTime += finalTransformationTime;
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
