/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@itwin/presentation-frontend/lib/cjs/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import {
  Content, ContentDescriptorRequestOptions, ContentRequestOptions, Descriptor, FIELD_NAMES_SEPARATOR, KeySet, Paged, RegisteredRuleset, SelectionInfo,
} from "@itwin/presentation-common";
import {
  createRandomECInstanceKey, createRandomRuleset, createTestContentDescriptor, createTestContentItem, createTestNestedContentField, createTestPropertiesContentField,
  createTestPropertyInfo, createTestSimpleContentField, PromiseContainer, ResolvablePromise,
} from "@itwin/presentation-common/lib/cjs/test";
import { Presentation, PresentationManager, RulesetManager } from "@itwin/presentation-frontend";
import { PrimitiveValue, PropertyDescription, PropertyRecord } from "@itwin/appui-abstract";
import { CacheInvalidationProps, ContentDataProvider, ContentDataProviderProps } from "../../presentation-components/common/ContentDataProvider";
import { mockPresentationManager } from "../_helpers/UiComponents";

/**
 * The Provider class is used to make protected [[ContentDataProvider]]
 * function public so the tests can call and spy on them.
 */
class Provider extends ContentDataProvider {
  constructor(props: ContentDataProviderProps) {
    super(props);
  }
  public override invalidateCache(props: CacheInvalidationProps) { super.invalidateCache(props); }
  public override shouldRequestContentForEmptyKeyset() { return super.shouldRequestContentForEmptyKeyset(); }
  public override async getDescriptorOverrides() { return super.getDescriptorOverrides(); }
}

