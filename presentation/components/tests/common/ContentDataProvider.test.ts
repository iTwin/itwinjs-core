/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/presentation-frontend/tests/_helpers/MockFrontendEnvironment";
import { expect, spy } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import { PromiseContainer } from "@bentley/presentation-common/tests/_helpers/Promises";
import { createRandomDescriptor } from "@bentley/presentation-common/tests/_helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import * as content from "@bentley/presentation-common/lib/content";
import { KeySet, PageOptions } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import PresentationManager from "@bentley/presentation-frontend/lib/PresentationManager";
import ContentDataProvider, { CacheInvalidationProps } from "../../lib/common/ContentDataProvider";

/**
 * The Provider class is used to make protected ContentDataProvider
 * function public so the tests can call and spy on them.
 */
class Provider extends ContentDataProvider {
  constructor(connection: IModelConnection, rulesetId: string, displayType: string) {
    super(connection, rulesetId, displayType);
  }
  public invalidateCache(props: CacheInvalidationProps): void {
    super.invalidateCache(props);
  }
  public configureContentDescriptor(descriptor: Readonly<content.Descriptor>): content.Descriptor {
    return super.configureContentDescriptor(descriptor);
  }
  public shouldExcludeFromDescriptor(field: content.Field): boolean {
    return super.shouldExcludeFromDescriptor(field);
  }
  public isFieldHidden(field: content.Field): boolean {
    return super.isFieldHidden(field);
  }
  public publicGetContentDescriptor: (() => Promise<Readonly<content.Descriptor> | undefined>) & _.MemoizedFunction = this.getContentDescriptor;
  public publicGetContentSetSize: (() => Promise<number>) & _.MemoizedFunction = this.getContentSetSize;
  public publicGetContent: ((pageOptions?: PageOptions) => Promise<Readonly<content.Content> | undefined>) & _.MemoizedFunction = this.getContent;
}

interface MemoizedCacheSpies {
  defaultDescriptor: any;
  descriptor: any;
  size: any;
  content: any;
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

  const verifyMemoizedCachesCleared = (expectCleared: boolean = true) => {
    Object.values(memoizedCacheSpies).forEach((s) => {
      if (expectCleared)
        expect(s).to.be.called();
      else
        expect(s).to.not.be.called();
    });
  };
  const resetMemoizedCacheSpies = () => {
    (spy as any).restore();
    memoizedCacheSpies = {
      defaultDescriptor: spy.on((provider as any).getDefaultContentDescriptor.cache, "clear"),
      descriptor: spy.on(provider.publicGetContentDescriptor.cache, "clear"),
      size: spy.on(provider.publicGetContentSetSize.cache, "clear"),
      content: spy.on(provider.publicGetContent.cache, "clear"),
    };
  };

