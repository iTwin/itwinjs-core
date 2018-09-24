/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { createRandomECInstanceNodeKey, createRandomId } from "@bentley/presentation-common/tests/_helpers/random";
import { Id64 } from "@bentley/bentleyjs-core";
import { RelatedElementProps, ModelProps, ElementProps, Code } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, PersistentKeysContainer, InstanceKey } from "@bentley/presentation-common";
import { PersistenceHelper } from "../lib/index";

describe("PersistenceHelper", () => {

  describe("createKeySet", () => {

    it("creates a KeySet", async () => {
      // set up test data
      const modelKey: InstanceKey = {
        className: "model:class_name",
        id: createRandomId(),
      };
      const elementKey: InstanceKey = {
        className: "element:class_name",
        id: createRandomId(),
      };
      const nodeKey = createRandomECInstanceNodeKey();
      // set up the mock
      const modelsMock = moq.Mock.ofType<IModelConnection.Models>();
      modelsMock.setup((x) => x.getProps([modelKey.id])).returns(async () => [{
        modeledElement: { id: new Id64("0x1") } as RelatedElementProps,
        classFullName: modelKey.className,
        id: modelKey.id,
      } as ModelProps]).verifiable();
      const elementsMock = moq.Mock.ofType<IModelConnection.Elements>();
      elementsMock.setup((x) => x.getProps([elementKey.id])).returns(async () => [{
        classFullName: elementKey.className,
        id: elementKey.id,
        code: Code.createEmpty(),
        model: modelKey.id,
      } as ElementProps]).verifiable();
      const imodelMock = moq.Mock.ofType<IModelConnection>();
      imodelMock.setup((x) => x.models).returns(() => modelsMock.object);
      imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);
      const imodel = imodelMock.object;

      // create a persistent container
      const container: PersistentKeysContainer = {
        models: [modelKey.id],
        elements: [elementKey.id],
        nodes: [nodeKey],
      };

      // create the key set
      const keyset = await PersistenceHelper.createKeySet(imodel, container);

      // verify mocks
      modelsMock.verifyAll();
      elementsMock.verifyAll();

      // validate result
      expect(keyset.size).to.eq(3);
      expect(keyset.has(modelKey)).to.be.true;
      expect(keyset.has(elementKey)).to.be.true;
      expect(keyset.has(nodeKey)).to.be.true;
    });

  });

  describe("createPersistentKeysContainer", () => {

    it("creates PersistentKeysContainer", async () => {
      // set up test data
      const modelKey: InstanceKey = {
        className: "model:class_name",
        id: createRandomId(),
      };
      const elementKey: InstanceKey = {
        className: "element:class_name",
        id: createRandomId(),
      };
      const nodeKey = createRandomECInstanceNodeKey();
      // set up the mock
      const imodelMock = moq.Mock.ofType<IModelConnection>();
      imodelMock.setup((x) => x.executeQuery(moq.It.isAnyString(), [modelKey.className, elementKey.className]))
        .returns(async () => [{ fullClassName: modelKey.className }])
        .verifiable();
      const imodel = imodelMock.object;

      // create a keyset
      const keyset = new KeySet();
      keyset.add(modelKey).add(elementKey).add(nodeKey);

      // create the persistent container
      const container = await PersistenceHelper.createPersistentKeysContainer(imodel, keyset);

      // verify mocks
      imodelMock.verifyAll();

      // validate result
      expect(container).to.deep.eq({
        models: [modelKey.id],
        elements: [elementKey.id],
        nodes: [nodeKey],
      });
    });

  });

});
