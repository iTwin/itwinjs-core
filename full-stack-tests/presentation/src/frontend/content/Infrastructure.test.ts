/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { BeDuration, BeTimePoint, Id64 } from "@itwin/core-bentley";
import { ContentSpecificationTypes, InstanceKey, KeySet, PresentationError, PresentationStatus, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("waits for frontend timeout when request exceeds the backend timeout time", ({ getDefaultSuiteIModel }) => {
  let raceStub: sinon.SinonStub<[readonly unknown[]], Promise<unknown>>;
  const frontendTimeout = 50;

  beforeEach(async () => {
    await terminate();
    await initialize({
      // this defaults to 0, which means "no timeouts" - reinitialize with something else
      backendTimeout: 1,
      frontendTimeout,
    });

    // mock `Promise.race` to always reject
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const realRace = Promise.race;
    const rejectedPromise = Promise.reject();
    raceStub = sinon.stub(Promise, "race").callsFake(async (values) => {
      (values as Array<Promise<any>>).splice(0, 0, rejectedPromise);
      return realRace.call(Promise, values);
    });
  });

  afterEach(async () => {
    raceStub.restore();
  });

  it("should throw PresentationError", async () => {
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
    await expect(Presentation.presentation.getContentDescriptor({ imodel: await getDefaultSuiteIModel(), rulesetOrId: ruleset, keys, displayType: "Grid" }))
      .to.be.eventually.rejectedWith(PresentationError)
      .and.have.property("errorNumber", PresentationStatus.BackendTimeout);
    expect(BeTimePoint.now().milliseconds).to.be.greaterThanOrEqual(start.plus(BeDuration.fromMilliseconds(frontendTimeout)).milliseconds);
  });
});
