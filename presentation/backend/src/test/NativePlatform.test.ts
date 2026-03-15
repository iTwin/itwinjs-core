/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import { _nativeDb, IModelDb, IModelHost, IModelJsNative, IModelNative } from "@itwin/core-backend";
import { BeEvent } from "@itwin/core-bentley";
import { DiagnosticsScopeLogs, PresentationError, PresentationStatus, VariableValueTypes } from "@itwin/presentation-common";
import { createDefaultNativePlatform, NativePlatformDefinition, PresentationNativePlatformResponseError } from "../presentation-backend/NativePlatform.js";

describe("default NativePlatform", () => {
  let nativePlatform: NativePlatformDefinition;
  let addonMock: ReturnType<typeof stubAddon>;

  beforeEach(async () => {
    try {
      await IModelHost.startup({ cacheDir: join(import.meta.dirname, ".cache", `${process.pid}`) });
    } catch (e) {
      let isLoaded = false;
      try {
        IModelNative.platform;
        isLoaded = true;
      } catch {}
      if (!isLoaded) {
        throw e; // re-throw if startup() failed to set up NativePlatform
      }
    }
    addonMock = stubAddon();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TNativePlatform = createDefaultNativePlatform({
      id: "test-id",
      taskAllocationsMap: {},
      updateCallback: () => {},
    });
    nativePlatform = new TNativePlatform();
    // we're replacing the native addon with our mock - make sure the original
    // one gets terminated
    (nativePlatform as any)._nativeAddon.dispose();
    (nativePlatform as any)._nativeAddon = addonMock;
  });

  afterEach(async () => {
    nativePlatform[Symbol.dispose]();
    await IModelHost.shutdown();
  });

  function stubAddon() {
    return {
      dispose: sinon.stub(),
      forceLoadSchemas: sinon.stub(),
      handleRequest: sinon.stub(),
      setupRulesetDirectories: sinon.stub(),
      setupSupplementalRulesetDirectories: sinon.stub(),
      getRulesets: sinon.stub(),
      addRuleset: sinon.stub(),
      removeRuleset: sinon.stub(),
      clearRulesets: sinon.stub(),
      setRulesetVariableValue: sinon.stub(),
      unsetRulesetVariableValue: sinon.stub(),
      getRulesetVariableValue: sinon.stub(),
    };
  }

  it("calls addon's dispose", async () => {
    nativePlatform[Symbol.dispose]();
    expect(addonMock.dispose).to.be.calledOnce;
  });

  it("calls addon's forceLoadSchemas", async () => {
    addonMock.forceLoadSchemas.withArgs(sinon.match.any).resolves({ result: undefined } as any);
    await nativePlatform.forceLoadSchemas(undefined);
    expect(addonMock.forceLoadSchemas).to.be.calledOnce;

    addonMock.forceLoadSchemas.reset();
    addonMock.forceLoadSchemas.withArgs(sinon.match.any).resolves({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "rejected" } } as any);
    await expect(nativePlatform.forceLoadSchemas(undefined)).to.be.rejected;
    expect(addonMock.forceLoadSchemas).to.be.calledOnce;
  });

  describe("handleRequest", () => {
    it("calls addon", async () => {
      addonMock.handleRequest.withArgs(sinon.match.any, "").returns({ result: Promise.resolve({ result: Buffer.from("0") }), cancel: () => {} });
      expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "0" });
      expect(addonMock.handleRequest).to.be.calledOnce;
    });

    it("throws on cancellation response", async () => {
      addonMock.handleRequest
        .withArgs(sinon.match.any, "")
        .returns({ result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.Canceled, message: "test" } }), cancel: () => {} });
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationNativePlatformResponseError, "test");
    });

    it("throws on error response", async () => {
      addonMock.handleRequest
        .withArgs(sinon.match.any, "")
        .returns({ result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "test" } }), cancel: () => {} });
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationNativePlatformResponseError, "test");
    });

    it("throws on `ResultSetTooLarge` error response", async () => {
      addonMock.handleRequest.withArgs(sinon.match.any, "").returns({
        result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.ResultSetTooLarge, message: "test" } }),
        cancel: () => {},
      });
      await expect(nativePlatform.handleRequest(undefined, ""))
        .to.eventually.be.rejectedWith(PresentationNativePlatformResponseError, "test")
        .with.property("errorNumber", PresentationStatus.ResultSetTooLarge);
    });

    it("throws with diagnostics", async () => {
      const diagnostics: DiagnosticsScopeLogs = {
        scope: "x",
      };
      addonMock.handleRequest.withArgs(sinon.match.any, "").returns({
        result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "" }, diagnostics }),
        cancel: () => {},
      });
      await expect(nativePlatform.handleRequest(undefined, ""))
        .to.eventually.be.rejectedWith(PresentationNativePlatformResponseError)
        .and.have.property("diagnostics", diagnostics);
    });

    it("adds listener to cancel event and calls it only after first invocation", async () => {
      const cancelFunction = sinon.spy();
      const cancelEvent: BeEvent<() => void> = new BeEvent<() => void>();
      addonMock.handleRequest.withArgs(sinon.match.any, "").returns({ result: Promise.resolve({ result: Buffer.from("0") }), cancel: cancelFunction });
      expect(await nativePlatform.handleRequest(undefined, "", cancelEvent)).to.deep.equal({ result: "0" });
      cancelEvent.raiseEvent();
      cancelEvent.raiseEvent();
      expect(cancelFunction.calledOnce).to.be.true;
    });
  });

  it("puts diagnostics into result", async () => {
    const diagnostics: DiagnosticsScopeLogs = {
      scope: "test",
    };
    addonMock.handleRequest.withArgs(sinon.match.any, "").returns({ result: Promise.resolve({ result: Buffer.from("0"), diagnostics }), cancel: () => {} });
    expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "0", diagnostics });
  });

  it("calls addon's setupRulesetDirectories", async () => {
    addonMock.setupRulesetDirectories.withArgs(sinon.match.any).returns({ result: undefined });
    nativePlatform.setupRulesetDirectories([]);
    expect(addonMock.setupRulesetDirectories).to.be.calledOnce;
  });

  it("calls addon's setupSupplementalRulesetDirectories", async () => {
    addonMock.setupSupplementalRulesetDirectories.withArgs(sinon.match.any).returns({ result: undefined });
    nativePlatform.setupSupplementalRulesetDirectories([]);
    expect(addonMock.setupSupplementalRulesetDirectories).to.be.calledOnce;
  });

  it("throws on void error response", async () => {
    addonMock.setupRulesetDirectories
      .withArgs(sinon.match.any)
      .returns({ error: { status: IModelJsNative.ECPresentationStatus.InvalidArgument, message: "test" } });
    expect(() => nativePlatform.setupRulesetDirectories([])).to.throw(PresentationError, "test");
  });

  it("calls addon's getRulesets", async () => {
    const ruleset = { id: "", rules: [] };
    const hash = "test-hash";
    const serializedResult = JSON.stringify([{ ruleset, hash }]);
    const getRulesetsStub = addonMock.getRulesets.withArgs(ruleset.id).returns({ result: serializedResult });
    const result = nativePlatform.getRulesets(ruleset.id);
    expect(result).to.deep.eq({ result: serializedResult });
    expect(getRulesetsStub).to.be.calledOnce;
  });

  it("calls addon's addRuleset", async () => {
    const ruleset = { id: "", rules: [] };
    const hash = "test-hash";
    const serializedRuleset = JSON.stringify(ruleset);
    const addRulesetStub = addonMock.addRuleset.withArgs(serializedRuleset).returns({ result: hash });
    const result = nativePlatform.addRuleset(serializedRuleset);
    expect(addRulesetStub).to.be.calledOnce;
    expect(result).to.deep.eq({ result: hash });
  });

  it("calls addon's removeRuleset", async () => {
    const removeRulesetStub = addonMock.removeRuleset.withArgs("test id", "test hash").returns({ result: true });
    const result = nativePlatform.removeRuleset("test id", "test hash");
    expect(removeRulesetStub).to.be.calledOnce;
    expect(result).to.deep.eq({ result: true });
  });

  it("calls addon's clearRulesets", async () => {
    const clearRulesetsStub = addonMock.clearRulesets.returns({ result: undefined });
    nativePlatform.clearRulesets();
    expect(clearRulesetsStub).to.be.calledOnce;
  });

  it("calls addon's setRulesetVariableValue", async () => {
    const rulesetId = "test-ruleset-id";
    const variableId = "test-var-id";
    const value = "test-value";
    addonMock.setRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.String, value).returns({ result: undefined });
    nativePlatform.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value);
    expect(addonMock.setRulesetVariableValue).to.be.calledOnce;
  });

  it("calls addon's unsetRulesetVariableValue", async () => {
    const rulesetId = "test-ruleset-id";
    const variableId = "test-var-id";
    addonMock.unsetRulesetVariableValue.withArgs(rulesetId, variableId).returns({ result: undefined });
    nativePlatform.unsetRulesetVariableValue(rulesetId, variableId);
    expect(addonMock.unsetRulesetVariableValue).to.be.calledOnce;
  });

  it("calls addon's getRulesetVariableValue", async () => {
    const rulesetId = "test-ruleset-id";
    const variableId = "test-var-id";
    const value = "test-value";
    const getRulesetVariableValueStub = addonMock.getRulesetVariableValue.withArgs(rulesetId, variableId, VariableValueTypes.String).returns({ result: value });
    const result = nativePlatform.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String);
    expect(getRulesetVariableValueStub).to.be.calledOnce;
    expect(result).to.deep.equal({ result: value });
  });

  it("returns imodel addon from IModelDb", () => {
    const mock = { isOpen: true } as IModelDb;
    const nativeDbGetter = sinon.stub().returns({} as any);
    Object.defineProperty(mock, _nativeDb, { get: nativeDbGetter });
    expect(nativePlatform.getImodelAddon(mock)).be.instanceOf(Object);
    expect(nativeDbGetter).to.be.calledOnce;
  });

  it("throws when fails to find imodel using IModelDb", () => {
    const mock = {} as IModelDb;
    const isOpenGetter = sinon.stub().returns(false);
    Object.defineProperty(mock, "isOpen", { get: isOpenGetter });
    expect(() => nativePlatform.getImodelAddon(mock)).to.throw(PresentationError);
    expect(isOpenGetter).to.be.calledOnce;
  });
});
