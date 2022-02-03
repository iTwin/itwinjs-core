/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import type { IModelConnection } from "@itwin/core-frontend";
import { Content, DEFAULT_KEYS_BATCH_SIZE, Item, KeySet } from "@itwin/presentation-common";
import { createRandomECInstanceKey, createRandomTransientId, createTestContentDescriptor } from "@itwin/presentation-common/lib/cjs/test";
import type { PresentationManager } from "../../presentation-frontend";
import { HiliteSetProvider, Presentation } from "../../presentation-frontend";
import { TRANSIENT_ELEMENT_CLASSNAME } from "../../presentation-frontend/selection/SelectionManager";

describe("HiliteSetProvider", () => {

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();

  beforeEach(() => {
    imodelMock.reset();
    presentationManagerMock.reset();
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
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
      // note: listening on private method
      const spy = sinon.stub(provider as any, "getRecords").returns(Promise.resolve([]));
      const keys = new KeySet();

      await provider.getHiliteSet(keys);
      expect(spy).to.be.calledOnce; // records are fetched for the first request

      await provider.getHiliteSet(keys);
      expect(spy).to.be.calledOnce; // keys didn't change - result returned from cache

      keys.add(createRandomECInstanceKey());
      await provider.getHiliteSet(keys);
      expect(spy).to.be.calledTwice; // keys did change - result fetched again

      await provider.getHiliteSet(keys);
      expect(spy).to.be.calledTwice; // keys didn't change - result returned from cache
    });

    it("creates result for transient element keys", async () => {
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: createRandomTransientId() };

      presentationManagerMock.setup(async (x) => x.getContent(moq.It.is((opts) => opts.keys.isEmpty))).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([transientKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.deep.eq([transientKey.id]);
    });

    it("creates result for persistent element keys", async () => {
      const persistentKey = createRandomECInstanceKey();
      const resultKey = createRandomECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        new Item([resultKey], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.deep.eq([resultKey.id]);
    });

    it("creates result for model keys", async () => {
      const persistentKey = createRandomECInstanceKey();
      const resultKey = createRandomECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        new Item([resultKey], "", "", undefined, {}, {}, [], { isModel: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.deep.eq([resultKey.id]);
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.be.undefined;
    });

    it("creates result for subcategory keys", async () => {
      const persistentKey = createRandomECInstanceKey();
      const resultKey = createRandomECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        new Item([resultKey], "", "", undefined, {}, {}, [], { isSubCategory: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.deep.eq([resultKey.id]);
      expect(result.elements).to.be.undefined;
    });

    it("creates combined result", async () => {
      // the handler asks selection manager for overall selection
      const persistentKey = createRandomECInstanceKey();
      const transientKey = { className: TRANSIENT_ELEMENT_CLASSNAME, id: createRandomTransientId() };
      const resultModelKey = createRandomECInstanceKey();
      const resultSubCategoryKey = createRandomECInstanceKey();
      const resultElementKey = createRandomECInstanceKey();
      const resultContent = new Content(createTestContentDescriptor({ fields: [] }), [
        new Item([resultModelKey], "", "", undefined, {}, {}, [], { isModel: true }),
        new Item([resultSubCategoryKey], "", "", undefined, {}, {}, [], { isSubCategory: true }),
        new Item([resultElementKey], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny())).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([transientKey, persistentKey]));
      expect(result.models).to.deep.eq([resultModelKey.id]);
      expect(result.subCategories).to.deep.eq([resultSubCategoryKey.id]);
      expect(result.elements).to.deep.eq([transientKey.id, resultElementKey.id]);
    });

    it("requests content in batches when keys count exceeds max", async () => {
      // create a key set of such size that we need 3 content requests
      const inputKeys = new KeySet();
      for (let i = 0; i < (2 * DEFAULT_KEYS_BATCH_SIZE + 1); ++i)
        inputKeys.add(createRandomECInstanceKey());

      // first request returns content with an element key
      const elementKey = createRandomECInstanceKey();
      const resultContent1 = new Content(createTestContentDescriptor({ fields: [] }), [
        new Item([elementKey], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.is((opts) => opts.keys.size === DEFAULT_KEYS_BATCH_SIZE))).returns(async () => resultContent1);

      // second request returns no content
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.is((opts) => opts.keys.size === DEFAULT_KEYS_BATCH_SIZE))).returns(async () => undefined);

      // third request returns content with subcategory and model keys
      const subCategoryKey = createRandomECInstanceKey();
      const modelKey = createRandomECInstanceKey();
      const resultContent2 = new Content(createTestContentDescriptor({ fields: [] }), [
        new Item([subCategoryKey], "", "", undefined, {}, {}, [], { isSubCategory: true }),
        new Item([modelKey], "", "", undefined, {}, {}, [], { isModel: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.is((opts) => opts.keys.size === 1))).returns(async () => resultContent2);

      const result = await provider.getHiliteSet(new KeySet(inputKeys));
      expect(result.models).to.deep.eq([modelKey.id]);
      expect(result.subCategories).to.deep.eq([subCategoryKey.id]);
      expect(result.elements).to.deep.eq([elementKey.id]);
    });

  });

});
