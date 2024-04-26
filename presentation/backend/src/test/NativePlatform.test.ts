/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { join } from "path";
import sinon from "sinon";
import * as moq from "typemoq";
import { IModelDb, IModelHost, IModelJsNative } from "@itwin/core-backend";
import { BeEvent } from "@itwin/core-bentley";
import { DiagnosticsScopeLogs, PresentationError, PresentationStatus, VariableValueTypes } from "@itwin/presentation-common";
import { createDefaultNativePlatform, NativePlatformDefinition, PresentationNativePlatformResponseError } from "../presentation-backend/NativePlatform";

describe("default NativePlatform", () => {
  let nativePlatform: NativePlatformDefinition;
  const addonMock = moq.Mock.ofType<IModelJsNative.ECPresentationManager>();

  beforeEach(async () => {
    try {
      await IModelHost.startup({ cacheDir: join(__dirname, ".cache") });
    } catch (e) {
      let isLoaded = false;
      try {
        IModelHost.platform;
        isLoaded = true;
      } catch (_e) {}
      if (!isLoaded) {
        throw e; // re-throw if startup() failed to set up NativePlatform
      }
    }
    addonMock.reset();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TNativePlatform = createDefaultNativePlatform({
      id: faker.random.uuid(),
      taskAllocationsMap: {},
      updateCallback: () => {},
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
      addonMock
        .setup((x) => x.handleRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: Promise.resolve({ result: Buffer.from("0") }), cancel: () => {} }))
        .verifiable();
      expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "0" });
      addonMock.verifyAll();
    });

    it("throws on cancellation response", async () => {
      addonMock
        .setup((x) => x.handleRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.Canceled, message: "test" } }), cancel: () => {} }));
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationNativePlatformResponseError, "test");
    });

    it("throws on error response", async () => {
      addonMock
        .setup((x) => x.handleRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "test" } }), cancel: () => {} }));
      await expect(nativePlatform.handleRequest(undefined, "")).to.eventually.be.rejectedWith(PresentationNativePlatformResponseError, "test");
    });

    it("throws on `ResultSetTooLarge` error response", async () => {
      addonMock
        .setup((x) => x.handleRequest(moq.It.isAny(), ""))
        .returns(() => ({
          result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.ResultSetTooLarge, message: "test" } }),
          cancel: () => {},
        }));
      await expect(nativePlatform.handleRequest(undefined, ""))
        .to.eventually.be.rejectedWith(PresentationNativePlatformResponseError, "test")
        .with.property("errorNumber", PresentationStatus.ResultSetTooLarge);
    });

    it("throws with diagnostics", async () => {
      const diagnostics: DiagnosticsScopeLogs = {
        scope: "x",
      };
      addonMock
        .setup((x) => x.handleRequest(moq.It.isAny(), ""))
        .returns(() => ({
          result: Promise.resolve({ error: { status: IModelJsNative.ECPresentationStatus.Error, message: "" }, diagnostics }),
          cancel: () => {},
        }));
      await expect(nativePlatform.handleRequest(undefined, ""))
        .to.eventually.be.rejectedWith(PresentationNativePlatformResponseError)
        .and.have.property("diagnostics", diagnostics);
    });

    it("adds listener to cancel event and calls it only after first invocation", async () => {
      const cancelFunction = sinon.spy();
      const cancelEvent: BeEvent<() => void> = new BeEvent<() => void>();
      addonMock
        .setup((x) => x.handleRequest(moq.It.isAny(), ""))
        .returns(() => ({ result: Promise.resolve({ result: Buffer.from("0") }), cancel: cancelFunction }));
      expect(await nativePlatform.handleRequest(undefined, "", cancelEvent)).to.deep.equal({ result: "0" });
      addonMock.verifyAll();
      cancelEvent.raiseEvent();
      cancelEvent.raiseEvent();
      expect(cancelFunction.calledOnce).to.be.true;
    });
  });

  it("puts diagnostics into result", async () => {
    const diagnostics: DiagnosticsScopeLogs = {
      scope: "test",
    };
    addonMock
      .setup((x) => x.handleRequest(moq.It.isAny(), ""))
      .returns(() => ({ result: Promise.resolve({ result: Buffer.from("0"), diagnostics }), cancel: () => {} }));
    expect(await nativePlatform.handleRequest(undefined, "")).to.deep.equal({ result: "0", diagnostics });
    addonMock.verifyAll();
  });

  it("calls addon's setupRulesetDirectories", async () => {
    addonMock
      .setup((x) => x.setupRulesetDirectories(moq.It.isAny()))
      .returns(() => ({ result: undefined }))
      .verifiable();
    nativePlatform.setupRulesetDirectories([]);
    addonMock.verifyAll();
  });

  it("calls addon's setupSupplementalRulesetDirectories", async () => {
    addonMock
      .setup((x) => x.setupSupplementalRulesetDirectories(moq.It.isAny()))
      .returns(() => ({ result: undefined }))
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
    addonMock
      .setup((x) => x.getRulesets(ruleset.id))
      .returns(() => ({ result: serializedResult }))
      .verifiable();
    const result = nativePlatform.getRulesets(ruleset.id);
    expect(result).to.deep.eq({ result: serializedResult });
    addonMock.verifyAll();
  });

  it("calls addon's addRuleset", async () => {
    const ruleset = { id: "", rules: [] };
    const hash = faker.random.uuid();
    const serializedRuleset = JSON.stringify(ruleset);
    addonMock
      .setup((x) => x.addRuleset(serializedRuleset))
      .returns(() => ({ result: hash }))
      .verifiable();
    const result = nativePlatform.addRuleset(serializedRuleset);
    addonMock.verifyAll();
    expect(result).to.deep.eq({ result: hash });
  });

  it("calls addon's removeRuleset", async () => {
    addonMock
      .setup((x) => x.removeRuleset("test id", "test hash"))
      .returns(() => ({ result: true }))
      .verifiable();
    const result = nativePlatform.removeRuleset("test id", "test hash");
    addonMock.verifyAll();
    expect(result).to.deep.eq({ result: true });
  });

  it("calls addon's clearRulesets", async () => {
    addonMock
      .setup((x) => x.clearRulesets())
      .returns(() => ({ result: undefined }))
      .verifiable();
    nativePlatform.clearRulesets();
    addonMock.verifyAll();
  });

  it("calls addon's setRulesetVariableValue", async () => {
    const rulesetId = faker.random.word();
    const variableId = faker.random.word();
    const value = faker.random.word();
    addonMock
      .setup((x) => x.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value))
      .returns(() => ({ result: undefined }))
      .verifiable();
    nativePlatform.setRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String, value);
    addonMock.verifyAll();
  });

  it("calls addon's unsetRulesetVariableValue", async () => {
    const rulesetId = faker.random.word();
    const variableId = faker.random.word();
    addonMock
      .setup((x) => x.unsetRulesetVariableValue(rulesetId, variableId))
      .returns(() => ({ result: undefined }))
      .verifiable();
    nativePlatform.unsetRulesetVariableValue(rulesetId, variableId);
    addonMock.verifyAll();
  });

  it("calls addon's getRulesetVariableValue", async () => {
    const rulesetId = faker.random.word();
    const variableId = faker.random.word();
    const value = faker.random.word();
    addonMock
      .setup((x) => x.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String))
      .returns(() => ({ result: value }))
      .verifiable();
    const result = nativePlatform.getRulesetVariableValue(rulesetId, variableId, VariableValueTypes.String);
    addonMock.verifyAll();
    expect(result).to.deep.equal({ result: value });
  });

  it("returns imodel addon from IModelDb", () => {
    const mock = moq.Mock.ofType<IModelDb>();
    mock
      .setup((x) => x.nativeDb)
      .returns(() => ({}) as any)
      .verifiable(moq.Times.atLeastOnce());
    expect(nativePlatform.getImodelAddon(mock.object)).be.instanceOf(Object);
    mock.verifyAll();
  });

  it("throws when fails to find imodel using IModelDb", () => {
    const mock = moq.Mock.ofType<IModelDb>();
    mock
      .setup((x) => x.isOpen)
      .returns(() => false)
      .verifiable(moq.Times.atLeastOnce());
    expect(() => nativePlatform.getImodelAddon(mock.object)).to.throw(PresentationError);
    mock.verifyAll();
  });
});
