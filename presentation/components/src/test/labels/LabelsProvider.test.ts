/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomECInstanceKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation, PresentationManager } from "@bentley/presentation-frontend";
import { LabelsProvider } from "../../labels/LabelsProvider";

describe("LabelsProvider", () => {

  let provider: LabelsProvider;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  before(() => {
    Presentation.presentation = presentationManagerMock.object;
  });
  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new LabelsProvider(imodelMock.object);
  });

  describe("getLabel", () => {

    it("calls manager to get result and returns it", async () => {
      const key = createRandomECInstanceKey();
      const result = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabel(moq.It.isObjectWith({ imodel: imodelMock.object }), key))
        .returns(async () => result)
        .verifiable(moq.Times.exactly(2));
      expect(await provider.getLabel(key)).to.eq(result);
      expect(await provider.getLabel(key)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager only once for the same key when memoizing", async () => {
      const key = createRandomECInstanceKey();
      const result = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabel(moq.It.isObjectWith({ imodel: imodelMock.object }), key))
        .returns(async () => result)
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabel(key, true)).to.eq(result);
      expect(await provider.getLabel(key, true)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager for every different key when memoizing", async () => {
      const key1 = createRandomECInstanceKey();
      const key2 = createRandomECInstanceKey();
      const result1 = faker.random.word();
      const result2 = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabel(moq.It.isObjectWith({ imodel: imodelMock.object }), key1))
        .returns(async () => result1)
        .verifiable(moq.Times.exactly(1));
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabel(moq.It.isObjectWith({ imodel: imodelMock.object }), key2))
        .returns(async () => result2)
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabel(key1, true)).to.eq(result1);
      expect(await provider.getLabel(key2, true)).to.eq(result2);
      presentationManagerMock.verifyAll();
    });

  });

  describe("getLabels", () => {

    it("calls manager to get result and returns it", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabels(moq.It.isObjectWith({ imodel: imodelMock.object }), keys))
        .returns(async () => result)
        .verifiable(moq.Times.exactly(2));
      expect(await provider.getLabels(keys)).to.eq(result);
      expect(await provider.getLabels(keys)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager only once for the same key when memoizing", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabels(moq.It.isObjectWith({ imodel: imodelMock.object }), keys))
        .returns(async () => result)
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys, true)).to.eq(result);
      expect(await provider.getLabels(keys, true)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager for every different list of keys when memoizing", async () => {
      const keys1 = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const keys2 = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result1 = [faker.random.word(), faker.random.word()];
      const result2 = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabels(moq.It.isObjectWith({ imodel: imodelMock.object }), keys1))
        .returns(async () => result1)
        .verifiable(moq.Times.exactly(1));
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabels(moq.It.isObjectWith({ imodel: imodelMock.object }), keys2))
        .returns(async () => result2)
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys1, true)).to.eq(result1);
      expect(await provider.getLabels(keys2, true)).to.eq(result2);
      presentationManagerMock.verifyAll();
    });

  });

});
