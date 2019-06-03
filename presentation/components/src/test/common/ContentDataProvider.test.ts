/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as sinon from "sinon";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { PromiseContainer, ResolvablePromise } from "@bentley/presentation-common/lib/test/_helpers/Promises";
import { createRandomDescriptor, createRandomRuleset, createRandomContent, createRandomECInstanceKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  Descriptor, Field,
  SelectionInfo, Item,
  KeySet, Ruleset, RegisteredRuleset,
  Content, DescriptorOverrides,
} from "@bentley/presentation-common";
import { Presentation, PresentationManager, RulesetManager } from "@bentley/presentation-frontend";
import { ContentDataProvider, CacheInvalidationProps } from "../../common/ContentDataProvider";

/**
 * The Provider class is used to make protected ContentDataProvider
 * function public so the tests can call and spy on them.
 */
class Provider extends ContentDataProvider {
  constructor(imodel: IModelConnection, ruleset: string | Ruleset, displayType: string) {
    super(imodel, ruleset, displayType);
  }
  public invalidateCache(props: CacheInvalidationProps) { super.invalidateCache(props); }
  public configureContentDescriptor(descriptor: Readonly<Descriptor>) { return super.configureContentDescriptor(descriptor); }
  public shouldExcludeFromDescriptor(field: Field) { return super.shouldExcludeFromDescriptor(field); }
  public shouldConfigureContentDescriptor() { return super.shouldConfigureContentDescriptor(); }
  public shouldRequestContentForEmptyKeyset() { return super.shouldRequestContentForEmptyKeyset(); }
  public getDescriptorOverrides() { return super.getDescriptorOverrides(); }
  public isFieldHidden(field: Field) { return super.isFieldHidden(field); }
}

interface MemoizedCacheSpies {
  defaultDescriptor: any;
  descriptor: any;
  sizeAndContent: any;
}

