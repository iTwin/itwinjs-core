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

/** a transformer that crashes on the nth element export, set `elementExportsUntilCrash` to control the count */
class CountdownToCrashTransformer extends IModelTransformer {
  public elementExportsUntilCrash: number | undefined = 10;
  public override onExportElement(sourceElement: Element): void {
    if (this.elementExportsUntilCrash === 0) throw Error("crash");
    const result = super.onExportElement(sourceElement);
    if (this.elementExportsUntilCrash !== undefined)
      this.elementExportsUntilCrash--;
    return result;
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
  Transformer extends IModelTransformer
>({
  sourceDb,
  targetDb,
  transformer,
  disableCrashing: onResume,
}: {
  sourceDb: IModelDb;
  targetDb: IModelDb;
  transformer: Transformer;
  disableCrashing?: (transformer: Transformer) => void;
}) {
  let crashed = false;
  try {
    await transformer.processSchemas();
    await transformer.processAll();
  } catch (transformerErr) {
    try {
      const dumpPath = IModelTestUtils.prepareOutputFile(
        "IModelTransformerResumption",
        "transformer-state.db"
      );
      const state = transformer.serializeState(dumpPath);
      transformer = (transformer.constructor as typeof IModelTransformer).resumeTransformation(state, sourceDb, targetDb) as Transformer;
      onResume?.(transformer);
      crashed = true;
    } catch (err) {
      assert.fail((err as Error).message);
    }
  }

  expect(crashed).to.be.true;
  return targetDb;
}

async function transformNoCrash<
  Transformer extends IModelTransformer
>(args: {
  sourceDb: IModelDb;
  targetDb: IModelDb;
  transformer: Transformer;
}): Promise<IModelDb> {
  const transformer = new IModelTransformer(args.sourceDb, args.targetDb);
  await transformer.processSchemas();
  await transformer.processAll();
  return args.targetDb;
}

describe("test resuming transformations", () => {
  it("simple single crash transform resumption", async () => {

    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb = SnapshotDb.openFile(sourceFileName);

    const crashingTarget = await (async () => {
      const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationCrash.bim");
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new CountdownToCrashTransformer(sourceDb, targetDb);
      transformer.elementExportsUntilCrash = 10;
      // eslint-disable-next-line @typescript-eslint/no-shadow
      return transformWithCrashAndRecover({sourceDb, targetDb, transformer, disableCrashing(transformer) {
        transformer.elementExportsUntilCrash = undefined;
      }});
    })();

    const regularTarget = await (async () => {
      const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationNoCrash.bim");
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new IModelTransformer(sourceDb, targetDb);
      return transformNoCrash({sourceDb, targetDb, transformer});
    })();

    await assertIdentityTransformation(regularTarget, crashingTarget, { context: { findTargetElementId: (id) => id }});
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
      transformer.elementExportsUntilCrash = Number(process.env.TRANSFORMER_RESUMPTION_TEST_SINGLE_MODEL_ELEMENTS_BEFORE_CRASH) || 2_500_000;
      // eslint-disable-next-line @typescript-eslint/no-shadow
      return transformWithCrashAndRecover({sourceDb, targetDb, transformer, disableCrashing(transformer) {
        transformer.elementExportsUntilCrash = undefined;
      }});
    })();

    const regularTarget = await (async () => {
      const targetDbPath = "/tmp/huge-model-out.bim";
      const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
      const transformer = new IModelTransformer(sourceDb, targetDb);
      return transformNoCrash({sourceDb, targetDb, transformer});
    })();

    await assertIdentityTransformation(regularTarget, crashingTarget, { context: { findTargetElementId: (id) => id }});
  });

  // replace "skip" with "only" to run several transformations with random native platform and transformer api method errors thrown
  // you may control the amount of tests ran with the following environment variables
  // TRANSFORMER_RESUMPTION_TEST_TOTAL_NON_CRASHING_TRANSFORMATIONS (defaults to 5)
  // TRANSFORMER_RESUMPTION_TEST_TARGET_TOTAL_CRASHING_TRANSFORMATIONS (defaults to 50)
  // TRANSFORMER_RESUMPTION_TEST_MAX_CRASHING_TRANSFORMATIONS (defaults to 200)
  it.only("crashing transforms stats gauntlet", async () => {
    let crashableCallsMade = 0;
    const { enableCrashes } = setupCrashingNativeAndTransformer({ onCrashableCallMade() { ++crashableCallsMade; } });

    async function runAndCompareWithControl(crashingEnabledForThisTest: boolean) {
      const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const sourceDb = SnapshotDb.openFile(sourceFileName);

      async function transformWithMultipleCrashesAndRecover() {
        const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationCrash.bim");
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
            try {
              crashCount++;
              const dumpPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "transformer-state.db");
              enableCrashes(false);
              const state = transformer.serializeState(dumpPath);
              transformer = CountingTransformer.resumeTransformation(state, { source: sourceDb, target: targetDb });
              enableCrashes(true);
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

      const { resultDb: crashingTarget, ...crashingTransformResult } = await transformWithMultipleCrashesAndRecover();

      const regularTarget = await (async () => {
        const targetDbPath = IModelTestUtils.prepareOutputFile("IModelTransformerResumption", "ResumeTransformationNoCrash.bim");
        const targetDb = SnapshotDb.createEmpty(targetDbPath, sourceDb);
        const transformer = new IModelTransformer(sourceDb, targetDb);
        enableCrashes(false);
        return transformNoCrash({sourceDb, targetDb, transformer});
      })();

      await assertIdentityTransformation(regularTarget, crashingTarget, { context: { findTargetElementId: (id) => id }});

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
    console.log(`the average non crashing transformation took ${
      formatter.format(avgNonCrashingTransformationsTime)
    } and made ${
      formatter.format(avgCrashableCallsMade)
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
      expect(result.exportedEntityCount ).to.equal(avgExportedEntityCount);
      const _ratioOfCallsToTime = proportionOfNonCrashingTransformCalls / proportionOfNonCrashingTransformTime;
      const _ratioOfImportsToTime = proportionOfNonCrashingEntityImports / proportionOfNonCrashingTransformTime;
      /* eslint-disable no-console */
      console.log(`final resuming transformation took | ${
        percent(proportionOfNonCrashingTransformTime)
      } time | ${
        percent(proportionOfNonCrashingTransformCalls)
      } calls | ${
        percent(proportionOfNonCrashingEntityImports)
      } element imports |`);
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
