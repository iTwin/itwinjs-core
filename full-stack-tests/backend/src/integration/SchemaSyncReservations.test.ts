/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb, BriefcaseManager, ChannelControl, CloudSqlite, DrawingCategory, IModelHost, LineStyle, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations, withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { BriefcaseIdValue, IModel } from "@itwin/core-common";
import { assert, expect } from "chai";
import { Suite } from "mocha";
import { AzuriteTest } from "./AzuriteTest";

const storageType = "azure";

async function initializeContainer(containerProps: { containerId: string, isPublic?: boolean, baseUri: string }) {
  await AzuriteTest.Sqlite.createAzContainer(containerProps);
  const accessToken = await CloudSqlite.requestToken({ ...containerProps });
  await SchemaSync.CloudAccess.initializeDb({ ...containerProps, accessToken, storageType });
  return { ...containerProps, accessToken, storageType } as const;
}

type TestContainerProps = Awaited<ReturnType<typeof initializeContainer>>;

interface TestIModel {
  containerProps: TestContainerProps;
  iTwinId: string;
  iModelId: string;
}

/**
 * Full-stack concurrency tests for the SchemaSync definition-element reservation feature.
 *
 * Unlike the standalone unit tests (SchemaSyncDb.test.ts / SchemaSyncDefinitionReservation.test.ts),
 * these run against an Azurite-emulated cloud container so that the CloudSqlite write-lock actually
 * serializes concurrent reservations from multiple briefcases (simulated users).
 */
