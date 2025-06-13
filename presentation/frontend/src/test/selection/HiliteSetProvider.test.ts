/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { Content, DEFAULT_KEYS_BATCH_SIZE, Descriptor, Item, KeySet } from "@itwin/presentation-common";
import { createTestContentDescriptor, createTestContentItem, createTestECInstanceKey } from "@itwin/presentation-common/test-utils";
import { TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/unified-selection";
import { GetContentRequestOptions, MultipleValuesRequestOptions, PresentationManager } from "../../presentation-frontend.js";
import { Presentation } from "../../presentation-frontend/Presentation.js";
import { HiliteSetProvider } from "../../presentation-frontend/selection/HiliteSetProvider.js";
import { Id64, TransientIdSequence } from "@itwin/core-bentley";

describe("HiliteSetProvider", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const fakeGetContentIterator = sinon.stub<
    [GetContentRequestOptions & MultipleValuesRequestOptions],
    Promise<{ descriptor: Descriptor; total: number; items: AsyncIterableIterator<Item> } | undefined>
  >();

  beforeEach(() => {
    const managerMock = sinon.createStubInstance(PresentationManager, {
      getContentIterator: fakeGetContentIterator,
    });
    sinon.replaceGetter(Presentation, "presentation", () => managerMock);
  });

  afterEach(() => {
    sinon.restore();
    imodelMock.reset();
    fakeGetContentIterator.reset();
  });

  describe("create", () => {
    it("creates a new HiliteSetProvider instance", () => {
      const result = HiliteSetProvider.create({ imodel: imodelMock.object });
      expect(result).to.not.be.undefined;
      expect(result instanceof HiliteSetProvider).to.be.true;
    });
  });

  describe("getHiliteSet", () => {
    let provider: HiliteSetProvider;

    beforeEach(() => {
      provider = HiliteSetProvider.create({ imodel: imodelMock.object });
    });

    it("memoizes result", async () => {
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [createTestContentItem({ values: {}, displayValues: {} })]);
      fakeGetContentIterator.callsFake(async () => ({ total: 1, descriptor: resultContent.descriptor, items: iterate(resultContent.contentSet) }));
      const keys = new KeySet([createTestECInstanceKey()]);

      await provider.getHiliteSet(keys);
      // records are fetched for the first request
      expect(fakeGetContentIterator).to.be.calledOnce;

      await provider.getHiliteSet(keys);
      // keys didn't change - result returned from cache
      expect(fakeGetContentIterator).to.be.calledOnce;

      keys.add(createTestECInstanceKey({ id: "0x456" }));
      await provider.getHiliteSet(keys);
      // keys did change - result fetched again
      expect(fakeGetContentIterator).to.be.calledTwice;

      await provider.getHiliteSet(keys);
      // keys didn't change - result returned from cache
      expect(fakeGetContentIterator).to.be.calledTwice;
    });

    it("creates result for transient element keys", async () => {
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: new TransientIdSequence().getNext() };

      fakeGetContentIterator.withArgs(sinon.match((opts: GetContentRequestOptions) => opts.keys.isEmpty)).resolves(undefined);

      const result = await provider.getHiliteSet(new KeySet([transientKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.deep.eq([transientKey.id]);
    });

    it("creates result for persistent element keys", async () => {
      const persistentKey = createTestECInstanceKey();
      const resultKey = createTestECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        createTestContentItem({ primaryKeys: [resultKey], values: {}, displayValues: {} }), // element
      ]);

      fakeGetContentIterator
        .onFirstCall()
        .callsFake(async () => ({ total: 1, descriptor: resultContent.descriptor, items: iterate(resultContent.contentSet) }));
      fakeGetContentIterator.onSecondCall().resolves(undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.deep.eq([resultKey.id]);
    });

    it("creates result for model keys", async () => {
      const persistentKey = createTestECInstanceKey();
      const resultKey = createTestECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        createTestContentItem({ primaryKeys: [resultKey], values: {}, displayValues: {}, extendedData: { isModel: true } }),
      ]);

      fakeGetContentIterator
        .onFirstCall()
        .callsFake(async () => ({ total: 1, descriptor: resultContent.descriptor, items: iterate(resultContent.contentSet) }));
      fakeGetContentIterator.onSecondCall().resolves(undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.deep.eq([resultKey.id]);
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.be.undefined;
    });

    it("creates result for subcategory keys", async () => {
      const persistentKey = createTestECInstanceKey();
      const resultKey = createTestECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        createTestContentItem({ primaryKeys: [resultKey], values: {}, displayValues: {}, extendedData: { isSubCategory: true } }),
      ]);
      fakeGetContentIterator
        .onFirstCall()
        .callsFake(async () => ({ total: 1, descriptor: resultContent.descriptor, items: iterate(resultContent.contentSet) }));
      fakeGetContentIterator.onSecondCall().resolves(undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.deep.eq([resultKey.id]);
      expect(result.elements).to.be.undefined;
    });

    it("creates combined result", async () => {
      // the handler asks selection manager for overall selection
      const persistentKey = createTestECInstanceKey();
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: new TransientIdSequence().getNext() };
      const resultModelKey = createTestECInstanceKey();
      const resultSubCategoryKey = createTestECInstanceKey();
      const resultElementKey = createTestECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        createTestContentItem({ primaryKeys: [resultModelKey], values: {}, displayValues: {}, extendedData: { isModel: true } }),
        createTestContentItem({ primaryKeys: [resultSubCategoryKey], values: {}, displayValues: {}, extendedData: { isSubCategory: true } }),
        createTestContentItem({ primaryKeys: [resultElementKey], values: {}, displayValues: {}, extendedData: {} }),
      ]);
      fakeGetContentIterator
        .onFirstCall()
        .callsFake(async () => ({ total: 1, descriptor: resultContent.descriptor, items: iterate(resultContent.contentSet) }));
      fakeGetContentIterator.onSecondCall().resolves(undefined);

      const result = await provider.getHiliteSet(new KeySet([transientKey, persistentKey]));
      expect(result.models).to.deep.eq([resultModelKey.id]);
      expect(result.subCategories).to.deep.eq([resultSubCategoryKey.id]);
      expect(result.elements).to.deep.eq([transientKey.id, resultElementKey.id]);
    });

    it("requests content in batches when keys count exceeds max", async () => {
      // create a key set of such size that we need 3 content requests
      const inputKeys = new KeySet();
      for (let i = 0; i < 2 * DEFAULT_KEYS_BATCH_SIZE + 1; ++i) {
        inputKeys.add(createTestECInstanceKey({ id: Id64.fromUint32Pair(i, 111) }));
      }

      // first request returns content with an element key
      const elementKey = createTestECInstanceKey({ id: "0x222" });
      const resultContent1 = new Content(createTestContentDescriptor({ fields: [] }), [
        createTestContentItem({ primaryKeys: [elementKey], values: {}, displayValues: {} }),
      ]);
      fakeGetContentIterator
        .withArgs(sinon.match((opts: GetContentRequestOptions) => opts.keys.size === DEFAULT_KEYS_BATCH_SIZE))
        .onFirstCall()
        .callsFake(async () => ({ total: 1, descriptor: resultContent1.descriptor, items: iterate(resultContent1.contentSet) }))
        // second request returns no content
        .onSecondCall()
        .resolves(undefined);

      // third request returns content with subcategory and model keys
      const subCategoryKey = createTestECInstanceKey({ id: "0x333" });
      const modelKey = createTestECInstanceKey({ id: "0x444" });
      const resultContent2 = new Content(createTestContentDescriptor({ fields: [] }), [
        createTestContentItem({ primaryKeys: [subCategoryKey], values: {}, displayValues: {}, extendedData: { isSubCategory: true } }),
        createTestContentItem({ primaryKeys: [modelKey], values: {}, displayValues: {}, extendedData: { isModel: true } }),
      ]);
      fakeGetContentIterator
        .withArgs(sinon.match((opts: GetContentRequestOptions) => opts.keys.size === 1))
        .callsFake(async () => ({ total: 2, descriptor: resultContent2.descriptor, items: iterate(resultContent2.contentSet) }));

      const result = await provider.getHiliteSet(new KeySet(inputKeys));
      expect(result.models).to.deep.eq([modelKey.id]);
      expect(result.subCategories).to.deep.eq([subCategoryKey.id]);
      expect(result.elements).to.deep.eq([elementKey.id]);
    });
  });

  describe("getHiliteSetIterator", () => {
    let provider: HiliteSetProvider;

    beforeEach(() => {
      provider = HiliteSetProvider.create({ imodel: imodelMock.object });
    });

    it("iterates over content items in pages", async () => {
      const elementKeys = new Array(1001).fill(0).map((_, i) => ({ id: `0x${i}`, className: "TestElement" }));
      const items = elementKeys.map((key) => createTestContentItem({ primaryKeys: [key], values: {}, displayValues: {} }));

      const resultContent1 = new Content(createTestContentDescriptor({ fields: [] }), items.slice(0, 1000));
      const resultContent2 = new Content(createTestContentDescriptor({ fields: [] }), items.slice(1000));

      fakeGetContentIterator
        .withArgs(sinon.match((opts: MultipleValuesRequestOptions) => !opts.paging?.start))
        .callsFake(async () => ({ total: 1001, descriptor: resultContent1.descriptor, items: iterate(resultContent1.contentSet) }));

      fakeGetContentIterator.withArgs(sinon.match((opts: MultipleValuesRequestOptions) => !!opts.paging?.start)).callsFake(async () => {
        return { total: 1001, descriptor: resultContent2.descriptor, items: iterate(resultContent2.contentSet) };
      });

      const iterator = provider.getHiliteSetIterator(new KeySet([{ id: "0x1", className: "TestElement" }]));
      let index = 0;
      for await (const set of iterator) {
        if (index === 0) {
          expect(set.elements).to.deep.eq(elementKeys.slice(0, 1000).map((key) => key.id));
        }
        if (index === 1) {
          expect(set.elements).to.deep.eq(elementKeys.slice(1000).map((key) => key.id));
        }
        index++;
      }
    });
  });
});

async function* iterate<T>(items: T[]): AsyncIterableIterator<T> {
  for (const item of items) {
    yield item;
  }
}