  describe("constructor", () => {
    it("sets display type", () => {
      const type = faker.random.word();
      const p = new Provider(imodelMock.object, rulesetId, type);
      expect(p.displayType).to.eq(type);
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

  describe("connection", () => {

    it("returns connection provider is initialized with", () => {
      expect(provider.connection).to.eq(imodelMock.object);
    });

    it("sets a different connection and clears caches", () => {
      const newConnection = moq.Mock.ofType<IModelConnection>();
      provider.connection = newConnection.object;
      expect(provider.connection).to.eq(newConnection.object);
      verifyMemoizedCachesCleared();
    });

    it("doesn't clear caches if setting to the same connection", () => {
      provider.connection = imodelMock.object;
      expect(provider.connection).to.eq(imodelMock.object);
      verifyMemoizedCachesCleared(false);
    });

  });

  describe("selectionInfo", () => {

    it("sets a different selectionInfo and clears caches", () => {
      const info1: content.SelectionInfo = { providerName: "a" };
      provider.selectionInfo = info1;
      expect(provider.selectionInfo).to.eq(info1);
      resetMemoizedCacheSpies();

      const info2: content.SelectionInfo = { providerName: "b" };
      provider.selectionInfo = info2;
      expect(provider.selectionInfo).to.eq(info2);
      verifyMemoizedCachesCleared(true);
    });

    it("doesn't clear caches if setting to the same selectionInfo", () => {
      const info1: content.SelectionInfo = { providerName: "a" };
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

  });

  describe("invalidateCache", () => {

    it("clears memoized descriptor", () => {
      provider.invalidateCache({ descriptor: true });
      expect(memoizedCacheSpies.defaultDescriptor).to.be.called();
    });

    it("clears memoized configured descriptor", () => {
      provider.invalidateCache({ descriptorConfiguration: true });
      expect(memoizedCacheSpies.descriptor).to.be.called();
    });

    it("clears memoized content set size", () => {
      provider.invalidateCache({ size: true });
      expect(memoizedCacheSpies.size).to.be.called();
    });

    it("clears memoized content", () => {
      provider.invalidateCache({ content: true });
      expect(memoizedCacheSpies.content).to.be.called();
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

    const selection: content.SelectionInfo = { providerName: "test" };

    it("requests presentation manager for descriptor and returns its copy", async () => {
      const result = createRandomDescriptor(displayType);
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, displayType, new KeySet(), selection))
        .returns(async () => result)
        .verifiable();
      provider.selectionInfo = selection;
      const descriptor = await provider.publicGetContentDescriptor();
      presentationManagerMock.verifyAll();
      expect(descriptor).to.not.eq(result);
      expect(descriptor).to.deep.eq(result);
    });

    it("handles undefined descriptor returned by presentation manager", async () => {
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined);
      const descriptor = await provider.publicGetContentDescriptor();
      expect(descriptor).to.be.undefined;
    });

    it("configures copy of descriptor returned by presentation manager", async () => {
      const configureSpy = spy.on(provider, Provider.prototype.configureContentDescriptor.name);
      const result = createRandomDescriptor(displayType);
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => result);
      await provider.publicGetContentDescriptor();
      expect(configureSpy).to.be.called;
    });

    it("memoizes result", async () => {
      const resultPromiseContainer = new PromiseContainer<content.Descriptor>();
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(() => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());
      const requests = [provider.publicGetContentDescriptor(), provider.publicGetContentDescriptor()];
      const result = createRandomDescriptor();
      resultPromiseContainer.resolve(result);
      const descriptors = await Promise.all(requests);
      descriptors.forEach((descriptor) => expect(descriptor).to.deep.eq(result));
      presentationManagerMock.verifyAll();
    });

  });

  describe("getContentSetSize", () => {

    it("returns 0 when manager returns undefined descriptor", async () => {
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentSetSize({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      const size = await provider.publicGetContentSetSize();
      presentationManagerMock.verifyAll();
      expect(size).to.eq(0);
    });

    it("requests presentation manager for size", async () => {
      const result = faker.random.number();
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor())
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentSetSize({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => result)
        .verifiable();
      const size = await provider.publicGetContentSetSize();
      expect(size).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const resultPromiseContainer = new PromiseContainer<number>();
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => createRandomDescriptor())
        .verifiable();
      presentationManagerMock.setup((x) => x.getContentSetSize({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny()))
        .returns(() => resultPromiseContainer.promise)
        .verifiable(moq.Times.once());
      const requests = [provider.publicGetContentSetSize(), provider.publicGetContentSetSize()];
      const result = faker.random.number();
      resultPromiseContainer.resolve(result);
      const sizes = await Promise.all(requests);
      sizes.forEach((size) => expect(size).to.eq(result));
      presentationManagerMock.verifyAll();
    });

  });

  describe("getContent", () => {

    it("returns undefined when manager returns undefined descriptor", async () => {
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => undefined)
        .verifiable();
      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      const c = await provider.publicGetContent();
      presentationManagerMock.verifyAll();
      expect(c).to.be.undefined;
    });

    it("requests presentation manager for content", async () => {
      const descriptor = createRandomDescriptor();
      const result: content.Content = {
        descriptor,
        contentSet: [],
      };
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => descriptor)
        .verifiable();
      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, moq.It.isAny(), moq.It.isAny()))
        .returns(async () => result)
        .verifiable();
      const c = await provider.publicGetContent();
      presentationManagerMock.verifyAll();
      expect(c).to.deep.eq(result);
    });

    it("memoizes result", async () => {
      const descriptor = createRandomDescriptor();
      const resultPromiseContainers = [1, 2, 3].map(() => new PromiseContainer<content.Content>());
      presentationManagerMock.setup((x) => x.getContentDescriptor({ imodel: imodelMock.object, rulesetId }, moq.It.isAny(), moq.It.isAny(), moq.It.isAny()))
        .returns(async () => descriptor)
        .verifiable();

      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: undefined }, moq.It.isAny(), moq.It.isAny()))
        .returns(() => resultPromiseContainers[0].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 0 } }, moq.It.isAny(), moq.It.isAny()))
        .verifiable(moq.Times.never());
      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: { start: 0, size: 1 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(() => resultPromiseContainers[1].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock.setup((x) => x.getContent({ imodel: imodelMock.object, rulesetId, paging: { start: 1, size: 0 } }, moq.It.isAny(), moq.It.isAny()))
        .returns(() => resultPromiseContainers[2].promise)
        .verifiable(moq.Times.once());

      const requests = [
        provider.publicGetContent(undefined),
        provider.publicGetContent({ start: 0, size: 0 }),
        provider.publicGetContent({ start: 0, size: 1 }),
        provider.publicGetContent({ start: 1, size: 0 }),
      ];
      const results: content.Content[] = [{
        descriptor,
        contentSet: [new content.Item([], "1", "", undefined, {}, {}, [])],
      }, {
        descriptor,
        contentSet: [new content.Item([], "2", "", undefined, {}, {}, [])],
      }, {
        descriptor,
        contentSet: [new content.Item([], "3", "", undefined, {}, {}, [])],
      }];
      resultPromiseContainers.forEach((container, index) => container.resolve(results[index]));
      const responses = await Promise.all(requests);

      expect(responses[1])
        .to.deep.eq(responses[0], "responses[1] should eq responses[0]")
        .to.deep.eq(results[0], "both responses[0] and responses[1] should eq results[0]");
      expect(responses[2]).to.deep.eq(results[1], "responses[2] should eq results[1]");
      expect(responses[3]).to.deep.eq(results[2], "responses[3] should eq results[2]");
      presentationManagerMock.verifyAll();
    });

  });

});
