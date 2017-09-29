/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {ServiceStore} from "../backend/ServiceStore";
import {HubTestUtils} from "./HubTestUtils";
import {BriefcaseAccessMode} from "@bentley/imodeljs-clients";

import { assert, expect } from "chai";

describe("ServiceStore", () => {
  let store: ServiceStore;
  let hub: HubTestUtils;

  before(async () => {
    const { error, result } = await ServiceStore.getInstance();
    if (error)
      throw new Error(error.message);
    store = result!;

    hub = new HubTestUtils();
    await hub.initialize();

    hub.testBriefcase.accessMode = BriefcaseAccessMode.Exclusive;
  });

  after(async () => {
    if (store)
      store.close();
  });

  it("should be able to add a new briefcase into the store", async () => {
    const {error} = await store.insertBriefcase(hub.testBriefcase);
    assert.isUndefined(error);
    assert.isNotNull(hub.testBriefcase.id);
    assert.isString(hub.testBriefcase.id);
    assert.isTrue(hub.testBriefcase.id.length > 0);
  });

  it("should be able to get a briefcase from the store", async () => {
    const { error, result: briefcase } = await
      store.getBriefcase(hub.testIModel.wsgId, undefined, hub.testUserProfile.userId, hub.testBriefcase.accessMode);
    assert.isUndefined(error);
    assert.isDefined(briefcase);
    assert.isNotNull(briefcase);
    expect(briefcase!.briefcaseId).to.equal(hub.testBriefcase.briefcaseId);
    expect(briefcase!.accessMode).to.equal(hub.testBriefcase.accessMode);
    expect(briefcase!.userId).to.equal(hub.testBriefcase.userId);
  });

  it("should be able to check if the store contains a briefcase", async () => {
    const {error, result: contains} = await
      store.containsBriefcase(hub.testIModel.wsgId, undefined, hub.testUserProfile.userId, hub.testBriefcase.accessMode);
    assert.isUndefined(error);
    assert.isTrue(contains);
  });

  it("should be able to delete a briefcase from the store", async () => {
    let { error } = await store.deleteBriefcase(hub.testBriefcase);
    assert.isUndefined(error, error ? error.message : "");

    let contains: boolean|undefined = false;
    ({ error, result: contains } = await
      store.containsBriefcase(hub.testIModel.wsgId, undefined, hub.testUserProfile.userId, hub.testBriefcase.accessMode));
    assert.isUndefined(error);
    assert.isFalse(contains);
  });

});
