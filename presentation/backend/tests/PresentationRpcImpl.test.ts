/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/tests/_helpers/Mocks";
import {
  createRandomECInstanceKey,
  createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement,
  createRandomDescriptor, createRandomRuleset, createRandomId,
} from "@bentley/presentation-common/tests/_helpers/random";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  PageOptions, KeySet, PresentationError, InstanceKey,
  Paged, IRulesetManager,
  HierarchyRequestOptions, ContentRequestOptions, IRulesetVariablesManager,
  Omit,
} from "@bentley/presentation-common";
import { Node, Descriptor, Content } from "@bentley/presentation-common";
import { VariableValueTypes } from "@bentley/presentation-common/lib/IRulesetVariablesManager";
import {
  RpcRequestOptions, HierarchyRpcRequestOptions, ClientStateSyncRequestOptions,
} from "@bentley/presentation-common/lib/PresentationRpcInterface";
import RulesetVariablesManager from "../lib/RulesetVariablesManager";
import PresentationManager from "../lib/PresentationManager";
import PresentationRpcImpl from "../lib/PresentationRpcImpl";
import Presentation from "../lib/Presentation";
import "./IModelHostSetup";

describe("PresentationRpcImpl", () => {

  afterEach(() => {
    Presentation.terminate();
  });

  it("uses default PresentationManager implementation if not overridden", () => {
    Presentation.initialize();
    const impl = new PresentationRpcImpl();
    expect(impl.getManager()).is.instanceof(PresentationManager);
  });

  describe("calls forwarding", () => {

    let testData: any;
    let defaultRpcParams: RpcRequestOptions;
    let impl: PresentationRpcImpl;
    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    const rulesetsMock = moq.Mock.ofType<IRulesetManager>();
    const variablesMock = moq.Mock.ofType<RulesetVariablesManager>();

    beforeEach(() => {
      rulesetsMock.reset();
      variablesMock.reset();
      presentationManagerMock.reset();
      presentationManagerMock.setup((x) => x.vars(moq.It.isAnyString())).returns(() => variablesMock.object);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsMock.object);
      Presentation.initialize({
        clientManagerFactory: () => presentationManagerMock.object,
      });
      testData = {
        imodelToken: new IModelToken(),
        imodelMock: moq.Mock.ofType<IModelDb>(),
        rulesetId: faker.random.word(),
        pageOptions: { start: 123, size: 456 } as PageOptions,
        displayType: "sample display type",
        keys: new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()]),
      };
      defaultRpcParams = { clientId: faker.random.uuid() };
      testData.imodelMock.setup((x: IModelDb) => x.iModelToken).returns(() => testData.imodelToken);
      IModelDb.find = () => testData.imodelMock.object;
      impl = new PresentationRpcImpl();
      const actx = new ActivityLoggingContext("");
      actx.enter();
    });

    it("throws when using invalid imodel token", async () => {
      IModelDb.find = () => undefined as any;
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcParams,
        rulesetId: testData.rulesetId,
      };
      await expect(impl.getRootNodes(testData.imodelToken, options)).to.eventually.be.rejectedWith(PresentationError);
    });

    describe("verifyRequest", () => {

      beforeEach(() => {
        presentationManagerMock.setup((x) => x.getRootNodesCount(moq.It.isAny())).returns(async () => faker.random.number());
      });

      it("succeeds if request doesn't specify clientStateId", async () => {
        const options: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          clientStateId: undefined,
          rulesetId: testData.rulesetId,
        };
        await expect(impl.getRootNodesCount(testData.imodelToken, options)).to.eventually.be.fulfilled;
      });

      it("succeeds if clientStateId in request matches current client state id", async () => {
        const options: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          clientStateId: faker.random.uuid(),
          rulesetId: testData.rulesetId,
        };
        await impl.syncClientState(testData.imodelToken, { ...defaultRpcParams, clientStateId: options.clientStateId, state: {} });
        await expect(impl.getRootNodesCount(testData.imodelToken, options)).to.eventually.be.fulfilled;
      });

      it("throws if clientStateId in request doesn't match current client state id", async () => {
        const options: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          clientStateId: undefined,
          rulesetId: testData.rulesetId,
        };
        await impl.getRootNodesCount(testData.imodelToken, options); // this sets current client state id
        const request = impl.getRootNodesCount(testData.imodelToken, { ...options, clientStateId: faker.random.uuid() });
        await expect(request).to.eventually.be.rejectedWith(PresentationError);
      });

      it("handles undefined clientId", async () => {
        const options: HierarchyRpcRequestOptions = {
          clientId: undefined,
          clientStateId: faker.random.uuid(),
          rulesetId: testData.rulesetId,
        };
        await impl.syncClientState(testData.imodelToken, { clientId: "", clientStateId: options.clientStateId, state: {} });
        await expect(impl.getRootNodesCount(testData.imodelToken, options)).to.eventually.be.fulfilled;
      });

    });

    describe("syncClientState", () => {

      it("syncs rulesets", async () => {
        const rulesets = [await createRandomRuleset(), await createRandomRuleset()];
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [IRulesetManager.STATE_ID]: rulesets,
          },
        };
        await impl.syncClientState(testData.imodelToken, options);
        rulesetsMock.verify((x) => x.clear(), moq.Times.once());
        rulesets.forEach((ruleset) => rulesetsMock.verify((x) => x.add(ruleset), moq.Times.once()));
      });

      it("throws if rulesets state object is not an array", async () => {
        const ruleset = await createRandomRuleset();
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [IRulesetManager.STATE_ID]: ruleset,
          },
        };
        await expect(impl.syncClientState(testData.imodelToken, options)).to.eventually.be.rejectedWith(PresentationError);
      });

      it("syncs ruleset vars", async () => {
        const values: IRulesetVariablesManager.State = {
          a: [
            [faker.random.word(), VariableValueTypes.String, faker.random.words()],
            [faker.random.word(), VariableValueTypes.Int, faker.random.number()],
          ],
          b: [
            [faker.random.word(), VariableValueTypes.Id64, createRandomId()],
          ],
        };
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [IRulesetVariablesManager.STATE_ID]: values,
          },
        };
        await impl.syncClientState(testData.imodelToken, options);
        presentationManagerMock.verify((x) => x.vars("a"), moq.Times.once());
        presentationManagerMock.verify((x) => x.vars("b"), moq.Times.once());
        variablesMock.verify((x) => x.setValue(values.a[0][0], values.a[0][1], values.a[0][2]), moq.Times.once());
        variablesMock.verify((x) => x.setValue(values.a[1][0], values.a[1][1], values.a[1][2]), moq.Times.once());
        variablesMock.verify((x) => x.setValue(values.b[0][0], values.b[0][1], values.b[0][2]), moq.Times.once());
      });

      it("throws if ruleset vars state object is not an object", async () => {
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [IRulesetVariablesManager.STATE_ID]: 456,
          },
        };
        await expect(impl.syncClientState(testData.imodelToken, options)).to.eventually.be.rejectedWith(PresentationError);
      });

      it("throws if clientStateId is not specified", async () => {
        const options: ClientStateSyncRequestOptions = {
          state: {},
        };
        await expect(impl.syncClientState(testData.imodelToken, options)).to.eventually.be.rejectedWith(PresentationError);
      });

    });

    describe("getRootNodes", () => {

      it("calls manager", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup((x) => x.getRootNodes({ ...options, imodel: testData.imodelMock.object }))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getRootNodes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });

    });

    describe("getRootNodesCount", () => {

      it("calls manager", async () => {
        const result = 999;
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getRootNodesCount({ ...options, imodel: testData.imodelMock.object }))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getRootNodesCount(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult).to.eq(result);
      });

    });

    describe("getChildren", () => {

      it("calls manager", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup((x) => x.getChildren({ ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getChildren(testData.imodelToken, { ...defaultRpcParams, ...options }, parentNodeKey);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });

    });

    describe("getChildrenCount", () => {

      it("calls manager", async () => {
        const result = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getChildrenCount({ ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getChildrenCount(testData.imodelToken, { ...defaultRpcParams, ...options }, parentNodeKey);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.eq(result);
      });

    });

    describe("getFilteredNodePaths", () => {

      it("calls manager", async () => {
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getFilteredNodePaths({ ...options, imodel: testData.imodelMock.object }, "filter"))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getFilteredNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, "filter");
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.equal(result);
      });

    });

    describe("getNodePaths", () => {

      it("calls manager", async () => {
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const keyArray: InstanceKey[][] = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodePaths({ ...options, imodel: testData.imodelMock.object }, keyArray, 1))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, keyArray, 1);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.equal(result);
      });

    });

    describe("getContentDescriptor", () => {

      it("calls manager and resets descriptors parentship", async () => {

        const descriptorMock = moq.Mock.ofType<Descriptor>();
        moq.configureForPromiseResult(descriptorMock);
        descriptorMock.setup((x) => x.resetParentship).verifiable();
        const result = descriptorMock.object;

        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getContentDescriptor({ ...options, imodel: testData.imodelMock.object }, testData.displayType, testData.inputKeys, undefined))
          .returns(async () => result)
          .verifiable();

        const actualResult = await impl.getContentDescriptor(testData.imodelToken, { ...defaultRpcParams, ...options },
          testData.displayType, testData.inputKeys, undefined);
        presentationManagerMock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(result);
      });

      it("handles undefined descriptor response", async () => {
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getContentDescriptor({ ...options, imodel: testData.imodelMock.object }, testData.displayType, testData.inputKeys, undefined))
          .returns(async () => undefined)
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, { ...defaultRpcParams, ...options },
          testData.displayType, testData.inputKeys, undefined);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.be.undefined;
      });

    });

    describe("getContentSetSize", () => {

      it("calls manager", async () => {
        const result = 789;
        const descriptor: Descriptor = createRandomDescriptor();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock
          .setup((x) => x.getContentSetSize({ ...options, imodel: testData.imodelMock.object }, descriptor, testData.inputKeys))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getContentSetSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptor, testData.inputKeys);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(result);
      });

    });

    describe("getContent", () => {

      it("calls manager", async () => {
        const descriptorMock = moq.Mock.ofType<Descriptor>();
        descriptorMock.setup((x) => x.resetParentship).verifiable();

        const contentMock = moq.Mock.ofType<Content>();
        moq.configureForPromiseResult(contentMock);
        contentMock.setup((x) => x.descriptor).returns(() => descriptorMock.object);
        contentMock.setup((x) => x.contentSet).returns(() => []);

        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };

        presentationManagerMock.setup((x) => x.getContent({ ...options, imodel: testData.imodelMock.object }, descriptorMock.object, testData.inputKeys))
          .returns(async () => contentMock.object)
          .verifiable();
        const actualResult = await impl.getContent(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptorMock.object, testData.inputKeys);
        presentationManagerMock.verifyAll();
        descriptorMock.verifyAll();
        expect(actualResult).to.eq(contentMock.object);
      });

    });

    describe("getDistinctValues", () => {

      it("calls manager", async () => {
        const distinctValues = [faker.random.word(), faker.random.word()];
        const descriptor = createRandomDescriptor();
        const fieldName = faker.random.word();
        const maximumValueCount = faker.random.number();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getDistinctValues({ ...options, imodel: testData.imodelMock.object }, descriptor, testData.inputKeys, fieldName, maximumValueCount))
          .returns(async () => distinctValues)
          .verifiable();
        const actualResult = await impl.getDistinctValues(testData.imodelToken, { ...defaultRpcParams, ...options }, descriptor,
          testData.inputKeys, fieldName, maximumValueCount);
        presentationManagerMock.verifyAll();
        expect(actualResult).to.deep.eq(distinctValues);
      });

    });

  });

});
