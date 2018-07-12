/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as faker from "faker";
import { NativePlatformRegistry, IModelHost, IModelDb } from "@bentley/imodeljs-backend";
import { NativeECPresentationManager, NativeECPresentationStatus } from "@bentley/imodeljs-backend/lib/imodeljs-native-platform-api";
import { ECPresentationError, SettingValueTypes } from "@common/index";
import "@helpers/Snapshots";
import "@helpers/Promises";
import "./IModeHostSetup";
import { NativePlatformDefinition, createDefaultNativePlatform } from "@src/NativePlatform";

describe("default NativePlatform", () => {

  let nativePlatform: NativePlatformDefinition;
  const addonMock = moq.Mock.ofType<NativeECPresentationManager>();

  beforeEach(() => {
    IModelHost.shutdown();
    try {
      IModelHost.startup();
    } catch (e) {
      let isLoaded = false;
      try {
        NativePlatformRegistry.getNativePlatform();
        isLoaded = true;
      } catch (_e) { }
      if (!isLoaded)
        throw e; // re-throw if startup() failed to set up NativePlatform
    }
    addonMock.reset();
    // tslint:disable-next-line:variable-name naming-convention
    const TNativePlatform = createDefaultNativePlatform();
    nativePlatform = new TNativePlatform();
    // we're replacing the native addon with our mock - make sure the original
    // one gets terminated
    (nativePlatform as any)._nativeAddon.dispose();
    (nativePlatform as any)._nativeAddon = addonMock.object;
  });

  afterEach(() => {
    nativePlatform.dispose();
  });

  it("calls addon's dispose", async () => {
    addonMock.setup((x) => x.dispose()).verifiable();
    nativePlatform.dispose();
    addonMock.verifyAll();
  });

  it("calls addon's handleRequest", async () => {
    addonMock
      .setup((x) => x.handleRequest(moq.It.isAny(), "", moq.It.isAny()))
      .callback((_db, _options, cb) => { cb({ result: "0" }); })
      .verifiable();
    expect(await nativePlatform.handleRequest(undefined, "")).to.equal("0");
    addonMock.verifyAll();
  });

  it("throws on invalid handleRequest response", async () => {
    addonMock
      .setup((x) => x.handleRequest(moq.It.isAny(), "", moq.It.isAny()))
      .callback((_db, _options, cb) => { cb(undefined as any); });
    await expect(nativePlatform.handleRequest(undefined, "")).to.be.rejectedWith(ECPresentationError);
  });

  it("throws on handleRequest error response", async () => {
    addonMock
      .setup((x) => x.handleRequest(moq.It.isAny(), "", moq.It.isAny()))
      .callback((_db, _options, cb) => { cb({ error: { status: NativeECPresentationStatus.Error, message: "test" } }); });
    await expect(nativePlatform.handleRequest(undefined, "")).to.be.rejectedWith(ECPresentationError, "test");
  });

  it("throws on handleRequest success response without result", async () => {
    addonMock
      .setup((x) => x.handleRequest(moq.It.isAny(), "", moq.It.isAny()))
      .callback((_db, _options, cb) => { cb({ result: undefined }); });
    await expect(nativePlatform.handleRequest(undefined, "")).to.be.rejectedWith(ECPresentationError);
  });

  it("calls addon's setupRulesetDirectories", async () => {
    addonMock
      .setup((x) => x.setupRulesetDirectories(moq.It.isAny()))
      .returns(() => ({}))
      .verifiable();
    nativePlatform.setupRulesetDirectories([]);
    addonMock.verifyAll();
  });

  it("calls addon's setupLocaleDirectories", async () => {
    addonMock.setup((x) => x.setupLocaleDirectories(moq.It.isAny())).returns(() => ({})).verifiable();
    nativePlatform.setupLocaleDirectories([]);
    addonMock.verifyAll();
  });

  it("throws on invalid void response", async () => {
    addonMock
      .setup((x) => x.setupRulesetDirectories(moq.It.isAny()))
      .returns(() => (undefined as any));
    expect(() => nativePlatform.setupRulesetDirectories([])).to.throw(ECPresentationError);
  });

  it("throws on void error response", async () => {
    addonMock
      .setup((x) => x.setupRulesetDirectories(moq.It.isAny()))
      .returns(() => ({ error: { status: NativeECPresentationStatus.InvalidArgument, message: "test" } }));
    expect(() => nativePlatform.setupRulesetDirectories([])).to.throw(ECPresentationError, "test");
  });

  it("calls addon's addRuleSet", async () => {
    const ruleset = { ruleSetId: "" };
    const serializedRuleset = JSON.stringify(ruleset);
    addonMock.setup((x) => x.addRuleSet(serializedRuleset)).returns(() => ({})).verifiable();
    await nativePlatform.addRuleSet(serializedRuleset);
    addonMock.verifyAll();
  });

  it("calls addon's removeRuleSet", async () => {
    addonMock.setup((x) => x.removeRuleSet("test id")).returns(() => ({})).verifiable();
    await nativePlatform.removeRuleSet("test id");
    addonMock.verifyAll();
  });

  it("calls addon's clearRuleSets", async () => {
    addonMock.setup((x) => x.clearRuleSets()).returns(() => ({})).verifiable();
    await nativePlatform.clearRuleSets();
    addonMock.verifyAll();
  });

  it("calls addon's setUserSetting", async () => {
    const rulesetId = faker.random.word();
    const settingId = faker.random.word();
    const value = JSON.stringify({ value: faker.random.word(), type: SettingValueTypes.String });
    addonMock.setup((x) => x.setUserSetting(rulesetId, settingId, value))
      .returns(() => ({}))
      .verifiable();
    await nativePlatform.setUserSetting(rulesetId, settingId, value);
    addonMock.verifyAll();
  });

  it("calls addon's getUserSetting", async () => {
    const rulesetId = faker.random.word();
    const settingId = faker.random.word();
    const value = faker.random.word();
    addonMock.setup((x) => x.getUserSetting(rulesetId, settingId, SettingValueTypes.String))
      .returns(() => ({ result: value }))
      .verifiable();
    const result = await nativePlatform.getUserSetting(rulesetId, settingId, SettingValueTypes.String);
    expect(result).to.be.equal(value);
    addonMock.verifyAll();
  });

  it("returns imodel addon from IModelDb", () => {
    const mock = moq.Mock.ofType<IModelDb>();
    mock.setup((x) => x.nativeDb).returns(() => ({})).verifiable(moq.Times.atLeastOnce());
    expect(nativePlatform.getImodelAddon(mock.object)).be.instanceOf(Object);
    mock.verifyAll();
  });

  it("throws when fails to find imodel using IModelDb", () => {
    const mock = moq.Mock.ofType<IModelDb>();
    mock.setup((x) => x.nativeDb).returns(() => undefined).verifiable(moq.Times.atLeastOnce());
    expect(() => nativePlatform.getImodelAddon(mock.object)).to.throw(ECPresentationError);
    mock.verifyAll();
  });

});
