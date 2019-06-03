/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomECInstanceKey, createRandomTransientId, createRandomDescriptor } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, Content, Item } from "@bentley/presentation-common";
import { Presentation } from "../../Presentation";
import { PresentationManager } from "../../PresentationManager";
import { RulesetManager } from "../../RulesetManager";
import { HiliteSetProvider } from "../../selection/HiliteSetProvider";
import { TRANSIENT_ELEMENT_CLASSNAME } from "../../selection/SelectionManager";

describe("HiliteSetProvider", () => {

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();

  beforeEach(() => {
    imodelMock.reset();
    presentationManagerMock.reset();
    rulesetsManagerMock.reset();
    Presentation.presentation = presentationManagerMock.object;
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);
  });

  afterEach(() => {
    Presentation.terminate();
  });

  describe("create", () => {

    it("creates a new HiliteSetProvider instance", () => {
      const result = HiliteSetProvider.create(imodelMock.object);
      expect(result).to.not.be.undefined;
      expect(result instanceof HiliteSetProvider).to.be.true;
    });

  });

  describe("getHiliteSet", () => {

    let provider: HiliteSetProvider;

    beforeEach(() => {
      provider = HiliteSetProvider.create(imodelMock.object);
    });

    it("registers ruleset only on first call", async () => {
      rulesetsManagerMock.verify((x) => x.add(moq.It.isAny()), moq.Times.never());
      await provider.getHiliteSet(new KeySet());
      rulesetsManagerMock.verify((x) => x.add(moq.It.isAny()), moq.Times.once());
      await provider.getHiliteSet(new KeySet());
      rulesetsManagerMock.verify((x) => x.add(moq.It.isAny()), moq.Times.once());
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

      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet()))).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([transientKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.deep.eq([transientKey.id]);
    });

    it("creates result for persistent element keys", async () => {
      const persistentKey = createRandomECInstanceKey();
      const resultKey = createRandomECInstanceKey();
      const resultContent = new Content(createRandomDescriptor(), [
        new Item([resultKey], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.be.undefined;
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.deep.eq([resultKey.id]);
    });

    it("creates result for model keys", async () => {
      const persistentKey = createRandomECInstanceKey();
      const resultKey = createRandomECInstanceKey();
      const resultContent = new Content(createRandomDescriptor(), [
        new Item([resultKey], "", "", undefined, {}, {}, [], { isModel: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([persistentKey]));
      expect(result.models).to.deep.eq([resultKey.id]);
      expect(result.subCategories).to.be.undefined;
      expect(result.elements).to.be.undefined;
    });

    it("creates result for subcategory keys", async () => {
      const persistentKey = createRandomECInstanceKey();
      const resultKey = createRandomECInstanceKey();
      const resultContent = new Content(createRandomDescriptor(), [
        new Item([resultKey], "", "", undefined, {}, {}, [], { isSubCategory: true }),
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => undefined);

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
      const resultContent = new Content(createRandomDescriptor(), [
        new Item([resultModelKey], "", "", undefined, {}, {}, [], { isModel: true }),
        new Item([resultSubCategoryKey], "", "", undefined, {}, {}, [], { isSubCategory: true }),
        new Item([resultElementKey], "", "", undefined, {}, {}, [], {}), // element
      ]);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => resultContent);
      presentationManagerMock.setup(async (x) => x.getContent(moq.It.isAny(), moq.It.isAny(), moq.isKeySet(new KeySet([persistentKey])))).returns(async () => undefined);

      const result = await provider.getHiliteSet(new KeySet([transientKey, persistentKey]));
      expect(result.models).to.deep.eq([resultModelKey.id]);
      expect(result.subCategories).to.deep.eq([resultSubCategoryKey.id]);
      expect(result.elements).to.deep.eq([transientKey.id, resultElementKey.id]);
    });

  });

});
