/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { assert, BeDuration, BeTimePoint, Id64 } from "@itwin/core-bentley";
import { ContentSpecificationTypes, InstanceKey, KeySet, PresentationError, PresentationStatus, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { collect } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Error handling", ({ getDefaultSuiteIModel }) => {
  const frontendTimeout = 50;

  before(async () => {
    await terminate();
    await initialize({
      // this defaults to 0, which means "no timeouts" - reinitialize with non-zero
      backendTimeout: 9999,
      frontendTimeout,
    });
  });

  async function withRejectingPromiseRace(cb: () => Promise<void>) {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const realRace = Promise.race;
    // mock `Promise.race` to always reject
    const raceStub = sinon.stub(Promise, "race").callsFake(async (values) => {
      (values as Array<Promise<any>>).splice(0, 0, Promise.reject());
      return realRace.call(Promise, values);
    });
    try {
      await cb();
    } finally {
      raceStub.restore();
    }
  }

  it("waits for frontend timeout when request exceeds the backend timeout time", async () => {
    const ruleset: Ruleset = {
      id: "test",
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        },
      ],
    };
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);
    const start = BeTimePoint.now();
    await withRejectingPromiseRace(async () => {
      await expect(Presentation.presentation.getContentDescriptor({ imodel: await getDefaultSuiteIModel(), rulesetOrId: ruleset, keys, displayType: "Grid" }))
        .to.be.eventually.rejectedWith(PresentationError)
        .and.have.property("errorNumber", PresentationStatus.BackendTimeout);
    });
    expect(BeTimePoint.now().milliseconds).to.be.greaterThanOrEqual(start.plus(BeDuration.fromMilliseconds(frontendTimeout)).milliseconds);
  });

  it("throws a timeout error when iterator request exceeds the backend timeout time", async () => {
    const ruleset: Ruleset = {
      id: "test",
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        },
      ],
    };
    const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
    const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
    const keys = new KeySet([key1, key2]);
    const result = await Presentation.presentation.getContentIterator({
      imodel: await getDefaultSuiteIModel(),
      rulesetOrId: ruleset,
      keys,
      descriptor: {},
      batchSize: 1,
      maxParallelRequests: 100,
    });
    assert(!!result);
    await withRejectingPromiseRace(async () => {
      await expect(collect(result.items)).to.eventually.be.rejectedWith(PresentationError).and.have.property("errorNumber", PresentationStatus.BackendTimeout);
    });
  });
});
