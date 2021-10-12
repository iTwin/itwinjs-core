/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { IModelDb, IModelHost, IModelJsNative } from "@itwin/core-backend";
import { DiagnosticsScopeLogs, PresentationError, UpdateInfo, VariableValueTypes } from "@itwin/presentation-common";
import { createDefaultNativePlatform, NativePlatformDefinition } from "../presentation-backend/NativePlatform";
import { PresentationManagerMode } from "../presentation-backend/PresentationManager";

describe("default NativePlatform", () => {

  let nativePlatform: NativePlatformDefinition;
  const addonMock = moq.Mock.ofType<IModelJsNative.ECPresentationManager>();

  beforeEach(async () => {
    try {
      await IModelHost.startup();
    } catch (e) {
      let isLoaded = false;
      try {
        IModelHost.platform;
        isLoaded = true;
      } catch (_e) { }
      if (!isLoaded)
        throw e; // re-throw if startup() failed to set up NativePlatform
    }
    addonMock.reset();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TNativePlatform = createDefaultNativePlatform({
      id: faker.random.uuid(),
      localeDirectories: [],
      taskAllocationsMap: {},
      mode: PresentationManagerMode.ReadOnly,
      isChangeTrackingEnabled: false,
    });
    nativePlatform = new TNativePlatform();
    // we're replacing the native addon with our mock - make sure the original
    // one gets terminated
    (nativePlatform as any)._nativeAddon.dispose();
    (nativePlatform as any)._nativeAddon = addonMock.object;
  });

  afterEach(async () => {
    nativePlatform.dispose();
    await IModelHost.shutdown();
  });

  it("calls addon's dispose", async () => {
    addonMock.setup((x) => x.dispose()).verifiable();
    nativePlatform.dispose();
    addonMock.verifyAll();
  });

  it("calls addon's forceLoadSchemas", async () => {
    addonMock
      .setup(async (x) => x.forceLoadSchemas(moq.It.isAny()))
      .returns(async () => ({ result: undefined }))
      .verifiable();
    await nativePlatform.forceLoadSchemas(undefined);
    addonMock.verifyAll();

    addonMock.reset();
    addonMock
      .setup(async (x) => x.forceLoadSchemas(moq.It.isAny()))
      .returns(async () => ({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "rejected" } }))
      .verifiable();
    await expect(nativePlatform.forceLoadSchemas(undefined)).to.be.rejected;
    addonMock.verifyAll();
  });

  describe("handleRequest", () => {

    it("calls addon", async () => {
      const guid = faker.random.uuid();
      addonMock
        .setup((x) => x.queueRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: guid }))
        .verifiable();
      addonMock
        .setup((x) => x.pollResponse(guid))
        .returns(() => ({ result: "0" }))
        .verifiable();
      expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "0" });
      addonMock.verifyAll();
    });

    it("polls multiple times on pending response", async () => {
      const guid = faker.random.uuid();
      addonMock
        .setup((x) => x.queueRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: guid }));
      addonMock
        .setup((x) => x.pollResponse(guid))
        .returns(() => ({ error: { status: IModelJsNative.ECPresentationStatus.Pending, message: "" } }));
      addonMock
        .setup((x) => x.pollResponse(guid))
        .returns(() => ({ error: { status: IModelJsNative.ECPresentationStatus.Pending, message: "" } }));
      addonMock
        .setup((x) => x.pollResponse(guid))
        .returns(() => ({ result: "999" }));
      expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "999" });
      addonMock.verify((x) => x.pollResponse(guid), moq.Times.exactly(3));
    });

    it("throws on cancellation response", async () => {
      const guid = faker.random.uuid();
      addonMock
        .setup((x) => x.queueRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: guid }));
      addonMock
        .setup((x) => x.pollResponse(guid))
        .returns(() => ({ error: { status: IModelJsNative.ECPresentationStatus.Canceled, message: "test" } }));
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationError, "test");
    });

    it("throws on queueRequest error response", async () => {
      addonMock
        .setup((x) => x.queueRequest(moq.It.isAny(), ""))
        .returns(() => ({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "test" } }));
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationError, "test");
    });

    it("throws on pollResponse error response", async () => {
      const guid = faker.random.uuid();
      addonMock
        .setup((x) => x.queueRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: guid }));
      addonMock
        .setup((x) => x.pollResponse(guid))
        .returns(() => ({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "test" } }));
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationError, "test");
    });

  });

  it("puts diagnostics into result", async () => {
    const diagnostics: DiagnosticsScopeLogs = {
      scope: "test",
    };
    addonMock
      .setup((x) => x.queueRequest(moq.It.isAny(), ""))
      .returns(() => ({ result: "" }));
    addonMock
      .setup((x) => x.pollResponse(moq.It.isAny()))
      .returns(() => ({ result: "0", diagnostics }))
      .verifiable();
    expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "0", diagnostics });
    addonMock.verifyAll();
  });

  it("calls addon's setupRulesetDirectories", async () => {
    addonMock
      .setup((x) => x.setupRulesetDirectories(moq.It.isAny()))
      .returns(() => ({}))
      .verifiable();
    nativePlatform.setupRulesetDirectories([]);
    addonMock.verifyAll();
  });

  it("calls addon's setupSupplementalRulesetDirectories", async () => {
    addonMock
      .setup((x) => x.setupSupplementalRulesetDirectories(moq.It.isAny()))
      .returns(() => ({}))
      .verifiable();
    nativePlatform.setupSupplementalRulesetDirectories([]);
    addonMock.verifyAll();
  });

  it("throws on void error response", async () => {
    addonMock
      .setup((x) => x.setupRulesetDirectories(moq.It.isAny()))
      .returns(() => ({ error: { status: IModelJsNative.ECPresentationStatus.InvalidArgument, message: "test" } }));
    expect(() => nativePlatform.setupRulesetDirectories([])).to.throw(PresentationError, "test");
  });

  it("calls addon's getRulesets", async () => {
    const ruleset = { id: "", rules: [] };
    const hash = faker.random.uuid();
    const serializedResult = JSON.stringify([{ ruleset, hash }]);
    addonMock.setup((x) => x.getRulesets(ruleset.id)).returns(() => ({ result: serializedResult })).verifiable();
    const result = nativePlatform.getRulesets(ruleset.id);
    expect(result).to.deep.eq({ result: serializedResult });
    addonMock.verifyAll();
  });

  it("calls addon's addRuleset", async () => {
    const ruleset = { id: "", rules: [] };
    const hash = faker.random.uuid();
    const serializedRuleset = JSON.stringify(ruleset);
    addonMock.setup((x) => x.addRuleset(serializedRuleset)).returns(() => ({ result: hash })).verifiable();
    const result = nativePlatform.addRuleset(serializedRuleset);
    addonMock.verifyAll();
    expect(result).to.deep.eq({ result: hash });
  });

  it("calls addon's removeRuleset", async () => {
    addonMock.setup((x) => x.removeRuleset("test id", "test hash")).returns(() => ({ result: true })).verifiable();
    const result = nativePlatform.removeRuleset("test id", "test hash");
    addonMock.verifyAll();
    expect(result).to.deep.eq({ result: true });
  });

  it("calls addon's clearRulesets", async () => {
    addonMock.setup((x) => x.clearRulesets()).returns(() => ({})).verifiable();
    nativePlatform.clearRulesets();
    addonMock.verifyAll();
  });

  it("calls addon's setRulesetVariableValue", async () => {
    const rulesetId = faker.random.word();
    const variableId = faker.random.word();
    const value = faker.random.word();
    addonMock.setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value))
      .returns(() => ({}))
      .verifiable();
    nativePlatform.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value);
    addonMock.verifyAll();
  });

  it("calls addon's unsetRulesetVariableValue", async () => {
    const rulesetId = faker.random.word();
    const variableId = faker.random.word();
    addonMock.setup((x) => x.unsetRulesetVariableValue(rulesetId, variableId))
      .returns(() => ({}))
      .verifiable();
    nativePlatform.unsetRulesetVariableValue(rulesetId, variableId);
    addonMock.verifyAll();
  });

  it("calls addon's getRulesetVariableValue", async () => {
    const rulesetId = faker.random.word();
    const variableId = faker.random.word();
    const value = faker.random.word();
    addonMock.setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
      .returns(() => ({ result: value }))
      .verifiable();
    const result = nativePlatform.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String);
    addonMock.verifyAll();
    expect(result).to.deep.equal({ result: value });
  });

  it("calls addon's getUpdateInfo", async () => {
    const updates = new Array<UpdateInfo>();
    addonMock.setup((x) => x.getUpdateInfo())
      .returns(() => ({ result: updates }))
      .verifiable();
    const result = nativePlatform.getUpdateInfo();
    addonMock.verifyAll();
    expect(result).to.deep.equal({ result: updates });
  });

  it("calls addon's updateHierarchyState", async () => {
    addonMock.setup((x) => x.updateHierarchyState(moq.It.isAny(), "test-ruleset-id", "nodesExpanded", "[]"))
      .returns(() => ({}))
      .verifiable();
    nativePlatform.updateHierarchyState({}, "test-ruleset-id", "nodesExpanded", "[]");
    addonMock.verifyAll();
  });

  it("returns imodel addon from IModelDb", () => {
    const mock = moq.Mock.ofType<IModelDb>();
    mock.setup((x) => x.nativeDb).returns(() => ({} as any)).verifiable(moq.Times.atLeastOnce());
    expect(nativePlatform.getImodelAddon(mock.object)).be.instanceOf(Object);
    mock.verifyAll();
  });

  it("throws when fails to find imodel using IModelDb", () => {
    const mock = moq.Mock.ofType<IModelDb>();
    mock.setup((x) => x.nativeDb).returns(() => (undefined as any)).verifiable(moq.Times.atLeastOnce());
    expect(() => nativePlatform.getImodelAddon(mock.object)).to.throw(PresentationError);
    mock.verifyAll();
  });

});
