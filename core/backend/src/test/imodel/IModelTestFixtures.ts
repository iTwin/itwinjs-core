/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { DbResult, IModelStatus } from "@itwin/core-bentley";
import { EntityProps, IModelError } from "@itwin/core-common";
import { Entity, SnapshotDb } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelTestUtils } from "../IModelTestUtils";

/** Awaits a promise and returns the {@link IModelError} it rejected with, or `undefined` if it resolved. */
export async function getIModelError<T>(promise: Promise<T>): Promise<IModelError | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err instanceof IModelError ? err : undefined;
  }
}

/** Asserts that `error` is an {@link IModelError} carrying the expected error number. */
export function expectIModelError(expectedErrorNumber: IModelStatus | DbResult, error: IModelError | undefined): void {
  expect(error).not.to.be.undefined;
  expect(error).instanceof(IModelError);
  expect(error!.errorNumber).to.equal(expectedErrorNumber);
}

/** Roundtrip an entity through a JSON string and back to a new entity, asserting the serialization is stable. */
export function roundtripThroughJson(entity1: Entity): Entity {
  const string1 = JSON.stringify(entity1);
  const props1 = JSON.parse(string1) as EntityProps;
  const entity2 = new (entity1.constructor as any)(props1, entity1.iModel); // create a new entity from the EntityProps
  const string2 = JSON.stringify(entity2);
  assert.equal(string1, string2);
  return entity2;
}

/**
 * Create a fresh writable snapshot from a seed asset and import the `TestBim` schema into it.
 * Use this for tests that mutate the iModel so each gets its own isolated copy.
 */
export async function generateTestSnapshot(targetFileName: string, seedAssetName: string): Promise<SnapshotDb> {
  const seedFile = IModelTestUtils.resolveAssetFile(seedAssetName);
  const snapshotFile = IModelTestUtils.prepareOutputFile("IModel", targetFileName);
  const imodel = IModelTestUtils.createSnapshotFromSeed(snapshotFile, seedFile);
  const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
  await imodel.importSchemas([schemaPathname]);
  return imodel;
}

/**
 * Create a fresh writable snapshot copied from a seed asset. Use in `beforeEach` for mutating
 * tests (hybrid isolation) so state never leaks between tests.
 */
export function createIModelFromSeed(targetFileName: string, seedAssetName: string): SnapshotDb {
  const seedFile = IModelTestUtils.resolveAssetFile(seedAssetName);
  const snapshotFile = IModelTestUtils.prepareOutputFile("IModel", targetFileName);
  return IModelTestUtils.createSnapshotFromSeed(snapshotFile, seedFile);
}

/** Open a seed asset directly as a read-only snapshot. Use for shared, pure-read fixtures. */
export function openSeedReadonly(seedAssetName: string): SnapshotDb {
  return SnapshotDb.openFile(IModelTestUtils.resolveAssetFile(seedAssetName));
}

/**
 * Create a fresh writable copy from a seed asset, close it, and reopen it read-only.
 *
 * This is the canonical way to build a shared, per-file read-only fixture under the hybrid
 * isolation policy: the read-only handle can be shared safely across tests in a file because
 * nothing can mutate it, while each mutating test still gets its own writable copy elsewhere.
 * When `importTestBim` is set, the `TestBim` schema is imported into the writable copy before
 * it is reopened read-only.
 */
export async function openReadonlySeedCopy(targetFileName: string, seedAssetName: string, opts?: { importTestBim?: boolean }): Promise<SnapshotDb> {
  const writable = opts?.importTestBim
    ? await generateTestSnapshot(targetFileName, seedAssetName)
    : createIModelFromSeed(targetFileName, seedAssetName);
  const pathName = writable.pathName;
  writable.close();
  return SnapshotDb.openFile(pathName);
}

/** Close each provided database that is still open. Guards against `undefined` and already-closed handles. */
export function closeIfOpen(...dbs: Array<SnapshotDb | undefined>): void {
  for (const db of dbs) {
    if (db !== undefined && db.isOpen)
      db.close();
  }
}

/**
 * Create a tracker for the writable iModels a test file opens, so they are all closed during teardown.
 *
 * This is the mechanism that enforces the hybrid isolation policy for mutating tests: each test wraps
 * its freshly-created writable copy in `trackMutableIModel(...)`, and the file's `afterEach`/`after`
 * calls `closeTrackedIModels()` to close and forget them. `closeTrackedIModels` is idempotent, so it is
 * safe to call from both hooks.
 */
export function createMutableIModelTracker(): {
  trackMutableIModel: <T extends SnapshotDb>(imodel: T) => T;
  closeTrackedIModels: () => void;
} {
  const tracked: SnapshotDb[] = [];
  return {
    trackMutableIModel: (imodel) => {
      tracked.push(imodel);
      return imodel;
    },
    closeTrackedIModels: () => {
      closeIfOpen(...tracked.splice(0));
    },
  };
}