describe("ContentDataProvider", () => {

  let rulesetId: string;
  let displayType: string;
  let provider: Provider;
  let memoizedCacheSpies: MemoizedCacheSpies;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  before(() => {
    rulesetId = faker.random.word();
    displayType = faker.random.word();
    Presentation.presentation = presentationManagerMock.object;
  });
  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new Provider(imodelMock.object, rulesetId, displayType);
    resetMemoizedCacheSpies();
  });
  afterEach(() => {
    provider.dispose();
  });

  const verifyMemoizedCachesCleared = (expectCleared: boolean = true) => {
    Object.values(memoizedCacheSpies).forEach((s) => {
      if (expectCleared)
        expect(s).to.be.called;
      else
        expect(s).to.not.be.called;
    });
  };
  const resetMemoizedCacheSpies = () => {
    sinon.restore();
    memoizedCacheSpies = {
      defaultDescriptor: sinon.spy((provider as any).getDefaultContentDescriptor.cache, "clear"),
      descriptor: sinon.spy(provider.getContentDescriptor.cache, "clear"),
      sizeAndContent: sinon.spy((provider as any)._getContentAndSize.cache, "clear"),
    };
  };

  describe("constructor", () => {

    it("sets display type", () => {
      const type = faker.random.word();
      const p = new Provider(imodelMock.object, rulesetId, type);
      expect(p.displayType).to.eq(type);
    });

    it("registers ruleset", async () => {
      const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async (r) => new RegisteredRuleset(r, "test", () => { }));
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);

      const ruleset = await createRandomRuleset();
      const p = new Provider(imodelMock.object, ruleset, displayType);
      expect(p.rulesetId).to.eq(ruleset.id);
      rulesetsManagerMock.verify(async (x) => x.add(ruleset), moq.Times.once());
    });

    it("disposes registered ruleset after provided is disposed before registration completes", async () => {
      const registerPromise = new ResolvablePromise<RegisteredRuleset>();
      const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registerPromise);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);

      const ruleset = await createRandomRuleset();
      const p = new Provider(imodelMock.object, ruleset, displayType);
      p.dispose();

      const rulesetDisposeSpy = sinon.spy();
      await registerPromise.resolve(new RegisteredRuleset(ruleset, "test", rulesetDisposeSpy));
      expect(rulesetDisposeSpy).to.be.calledOnce;
    });

  });

  describe("dispose", () => {

    it("disposes registered ruleset", async () => {
      const registerPromise = new ResolvablePromise<RegisteredRuleset>();
      const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registerPromise);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);

      const ruleset = await createRandomRuleset();
      const p = new Provider(imodelMock.object, ruleset, displayType);
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
      const newId = rulesetId + " (changed)";
      provider.rulesetId = newId;
      expect(provider.rulesetId).to.eq(newId);
      verifyMemoizedCachesCleared();
    });

    it("doesn't clear caches if setting to the same rulesetId", () => {
      const newId = rulesetId + "";
      provider.rulesetId = newId;
      expect(provider.rulesetId).to.eq(newId);
      verifyMemoizedCachesCleared(false);
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
      verifyMemoizedCachesCleared();
    });

    it("doesn't clear caches if setting to the same imodel", () => {
      provider.imodel = imodelMock.object;
      expect(provider.imodel).to.eq(imodelMock.object);
      verifyMemoizedCachesCleared(false);
    });

  });

  describe("selectionInfo", () => {

    it("sets a different selectionInfo and clears caches", () => {
      const info1: SelectionInfo = { providerName: "a" };
      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      resetMemoizedCacheSpies();

      const info2: SelectionInfo = { providerName: "b" };
      provider.selectionInfo = info2;
      expect(provider.selectionInfo).to.eq(info2);
      verifyMemoizedCachesCleared(true);
    });

    it("doesn't clear caches if setting to the same selectionInfo", () => {
      const info1: SelectionInfo = { providerName: "a" };
      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      resetMemoizedCacheSpies();

      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      verifyMemoizedCachesCleared(false);
    });

  });

  describe("keys", () => {

    it("sets keys and clears caches", () => {
      const keys = new KeySet();
      provider.keys = keys;
      expect(provider.keys).to.eq(keys);
      verifyMemoizedCachesCleared(true);
    });

    it("doesn't clear caches if keys didn't change", () => {
      const keys = new KeySet();
      provider.keys = keys;
      resetMemoizedCacheSpies();
      provider.keys = keys;
      verifyMemoizedCachesCleared(false);
    });

    it("sets keys and clears caches when keys change in place", () => {
      const keys = new KeySet();
      provider.keys = keys;
      resetMemoizedCacheSpies();
      keys.add(createRandomECInstanceKey());
      provider.keys = keys;
      verifyMemoizedCachesCleared(true);
    });

  });

  describe("invalidateCache", () => {

    it("clears memoized descriptor", () => {
      provider.invalidateCache({ descriptor: true });
      expect(memoizedCacheSpies.defaultDescriptor).to.be.called;
    });

    it("clears memoized configured descriptor", () => {
      provider.invalidateCache({ descriptorConfiguration: true });
      expect(memoizedCacheSpies.descriptor).to.be.called;
    });

    it("clears memoized content set size", () => {
      provider.invalidateCache({ size: true });
      expect(memoizedCacheSpies.sizeAndContent).to.be.called;
    });

    it("clears memoized content", () => {
      provider.invalidateCache({ content: true });
      expect(memoizedCacheSpies.sizeAndContent).to.be.called;
    });

  });

  describe("configureContentDescriptor", () => {

    it("excludes fields from result descriptor", () => {
      const source = createRandomDescriptor();
      provider.shouldExcludeFromDescriptor = () => true;
      const result = provider.configureContentDescriptor(source);
      expect(source.fields.length).to.be.greaterThan(0);
      expect(result.fields.length).to.eq(0);
    });

  });

  describe("getContentDescriptor", () => {

    const selection: SelectionInfo = { providerName: "test" };

    beforeEach(() => {
      provider.keys = new KeySet([createRandomECInstanceKey()]);
    });

    it("requests presentation manager for descriptor and returns its copy", async () => {
      const result = createRandomDescriptor(displayType);
      presentationManagerMock
        .setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, displayType, moq.It.isAnyObject(KeySet), selection))
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
        .setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      const descriptor = await provider.getContentDescriptor();
      presentationManagerMock.verifyAll();
      expect(descriptor).to.be.undefined;
    });

    it("doesn't request presentation manager for descriptor when keyset is empty and `shouldRequestContentForEmptyKeyset()` returns `false`", async () => {
      provider.keys = new KeySet();
      presentationManagerMock
        .setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable(moq.Times.never());
      const descriptor = await provider.getContentDescriptor();
      presentationManagerMock.verifyAll();
      expect(descriptor).to.be.undefined;
    });

    it("handles undefined descriptor returned by presentation manager", async () => {
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined);
      const descriptor = await provider.getContentDescriptor();
      expect(descriptor).to.be.undefined;
    });

    it("configures copy of descriptor returned by presentation manager", async () => {
      const configureSpy = sinon.spy(provider, "configureContentDescriptor");
      const result = createRandomDescriptor(displayType);
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => result);
      await provider.getContentDescriptor();
      expect(configureSpy).to.be.calledOnce;
    });

    it("memoizes result", async () => {
      const resultPromiseContainer = new PromiseContainer<Descriptor>();
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());
      const requests = [provider.getContentDescriptor(), provider.getContentDescriptor()];
      const result = createRandomDescriptor();
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
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentSetSize({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      const size = await provider.getContentSetSize();
      presentationManagerMock.verifyAll();
      expect(size).to.eq(0);
    });

    it("requests presentation manager for size", async () => {
      const result = new PromiseContainer<{ content: Content, size: number }>();
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor())
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentAndSize({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => result.promise)
        .verifiable();
      provider.pagingSize = 10;
      const contentAndContentSize = { content: createRandomContent(), size: faker.random.number() };
      result.resolve(contentAndContentSize);
      const size = await provider.getContentSetSize();
      expect(size).to.eq(contentAndContentSize.size);
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const resultPromiseContainer = new PromiseContainer<{ content: Content, size: number }>();
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor())
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentAndSize({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());
      provider.pagingSize = 10;
      const requests = [provider.getContentSetSize(), provider.getContentSetSize()];
      const result = { content: createRandomContent(), size: faker.random.number() };
      resultPromiseContainer.resolve(result);
      const sizes = await Promise.all(requests);
      sizes.forEach((size) => expect(size).to.eq(result.size));
      presentationManagerMock.verifyAll();
    });

    it("requests size and first page when paging size is set", async () => {
      const resultPromiseContainer = new PromiseContainer<{ content: Content, size: number }>(); // TODO
      const pagingSize = 20;

      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor())
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentAndSize({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: pagingSize } }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());

      provider.pagingSize = pagingSize;
      const result = { content: createRandomContent(), size: faker.random.number() };
      resultPromiseContainer.resolve(result);
      const size = await provider.getContentSetSize();
      expect(size).to.eq(result.size);
      presentationManagerMock.verifyAll();
    });

    it("returns content size equal to content set size when page options are undefined", async () => {
      const descriptor = createRandomDescriptor();
      const content = new Content(descriptor, [new Item([], "1", "", undefined, {}, {}, [])]);
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => descriptor)
        .verifiable();
      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => content)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup((x) => x.getContentSetSize(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      const size = await provider.getContentSetSize();
      presentationManagerMock.verifyAll();
      expect(size).to.equal(content.contentSet.length);
    });

    it("requests content set size with descriptor overrides when `shouldConfigureContentDescriptor()` returns false", async () => {
      const overrides: DescriptorOverrides = { displayType: "test", contentFlags: 123, hiddenFieldNames: [] };
      provider.shouldConfigureContentDescriptor = () => false;
      provider.getDescriptorOverrides = () => overrides;

      const content = new Content(createRandomDescriptor(), [1, 2, 3].map(() => ({} as any)));

      presentationManagerMock.setup(async (x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, moq.It.isAny()))
        .returns(async () => content)
        .verifiable(moq.Times.once());

      const size = await provider.getContentSetSize();
      presentationManagerMock.verifyAll();
      expect(size).to.eq(content.contentSet.length);
    });
  });

  describe("getContent", () => {

    beforeEach(() => {
      provider.keys = new KeySet([createRandomECInstanceKey()]);
    });

    it("returns undefined when manager returns undefined descriptor", async () => {
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      const c = await provider.getContent();
      presentationManagerMock.verifyAll();
      expect(c).to.be.undefined;
    });

    it("returns undefined when manager returns undefined content", async () => {
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor())
        .verifiable();
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      const c = await provider.getContent();
      presentationManagerMock.verifyAll();
      expect(c).to.be.undefined;
    });

    it("requests presentation manager for content", async () => {
      const descriptor = createRandomDescriptor();
      const result: { content: Content, size: number } = {
        content: new Content(descriptor, []),
        size: 1,
      };
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => descriptor)
        .verifiable();
      presentationManagerMock.setup(async (x) => x.getContentAndSize({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 10 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => result)
        .verifiable();
      const c = await provider.getContent({ start: 0, size: 10 });
      presentationManagerMock.verifyAll();
      expect(c).to.deep.eq(result.content);
    });

    it("memoizes result", async () => {
      const descriptor = createRandomDescriptor();
      const resultContentFirstPagePromise0 = new PromiseContainer<Content>();
      const resultContentFirstPagePromise1 = new PromiseContainer<{ content: Content, size: number }>();
      const resultContentNonFirstPagePromise = new PromiseContainer<Content>();
      presentationManagerMock.setup(async (x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => descriptor)
        .verifiable();

      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => resultContentFirstPagePromise0.promise)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 0 } }, moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      presentationManagerMock.setup(async (x) => x.getContentAndSize({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 1 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => resultContentFirstPagePromise1.promise)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: { start: 1, size: 0 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => resultContentNonFirstPagePromise.promise)
        .verifiable(moq.Times.once());

      const requests = [
        provider.getContent(undefined),
        provider.getContent({ start: 0, size: 0 }),
        provider.getContent({ start: 0, size: 1 }),
        provider.getContent({ start: 1, size: 0 }),
      ];
      const results: { content: Content, size: number }[] = [{
        content: new Content(descriptor, [new Item([], "1", "", undefined, {}, {}, [])]),
        size: 1,
      }, {
        content: new Content(descriptor, [new Item([], "2", "", undefined, {}, {}, [])]),
        size: 1,
      }, {
        content: new Content(descriptor, [new Item([], "3", "", undefined, {}, {}, [])]),
        size: 1,
      }];
      resultContentFirstPagePromise0.resolve(results[0].content);
      resultContentFirstPagePromise1.resolve(results[1]);
      resultContentNonFirstPagePromise.resolve(results[2].content);
      const responses = await Promise.all(requests);

      expect(responses[1])
        .to.deep.eq(responses[0], "responses[1] should eq responses[0]")
        .to.deep.eq(results[0].content, "both responses[0] and responses[1] should eq results[0]");
      expect(responses[2]).to.deep.eq(results[1].content, "responses[2] should eq results[1]");
      expect(responses[3]).to.deep.eq(results[2].content, "responses[3] should eq results[2]");
      presentationManagerMock.verifyAll();
    });

    it("requests content with descriptor overrides when `shouldConfigureContentDescriptor()` returns false", async () => {
      const result = createRandomContent();
      const overrides: DescriptorOverrides = { displayType: "test", contentFlags: 123, hiddenFieldNames: [] };
      provider.shouldConfigureContentDescriptor = () => false;
      provider.getDescriptorOverrides = () => overrides;

      presentationManagerMock.setup(async (x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      presentationManagerMock.setup(async (x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, overrides, moq.It.isAny()))
        .returns(async () => result)
        .verifiable(moq.Times.once());

      const content = await provider.getContent();
      expect(content).to.eq(result);

      presentationManagerMock.verifyAll();
    });

    it("doesn't request for content when keyset is empty and `shouldRequestContentForEmptyKeyset()` returns `false`", async () => {
      provider.keys = new KeySet();
      const spy = sinon.spy(provider, "shouldConfigureContentDescriptor");
      await provider.getContent();
      expect(spy).to.not.be.called;
    });

  });

});
