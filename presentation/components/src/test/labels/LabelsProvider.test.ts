/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomECInstanceKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation, PresentationManager } from "@bentley/presentation-frontend";
import { PresentationLabelsProvider } from "../../presentation-components/labels/LabelsProvider";

describe("PresentationLabelsProvider", () => {

  let provider: PresentationLabelsProvider;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  after(() => {
    Presentation.terminate();
  });

  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new PresentationLabelsProvider({ imodel: imodelMock.object });
  });

  describe("getLabel", () => {

    it("calls manager to get result and returns it", async () => {
      const key = createRandomECInstanceKey();
      const result = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object }), key))
        .returns(async () => ({ displayValue: result, rawValue: result, typeName: "string" }))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabel(key)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager only once for the same key", async () => {
      const key = createRandomECInstanceKey();
      const result = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object }), key))
        .returns(async () => ({ displayValue: result, rawValue: result, typeName: "string" }))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabel(key)).to.eq(result);
      expect(await provider.getLabel(key)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager for every different key", async () => {
      const key1 = createRandomECInstanceKey();
      const key2 = createRandomECInstanceKey();
      const result1 = faker.random.word();
      const result2 = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object }), key1))
        .returns(async () => ({ displayValue: result1, rawValue: result1, typeName: "string" }))
        .verifiable(moq.Times.exactly(1));
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object }), key2))
        .returns(async () => ({ displayValue: result2, rawValue: result2, typeName: "string" }))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabel(key1)).to.eq(result1);
      expect(await provider.getLabel(key2)).to.eq(result2);
      presentationManagerMock.verifyAll();
    });

  });

  describe("getLabels", () => {

    it("calls manager to get result and returns it", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object }), keys))
        .returns(async () => result.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys)).to.deep.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager only once for the same key", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object }), keys))
        .returns(async () => result.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys)).to.deep.eq(result);
      expect(await provider.getLabels(keys)).to.deep.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager for every different list of keys", async () => {
      const keys1 = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const keys2 = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result1 = [faker.random.word(), faker.random.word()];
      const result2 = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object }), keys1))
        .returns(async () => result1.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object }), keys2))
        .returns(async () => result2.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys1)).to.deep.eq(result1);
      expect(await provider.getLabels(keys2)).to.deep.eq(result2);
      presentationManagerMock.verifyAll();
    });

  });

});
