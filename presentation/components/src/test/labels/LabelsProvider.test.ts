/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@itwin/presentation-frontend/lib/cjs/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { DEFAULT_KEYS_BATCH_SIZE } from "@itwin/presentation-common";
import { createRandomECInstanceKey } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
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
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object, key })))
        .returns(async () => ({ displayValue: result, rawValue: result, typeName: "string" }))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabel(key)).to.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager only once for the same key", async () => {
      const key = createRandomECInstanceKey();
      const result = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object, key })))
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
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object, key: key1 })))
        .returns(async () => ({ displayValue: result1, rawValue: result1, typeName: "string" }))
        .verifiable(moq.Times.exactly(1));
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinition(moq.It.isObjectWith({ imodel: imodelMock.object, key: key2 })))
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
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys })))
        .returns(async () => result.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys)).to.deep.eq(result);
      presentationManagerMock.verifyAll();
    });

    it("calls manager only once for the same key", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [faker.random.word(), faker.random.word()];
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys })))
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
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys: keys1 })))
        .returns(async () => result1.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys: keys2 })))
        .returns(async () => result2.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));
      expect(await provider.getLabels(keys1)).to.deep.eq(result1);
      expect(await provider.getLabels(keys2)).to.deep.eq(result2);
      presentationManagerMock.verifyAll();
    });

    it("requests labels in batches when keys count exceeds max and returns expected results", async () => {
      const inputKeys = [];
      const results = [];
      // create a key set of such size that we need 3 content requests
      for (let i = 0; i < (2 * DEFAULT_KEYS_BATCH_SIZE + 1); ++i) {
        inputKeys.push(createRandomECInstanceKey());
        results.push(faker.random.word());
      }

      const keys1 = inputKeys.slice(0, DEFAULT_KEYS_BATCH_SIZE);
      const keys2 = inputKeys.slice(DEFAULT_KEYS_BATCH_SIZE, 2 * DEFAULT_KEYS_BATCH_SIZE);
      const keys3 = inputKeys.slice(2 * DEFAULT_KEYS_BATCH_SIZE, 2 * DEFAULT_KEYS_BATCH_SIZE + 1);
      const result1 = results.slice(0, DEFAULT_KEYS_BATCH_SIZE);
      const result2 = results.slice(DEFAULT_KEYS_BATCH_SIZE, 2 * DEFAULT_KEYS_BATCH_SIZE);
      const result3 = results.slice(2 * DEFAULT_KEYS_BATCH_SIZE, 2 * DEFAULT_KEYS_BATCH_SIZE + 1);

      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys: keys1 })))
        .returns(async () => result1.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));

      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys: keys2 })))
        .returns(async () => result2.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));

      presentationManagerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(moq.It.isObjectWith({ imodel: imodelMock.object, keys: keys3 })))
        .returns(async () => result3.map((value) => ({ rawValue: value, displayValue: value, typeName: "string" })))
        .verifiable(moq.Times.exactly(1));

      const result = await provider.getLabels(inputKeys);
      expect(result).to.deep.eq(results);
      presentationManagerMock.verifyAll();
    });

  });

});