describe("ContentDataProvider", () => {

  let rulesetId: string;
  let displayType: string;
  let provider: Provider;
  let invalidateCacheSpy: sinon.SinonSpy<[CacheInvalidationProps], void>;
  let presentationManagerMock: moq.IMock<PresentationManager>;
  let rulesetsManagerMock: moq.IMock<RulesetManager>;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const imodelKey = "test-imodel-Key";

  before(() => {
    rulesetId = faker.random.word();
    displayType = faker.random.word();
  });

  beforeEach(() => {
    const mocks = mockPresentationManager();
    rulesetsManagerMock = mocks.rulesetsManager;
    presentationManagerMock = mocks.presentationManager;
    Presentation.setPresentationManager(presentationManagerMock.object);

    imodelMock.reset();
    imodelMock.setup((x) => x.key).returns(() => imodelKey);

    provider = new Provider({ imodel: imodelMock.object, ruleset: rulesetId, displayType, enableContentAutoUpdate: true });
    invalidateCacheSpy = sinon.spy(provider, "invalidateCache");
  });

  afterEach(() => {
    provider.dispose();
    Presentation.terminate();
  });

  describe("constructor", () => {

    it("sets display type", () => {
      const type = faker.random.word();
      const p = new Provider({ imodel: imodelMock.object, ruleset: rulesetId, displayType: type });
      expect(p.displayType).to.eq(type);
    });

    it("sets paging size", () => {
      const pagingSize = faker.random.number();
      const p = new Provider({ imodel: imodelMock.object, ruleset: rulesetId, displayType, pagingSize });
      expect(p.pagingSize).to.be.eq(pagingSize);
    });

    it("registers ruleset", async () => {
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async (r) => new RegisteredRuleset(r, "test", () => { }));
      const ruleset = await createRandomRuleset();
      const p = new Provider({ imodel: imodelMock.object, ruleset, displayType });
      expect(p.rulesetId).to.eq(ruleset.id);
      rulesetsManagerMock.verify(async (x) => x.add(ruleset), moq.Times.once());
    });

    it("disposes registered ruleset after provided is disposed before registration completes", async () => {
      const registerPromise = new ResolvablePromise<RegisteredRuleset>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registerPromise);

      const ruleset = await createRandomRuleset();
      const p = new Provider({ imodel: imodelMock.object, ruleset, displayType });
      p.dispose();

      const rulesetDisposeSpy = sinon.spy();
      await registerPromise.resolve(new RegisteredRuleset(ruleset, "test", rulesetDisposeSpy));
      expect(rulesetDisposeSpy).to.be.calledOnce;
    });

  });

  describe("dispose", () => {

    it("disposes registered ruleset", async () => {
      const registerPromise = new ResolvablePromise<RegisteredRuleset>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registerPromise);

      const ruleset = await createRandomRuleset();
      const p = new Provider({ imodel: imodelMock.object, ruleset, displayType });
      const rulesetDisposeSpy = sinon.spy();
      await registerPromise.resolve(new RegisteredRuleset(ruleset, "test", rulesetDisposeSpy));

      expect(rulesetDisposeSpy).to.not.be.called;
      p.dispose();
      expect(rulesetDisposeSpy).to.be.calledOnce;
    });

  });

  describe("rulesetId", () => {

    it("returns rulesetId provider is initialized with", () => {
      expect(provider.rulesetId).to.eq(rulesetId);
    });

    it("sets a different rulesetId and clears caches", () => {
      const newId = `${rulesetId} (changed)`;
      provider.rulesetId = newId;
      expect(provider.rulesetId).to.eq(newId);
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

    it("doesn't clear caches if setting to the same rulesetId", () => {
      const newId = `${rulesetId}`;
      provider.rulesetId = newId;
      expect(provider.rulesetId).to.eq(newId);
      expect(invalidateCacheSpy).to.not.be.called;
    });

  });

  describe("imodel", () => {

    it("returns imodel provider is initialized with", () => {
      expect(provider.imodel).to.eq(imodelMock.object);
    });

    it("sets a different imodel and clears caches", () => {
      const newConnection = moq.Mock.ofType<IModelConnection>();
      provider.imodel = newConnection.object;
      expect(provider.imodel).to.eq(newConnection.object);
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

    it("doesn't clear caches if setting to the same imodel", () => {
      provider.imodel = imodelMock.object;
      expect(provider.imodel).to.eq(imodelMock.object);
      expect(invalidateCacheSpy).to.not.be.called;
    });

  });

  describe("selectionInfo", () => {

    it("sets a different selectionInfo and clears caches", () => {
      const info1: SelectionInfo = { providerName: "a" };
      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      invalidateCacheSpy.resetHistory();

      const info2: SelectionInfo = { providerName: "b" };
      provider.selectionInfo = info2;
      expect(provider.selectionInfo).to.eq(info2);
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

    it("doesn't clear caches if setting to the same selectionInfo", () => {
      const info1: SelectionInfo = { providerName: "a" };
      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      invalidateCacheSpy.resetHistory();

      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      expect(invalidateCacheSpy).to.not.be.called;
    });

  });

  describe("keys", () => {

    it("sets keys and clears caches", () => {
      const keys = new KeySet([createRandomECInstanceKey()]);
      provider.keys = keys;
      expect(provider.keys).to.eq(keys);
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

    it("doesn't clear caches if keys didn't change", () => {
      const keys = new KeySet();
      provider.keys = keys;
      invalidateCacheSpy.resetHistory();
      provider.keys = keys;
      expect(invalidateCacheSpy).to.not.be.called;
    });

    it("sets keys and clears caches when keys change in place", () => {
      const keys = new KeySet();
      provider.keys = keys;
      invalidateCacheSpy.resetHistory();
      keys.add(createRandomECInstanceKey());
      provider.keys = keys;
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

  });

  describe("getContentDescriptor", () => {

    const selection: SelectionInfo = { providerName: "test" };

    beforeEach(() => {
      provider.keys = new KeySet([createRandomECInstanceKey()]);
    });

    it("requests presentation manager for descriptor and returns its copy", async () => {
      const result = createTestContentDescriptor({ displayType, fields: [] });
      presentationManagerMock
        .setup(async (x) => x.getContentDescriptor(moq.It.isObjectWith<ContentDescriptorRequestOptions<IModelConnection, KeySet>>({ imodel: imodelMock.object, rulesetOrId: rulesetId, displayType, selection })))
        .returns(async () => result)
        .verifiable();
      provider.selectionInfo = selection;
      const descriptor = await provider.getContentDescriptor();
      presentationManagerMock.verifyAll();
      expect(descriptor).to.not.eq(result);
      expect(descriptor).to.deep.eq(result);
    });

    it("requests presentation manager for descriptor when keyset is empty and `shouldRequestContentForEmptyKeyset()` returns `true`", async () => {
      provider.keys = new KeySet();
      provider.shouldRequestContentForEmptyKeyset = () => true;
      presentationManagerMock
        .setup(async (x) => x.getContentDescriptor(moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      const descriptor = await provider.getContentDescriptor();
      presentationManagerMock.verifyAll();
      expect(descriptor).to.be.undefined;
    });

    it("doesn't request presentation manager for descriptor when keyset is empty and `shouldRequestContentForEmptyKeyset()` returns `false`", async () => {
      provider.keys = new KeySet();
      presentationManagerMock
        .setup(async (x) => x.getContentDescriptor(moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable(moq.Times.never());
      const descriptor = await provider.getContentDescriptor();
      presentationManagerMock.verifyAll();
      expect(descriptor).to.be.undefined;
    });

    it("handles undefined descriptor returned by presentation manager", async () => {
      presentationManagerMock.setup(async (x) => x.getContentDescriptor(moq.It.isAny()))
        .returns(async () => undefined);
      const descriptor = await provider.getContentDescriptor();
      expect(descriptor).to.be.undefined;
    });

    it("memoizes result", async () => {
      const resultPromiseContainer = new PromiseContainer<Descriptor>();
      presentationManagerMock.setup(async (x) => x.getContentDescriptor(moq.It.isAny()))
        .returns(async () => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());
      const requests = [provider.getContentDescriptor(), provider.getContentDescriptor()];
      const result = createTestContentDescriptor({ fields: [] });
      resultPromiseContainer.resolve(result);
      const descriptors = await Promise.all(requests);
      descriptors.forEach((descriptor) => expect(descriptor).to.deep.eq(result));
      presentationManagerMock.verifyAll();
    });

  });

  describe("getContentSetSize", () => {

    beforeEach(() => {
      provider.keys = new KeySet([createRandomECInstanceKey()]);
    });

    it("returns 0 when manager returns undefined descriptor", async () => {
      presentationManagerMock.setup(async (x) => x.getContentSetSize(moq.It.isAny()))
        .verifiable(moq.Times.never());
      const size = await provider.getContentSetSize();
      presentationManagerMock.verifyAll();
      expect(size).to.eq(0);
    });

    it("requests presentation manager for size", async () => {
      const result = new PromiseContainer<{ content: Content, size: number }>();
      presentationManagerMock.setup(async (x) => x.getContentAndSize(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: 10 } })))
        .returns(async () => result.promise)
        .verifiable();
      provider.pagingSize = 10;
      const contentAndContentSize = { content: new Content(createTestContentDescriptor({ fields: [] }), []), size: faker.random.number() };
      result.resolve(contentAndContentSize);
      const size = await provider.getContentSetSize();
      expect(size).to.eq(contentAndContentSize.size);
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const resultPromiseContainer = new PromiseContainer<{ content: Content, size: number }>();
      presentationManagerMock.setup(async (x) => x.getContentAndSize(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: 10 } })))
        .returns(async () => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());
      provider.pagingSize = 10;
      const requests = [provider.getContentSetSize(), provider.getContentSetSize()];
      const result = { content: new Content(createTestContentDescriptor({ fields: [] }), []), size: faker.random.number() };
      resultPromiseContainer.resolve(result);
      const sizes = await Promise.all(requests);
      sizes.forEach((size) => expect(size).to.eq(result.size));
      presentationManagerMock.verifyAll();
    });

    it("requests size and first page when paging size is set", async () => {
      const resultPromiseContainer = new PromiseContainer<{ content: Content, size: number }>();
      const pagingSize = 20;

      presentationManagerMock.setup(async (x) => x.getContentAndSize(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: pagingSize } })))
        .returns(async () => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());

      provider.pagingSize = pagingSize;
      const result = { content: new Content(createTestContentDescriptor({ fields: [] }), []), size: faker.random.number() };
      resultPromiseContainer.resolve(result);
      const size = await provider.getContentSetSize();
      expect(size).to.eq(result.size);
      presentationManagerMock.verifyAll();
    });

    it("returns content size equal to content set size when page options are undefined", async () => {
      const descriptor = createTestContentDescriptor({ fields: [] });
      const content = new Content(descriptor, [createTestContentItem({ values: {}, displayValues: {} })]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: undefined })))
        .returns(async () => content)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup(async (x) => x.getContentSetSize(moq.It.isAny()))
        .verifiable(moq.Times.never());
      const size = await provider.getContentSetSize();
      presentationManagerMock.verifyAll();
      expect(size).to.equal(content.contentSet.length);
    });

  });

  describe("getContent", () => {

    beforeEach(() => {
      provider.keys = new KeySet([createRandomECInstanceKey()]);
    });

    it("returns undefined when manager returns undefined content", async () => {
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      const c = await provider.getContent();
      presentationManagerMock.verifyAll();
      expect(c).to.be.undefined;
    });

    it("requests presentation manager for content", async () => {
      const descriptor = createTestContentDescriptor({ fields: [] });
      const result: { content: Content, size: number } = {
        content: new Content(descriptor, []),
        size: 1,
      };
      presentationManagerMock.setup(async (x) => x.getContentAndSize(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: 10 } })))
        .returns(async () => result)
        .verifiable();
      const c = await provider.getContent({ start: 0, size: 10 });
      presentationManagerMock.verifyAll();
      expect(c).to.deep.eq(result.content);
    });

    it("memoizes result", async () => {
      const resultContentFirstPagePromise0 = new PromiseContainer<Content>();
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: undefined })))
        .returns(async () => resultContentFirstPagePromise0.promise)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: undefined, size: 0 } })))
        .verifiable(moq.Times.never());
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: undefined } })))
        .verifiable(moq.Times.never());
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: 0 } })))
        .verifiable(moq.Times.never());

      const resultContentFirstPagePromise1 = new PromiseContainer<{ content: Content, size: number }>();
      presentationManagerMock.setup(async (x) => x.getContentAndSize(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 0, size: 1 } })))
        .returns(async () => resultContentFirstPagePromise1.promise)
        .verifiable(moq.Times.once());

      const resultContentNonFirstPagePromise = new PromiseContainer<Content>();
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ paging: { start: 1, size: 0 } })))
        .returns(async () => resultContentNonFirstPagePromise.promise)
        .verifiable(moq.Times.once());

      const requests = [
        provider.getContent(undefined),
        provider.getContent({ start: undefined, size: 0 }),
        provider.getContent({ start: 0, size: undefined }),
        provider.getContent({ start: 0, size: 0 }),
        provider.getContent({ start: 0, size: 1 }),
        provider.getContent({ start: 1, size: 0 }),
      ];

      // for first 4 requests
      const descriptor = createTestContentDescriptor({ fields: [] });
      const nonPagedContentStartingAt0Response = new Content(descriptor, [createTestContentItem({ label: "1", values: {}, displayValues: {} })]);
      // for 5'th request
      const pagedContentAndSizeResponse = {
        content: new Content(descriptor, [createTestContentItem({ label: "2", values: {}, displayValues: {} })]),
        size: 1,
      };
      // for 6'th request
      const nonPagedContentStartingAt1Response = new Content(descriptor, [createTestContentItem({ label: "3", values: {}, displayValues: {} })]);

      resultContentFirstPagePromise0.resolve(nonPagedContentStartingAt0Response);
      resultContentFirstPagePromise1.resolve(pagedContentAndSizeResponse);
      resultContentNonFirstPagePromise.resolve(nonPagedContentStartingAt1Response);
      const responses = await Promise.all(requests);

      expect(responses[0])
        .to.deep.eq(responses[1], "responses[1] should eq responses[0]")
        .to.deep.eq(responses[2], "responses[2] should eq responses[0]")
        .to.deep.eq(responses[3], "responses[3] should eq responses[0]")
        .to.deep.eq(nonPagedContentStartingAt0Response, "responses[0], responses[1], responses[2] and responses[3] should eq nonPagedContentStartingAt0Response");
      expect(responses[4]).to.deep.eq(pagedContentAndSizeResponse.content, "responses[4] should eq pagedContentAndSizeResponse.content");
      expect(responses[5]).to.deep.eq(nonPagedContentStartingAt1Response, "responses[5] should eq nonPagedContentStartingAt1Response");
      presentationManagerMock.verifyAll();
    });

    it("doesn't request for content when keyset is empty and `shouldRequestContentForEmptyKeyset()` returns `false`", async () => {
      provider.keys = new KeySet();
      await provider.getContent();
      presentationManagerMock.verify(async (x) => x.getContentDescriptor(moq.It.isAny()), moq.Times.never());
      presentationManagerMock.verify(async (x) => x.getContent(moq.It.isAny()), moq.Times.never());
      presentationManagerMock.verify(async (x) => x.getContentAndSize(moq.It.isAny()), moq.Times.never());
    });

  });

  describe("getFieldByPropertyRecord", () => {

    let propertyRecord: PropertyRecord;

    before(() => {
      const value: PrimitiveValue = {
        displayValue: "displayValue",
        value: "rawValue",
        valueFormat: 0,
      };

      const description: PropertyDescription = {
        name: "propertyName",
        displayLabel: "labelString",
        typename: "number",
        editor: undefined,
      };

      propertyRecord = new PropertyRecord(value, description);
      propertyRecord.isReadonly = false;
    });

    beforeEach(() => {
      provider.keys = new KeySet([createRandomECInstanceKey()]);
    });

    it("return undefined if descriptor is not set", async () => {
      presentationManagerMock.setup(async (x) =>
        x.getContentDescriptor(moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable(moq.Times.once());

      const field = await provider.getFieldByPropertyRecord(propertyRecord);
      presentationManagerMock.verifyAll();
      expect(field).to.be.undefined;
    });

    it("return undefined when field is not found", async () => {
      const descriptor = createTestContentDescriptor({ fields: [] });

      presentationManagerMock.setup(async (x) =>
        x.getContentDescriptor(moq.It.isAny()))
        .returns(async () => descriptor)
        .verifiable(moq.Times.once());

      const resultField = await provider.getFieldByPropertyRecord(propertyRecord);
      presentationManagerMock.verifyAll();
      expect(resultField).to.be.undefined;
    });

    it("return a field", async () => {
      const field = createTestPropertiesContentField({
        name: "test-field",
        properties: [{
          property: createTestPropertyInfo({ name: "test-property" }),
        }],
      });
      const descriptor = createTestContentDescriptor({ fields: [field] });
      propertyRecord.property.name = "test-field";

      presentationManagerMock.setup(async (x) => x.getContentDescriptor(moq.It.isAny())).returns(async () => descriptor).verifiable(moq.Times.once());

      const resultField = await provider.getFieldByPropertyRecord(propertyRecord);
      presentationManagerMock.verifyAll();
      expect(resultField).to.eq(field);
    });

    it("return a nested field", async () => {
      const nestedField = createTestSimpleContentField({ name: "nested-field" });
      const nestingField = createTestNestedContentField({
        name: "nesting-field",
        nestedFields: [nestedField],
      });
      const descriptor = createTestContentDescriptor({ fields: [nestingField] });
      propertyRecord.property.name = `${nestingField.name}${FIELD_NAMES_SEPARATOR}${nestedField.name}`;

      presentationManagerMock.setup(async (x) => x.getContentDescriptor(moq.It.isAny())).returns(async () => descriptor).verifiable(moq.Times.once());

      const resultField = await provider.getFieldByPropertyRecord(propertyRecord);
      presentationManagerMock.verifyAll();
      expect(resultField).to.eq(nestedField);
    });

  });

  describe("reacting to updates", () => {

    it("doesn't react to imodel content updates to unrelated rulesets", () => {
      presentationManagerMock.object.onIModelContentChanged.raiseEvent({ rulesetId: "unrelated", updateInfo: "FULL", imodelKey });
      expect(invalidateCacheSpy).to.not.be.called;
    });

    it("doesn't react to imodel content updates to unrelated imodels", () => {
      presentationManagerMock.object.onIModelContentChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey: "unrelated" });
      expect(invalidateCacheSpy).to.not.be.called;
    });

    it("invalidates cache when imodel content change happens to related ruleset", () => {
      presentationManagerMock.object.onIModelContentChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey });
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

    it("doesn't react to unrelated ruleset modifications", async () => {
      const ruleset = new RegisteredRuleset(await createRandomRuleset(), "", () => { });
      rulesetsManagerMock.object.onRulesetModified.raiseEvent(ruleset, { ...ruleset.toJSON() });
      expect(invalidateCacheSpy).to.not.be.called;
    });

    it("invalidates cache when related ruleset is modified", async () => {
      const ruleset = new RegisteredRuleset({ ...(await createRandomRuleset()), id: rulesetId }, "", () => { });
      rulesetsManagerMock.object.onRulesetModified.raiseEvent(ruleset, { ...ruleset.toJSON() });
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

    it("invalidates cache when related ruleset variables change", () => {
      presentationManagerMock.object.vars("").onVariableChanged.raiseEvent("var_id", "prev", "curr");
      expect(invalidateCacheSpy).to.be.calledOnceWith(CacheInvalidationProps.full());
    });

  });

  describe("diagnostics", () => {

    it("passes diagnostics options to presentation manager", async () => {
      const diagnosticsHandler = sinon.stub();

      provider.dispose();
      provider = new Provider({
        imodel: imodelMock.object,
        ruleset: rulesetId,
        displayType,
        ruleDiagnostics: { severity: "error", handler: diagnosticsHandler },
      });
      sinon.stub(provider, "shouldRequestContentForEmptyKeyset").returns(true);

      const descriptor = createTestContentDescriptor({ fields: [] });
      const content = new Content(descriptor, [createTestContentItem({ values: {}, displayValues: {} })]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isObjectWith<Paged<ContentRequestOptions<IModelConnection, Descriptor, KeySet>>>({ diagnostics: { editor: "error", handler: diagnosticsHandler } })))
        .returns(async () => content)
        .verifiable(moq.Times.once());
      await provider.getContentSetSize();
      presentationManagerMock.verifyAll();
    });

  });

});