describe("SchemaSync definition-element reservations (concurrent users)", function (this: Suite) {
  this.timeout(0);

  const openBriefcases: BriefcaseDb[] = [];
  let containerSeq = 0;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  beforeEach(() => {
    HubMock.startup("schemaSyncReservations", KnownTestLocations.outputDir);
  });

  afterEach(() => {
    for (const bc of openBriefcases) {
      try {
        bc.close();
      } catch {
        // best-effort cleanup
      }
    }
    openBriefcases.length = 0;
    HubMock.shutdown();
  });

  // Create a fresh iModel + a fresh, uniquely-named SchemaSync container for a single test.
  const createTestIModel = async (): Promise<TestIModel> => {
    const containerId = `imodel-sync-reservations-${++containerSeq}`;
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId });
    const iTwinId = Guid.createValue();
    const version0 = IModelTestUtils.prepareOutputFile("schemaSyncReservations", `${containerId}.bim`);
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "reservationTest" } }).close();
    const iModelId = await HubMock.createNewIModel({ accessToken: "admin token", iTwinId, version0, iModelName: containerId });
    return { containerProps, iTwinId, iModelId };
  };

  const openBriefcase = async (ctx: TestIModel, accessToken: AccessToken, cacheName: string): Promise<BriefcaseDb> => {
    const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId: ctx.iModelId, iTwinId: ctx.iTwinId, accessToken });
    const bc = await BriefcaseDb.open(bcProps);
    SchemaSync.setTestCache(bc, cacheName);
    bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    openBriefcases.push(bc);
    return bc;
  };

  // Enable SchemaSync on the very first briefcase. `initializeForIModel` pushes the enabling changeset
  // and (correctly) re-initializes this briefcase's ReservationControl, so `first` can reserve immediately.
  const enableSchemaSyncOnFirst = async (first: BriefcaseDb, ctx: TestIModel): Promise<void> => {
    await SchemaSync.initializeForIModel({ iModel: first, containerProps: ctx.containerProps });
    assert.isTrue(SchemaSync.isEnabled(first));
  };

  // Enable SchemaSync on another briefcase by pulling the enabling changeset.
  const enableSchemaSyncViaPull = async (bc: BriefcaseDb, accessToken: AccessToken): Promise<void> => {
    await bc.pullChanges({ accessToken });
    assert.isTrue(SchemaSync.isEnabled(bc));
  };

  // A DrawingCategory reservation identity. Using the same `name` yields the same Code (for conflict tests).
  const catReservation = (bc: BriefcaseDb, federationGuid: GuidString, name: string) => ({
    federationGuid,
    classFullName: DrawingCategory.classFullName,
    code: DrawingCategory.createCode(bc, IModel.dictionaryId, name),
  });

  // A LineStyle reservation identity. Using the same `name` yields the same Code (for conflict tests).
  const styleReservation = (bc: BriefcaseDb, federationGuid: GuidString, name: string) => ({
    federationGuid,
    classFullName: LineStyle.classFullName,
    code: LineStyle.createCode(bc, IModel.dictionaryId, name),
  });

  // Insert a DrawingCategory whose federationGuid was previously reserved. The DefinitionElement insert
  // hook resolves the reservation and forces the element id to be the reserved id. Returns that id.
  const insertReservedCategory = async (bc: BriefcaseDb, federationGuid: GuidString, name: string): Promise<Id64String> => {
    await bc.locks.acquireLocks({ shared: IModel.dictionaryId });
    return withEditTxn(bc, (txn) => txn.insertElement({
      classFullName: DrawingCategory.classFullName,
      model: IModel.dictionaryId,
      code: DrawingCategory.createCode(bc, IModel.dictionaryId, name),
      federationGuid,
    }));
  };

  // Insert a LineStyle whose federationGuid was previously reserved. The DefinitionElement insert
  // hook resolves the reservation and forces the element id to be the reserved id. Returns that id.
  const insertReservedLineStyle = async (bc: BriefcaseDb, federationGuid: GuidString, name: string): Promise<Id64String> => {
    await bc.locks.acquireLocks({ shared: IModel.dictionaryId });
    return withEditTxn(bc, (txn) => txn.insertElement({
      classFullName: LineStyle.classFullName,
      model: IModel.dictionaryId,
      code: LineStyle.createCode(bc, IModel.dictionaryId, name),
      federationGuid,
    }));
  };

  const isReservedId = (id: Id64String) => Id64.getBriefcaseId(id) === BriefcaseIdValue.SchemaSyncDefinitionReserved;

  describe("container-level concurrency", () => {
    it("allocates distinct, contiguous ids when two briefcases reserve different definitions concurrently", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guidA = Guid.createValue();
      const guidB = Guid.createValue();

      // Both reserves race for the container write lock; the lock serializes them.
      await Promise.all([
        b1.reservations.reserveDefinitionElements({ elements: [styleReservation(b1, guidA, "PT-A")] }),
        b2.reservations.reserveDefinitionElements({ elements: [styleReservation(b2, guidB, "PT-B")] }),
      ]);

      const idA = await insertReservedLineStyle(b1, guidA, "PT-A");
      const idB = await insertReservedLineStyle(b2, guidB, "PT-B");

      expect(idA).to.not.equal(idB);
      expect(isReservedId(idA)).to.be.true;
      expect(isReservedId(idB)).to.be.true;
      // The two reservations came from a single shared counter, so their local ids are adjacent.
      expect(Math.abs(Id64.getLocalId(idA) - Id64.getLocalId(idB))).to.equal(1);
    });

    it("is idempotent when two briefcases reserve the same identity concurrently", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guid = Guid.createValue();
      const identity1 = catReservation(b1, guid, "Shared-Cat");
      const identity2 = catReservation(b2, guid, "Shared-Cat");

      // Same federationGuid + class + code from both users: whole batch must converge on one reservation.
      await Promise.all([
        b1.reservations.reserveDefinitionElements({ elements: [identity1] }),
        b2.reservations.reserveDefinitionElements({ elements: [identity2] }),
      ]);

      // Both briefcases now see the reservation (b2 via a fresh sync).
      expect(b1.reservations.needsDefinitionReservation(guid)).to.be.false;
      await b2.initializeReservationControl();
      expect(b2.reservations.needsDefinitionReservation(guid)).to.be.false;

      // Only one element id was allocated: inserting on either briefcase yields the same reserved id.
      const id = await insertReservedCategory(b1, guid, "Shared-Cat");
      expect(isReservedId(id)).to.be.true;
    });

    it("rejects one caller when two briefcases reserve the same Code for different definitions", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guidA = Guid.createValue();
      const guidB = Guid.createValue();

      // Different federationGuids but the SAME Code ("Dup-Cat"). The container enforces Code uniqueness,
      // so exactly one caller wins and the other is rejected.
      const results = await Promise.allSettled([
        b1.reservations.reserveDefinitionElements({ elements: [catReservation(b1, guidA, "Dup-Cat")] }),
        b2.reservations.reserveDefinitionElements({ elements: [catReservation(b2, guidB, "Dup-Cat")] }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).to.have.length(1);
      expect(rejected).to.have.length(1);

      // Exactly one of the two federationGuids ended up reserved.
      await b1.initializeReservationControl();
      const reservedA = !b1.reservations.needsDefinitionReservation(guidA);
      const reservedB = !b1.reservations.needsDefinitionReservation(guidB);
      expect(reservedA).to.not.equal(reservedB);
    });

    it("preserves counter integrity under concurrent batch reservations", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const batch1 = [0, 1, 2].map((i) => ({ guid: Guid.createValue(), name: `Batch1-Cat-${i}` }));
      const batch2 = [0, 1, 2].map((i) => ({ guid: Guid.createValue(), name: `Batch2-Cat-${i}` }));

      await Promise.all([
        b1.reservations.reserveDefinitionElements({ elements: batch1.map((e) => catReservation(b1, e.guid, e.name)) }),
        b2.reservations.reserveDefinitionElements({ elements: batch2.map((e) => catReservation(b2, e.guid, e.name)) }),
      ]);

      const ids: Id64String[] = [];
      for (const e of batch1)
        ids.push(await insertReservedCategory(b1, e.guid, e.name));
      for (const e of batch2)
        ids.push(await insertReservedCategory(b2, e.guid, e.name));

      const localIds = ids.map((id) => Id64.getLocalId(id));
      // No lost updates: 6 distinct, gap-free local ids from the single shared counter.
      expect(new Set(localIds).size).to.equal(localIds.length);
      // There are 6 ids, so the range (max - min) must be 5. Each category insert triggers a second insert for its default subcategory,
      // so the range is actually 10 (5 * 2).
      expect(Math.max(...localIds) - Math.min(...localIds)).to.equal((localIds.length - 1) * 2);
      ids.forEach((id) => expect(isReservedId(id)).to.be.true);
    });

    it("makes a reservation visible to another briefcase without pulling changesets", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guidA = Guid.createValue();
      await b1.reservations.reserveDefinitionElements({ elements: [catReservation(b1, guidA, "Visible-Cat")] });

      // b2 learns about the reservation straight from the container (fresh sync), no changeset involved.
      await b2.initializeReservationControl();
      expect(b2.reservations.needsDefinitionReservation(guidA)).to.be.false;
      expect(b2.reservations.needsDefinitionReservation(Guid.createValue())).to.be.true;
    });
  });

  describe("end-to-end id-collision avoidance", () => {
    it("gives independently-reserved definitions globally-unique ids across briefcases", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guidA = Guid.createValue();
      const guidB = Guid.createValue();

      // b1 reserves + inserts + pushes.
      await b1.reservations.reserveDefinitionElements({ elements: [catReservation(b1, guidA, "Cat-A")] });
      const idA = await insertReservedCategory(b1, guidA, "Cat-A");
      await b1.pushChanges({ accessToken: "token 1", description: "insert Cat-A" });

      // b2 pulls b1's change, then reserves + inserts + pushes its own definition.
      await b2.pullChanges({ accessToken: "token 2" });
      expect(b2.elements.tryGetElementProps(idA)).to.not.be.undefined;
      await b2.reservations.reserveDefinitionElements({ elements: [catReservation(b2, guidB, "Cat-B")] });
      const idB = await insertReservedCategory(b2, guidB, "Cat-B");
      await b2.pushChanges({ accessToken: "token 2", description: "insert Cat-B" });

      // b1 pulls b2's change; both definitions coexist with distinct reserved ids and no code/id conflict.
      await b1.pullChanges({ accessToken: "token 1" });
      expect(idA).to.not.equal(idB);
      expect(isReservedId(idA)).to.be.true;
      expect(isReservedId(idB)).to.be.true;
      expect(b1.elements.tryGetElementProps(idB)).to.not.be.undefined;
    });

    it("resolves the same reserved id on every briefcase for a shared definition", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guid = Guid.createValue();

      // b1 reserves + inserts the definition; the element takes the reserved id.
      await b1.reservations.reserveDefinitionElements({ elements: [catReservation(b1, guid, "Shared-Def")] });
      const idOnB1 = await insertReservedCategory(b1, guid, "Shared-Def");
      expect(isReservedId(idOnB1)).to.be.true;

      // Before pulling b1's change, b2 re-reserves the same identity idempotently and would insert with the
      // SAME reserved id — proving both users pick the same id, so their offline inserts cannot collide.
      await b2.reservations.reserveDefinitionElements({ elements: [catReservation(b2, guid, "Shared-Def")] });
      const idOnB2 = await insertReservedCategory(b2, guid, "Shared-Def");
      expect(idOnB2).to.equal(idOnB1);
    });
  });

  describe("write-lock contention", () => {
    it("serializes concurrent reservations from three briefcases with no lost ids", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      const b3 = await openBriefcase(ctx, "token 3", "briefcase3");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");
      await enableSchemaSyncViaPull(b3, "token 3");

      const entries = [
        { bc: b1, guid: Guid.createValue(), name: "Contend-A" },
        { bc: b2, guid: Guid.createValue(), name: "Contend-B" },
        { bc: b3, guid: Guid.createValue(), name: "Contend-C" },
      ];

      // Three users hammer the write lock at once; all must succeed exactly once.
      await Promise.all(entries.map(async (e) => e.bc.reservations.reserveDefinitionElements({ elements: [styleReservation(e.bc, e.guid, e.name)] })));

      const ids: Id64String[] = [];
      for (const e of entries)
        ids.push(await insertReservedLineStyle(e.bc, e.guid, e.name));

      const localIds = ids.map((id) => Id64.getLocalId(id));
      expect(new Set(localIds).size).to.equal(3);
      expect(Math.max(...localIds) - Math.min(...localIds)).to.equal(2);
      ids.forEach((id) => expect(isReservedId(id)).to.be.true);
    });
  });

  // A briefcase that gets SchemaSync enabled by a *pull* (rather than by `initializeForIModel`) must have its
  // ReservationControl re-initialized automatically: it was created as a no-op at open, before SchemaSync was
  // enabled. `IModelDb.pullChanges` detects that transition and rebuilds the control.
  describe("pull that enables SchemaSync activates the ReservationControl", () => {
    it("reserves through a briefcase that enabled SchemaSync via pull", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      // Sanity check: b2 has no reservations yet, and its control is a no-op because SchemaSync was not enabled at open.
      // This is expected as b2 is not be writable yet: an **exclusive** schema lock was required by b1's enabling changeset,
      // therefore b2 can only acquire a **shared** schema lock (needed for _any_ edit) after pulling said changeset
      const guid = Guid.createValue();
      expect(b2.reservations.needsDefinitionReservation(guid)).to.be.false;

      // The pull should reinitialize b2's control, so it reports the definition as needing a reservation...
      await enableSchemaSyncViaPull(b2, "token 2");
      expect(b2.reservations.needsDefinitionReservation(guid)).to.be.true;

      // ...and reserveDefinitionElements reaches the container, so b1 sees the reservation after a fresh sync.
      await b2.reservations.reserveDefinitionElements({ elements: [catReservation(b2, guid, "Pull-Cat")] });
      await b1.initializeReservationControl();
      expect(b1.reservations.needsDefinitionReservation(guid)).to.be.false;
    });

    it("uses the reserved id when inserting through a pull-enabled briefcase", async () => {
      const ctx = await createTestIModel();
      const b1 = await openBriefcase(ctx, "token 1", "briefcase1");
      const b2 = await openBriefcase(ctx, "token 2", "briefcase2");
      await enableSchemaSyncOnFirst(b1, ctx);
      await enableSchemaSyncViaPull(b2, "token 2");

      const guid = Guid.createValue();
      // The rebuilt control makes the insert hook resolve the reservation and force the reserved id.
      await b2.reservations.reserveDefinitionElements({ elements: [catReservation(b2, guid, "Pull-Insert-Cat")] });
      const id = await insertReservedCategory(b2, guid, "Pull-Insert-Cat");
      expect(isReservedId(id)).to.be.true;
    });
  });
});
