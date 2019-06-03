/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import {
  createRandomECInstanceKey,
  createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement,
  createRandomDescriptor, createRandomRuleset, createRandomId, createRandomSelectionScope, createRandomContent,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import {
  PresentationRpcRequestOptions, ContentRequestOptions, HierarchyRequestOptions,
  ClientStateSyncRequestOptions, SelectionScopeRequestOptions,
  HierarchyRpcRequestOptions, RulesetVariablesState,
  Node, PageOptions, KeySet, InstanceKey, NodeKey,
  Paged, RulesetManagerState, VariableValueTypes, Omit, PresentationStatus, DescriptorOverrides, NodePathElement,
} from "@bentley/presentation-common";
import { RulesetVariablesManager } from "../RulesetVariablesManager";
import { PresentationManager } from "../PresentationManager";
import { PresentationRpcImpl } from "../PresentationRpcImpl";
import { Presentation } from "../Presentation";
import { RulesetManager } from "../RulesetManager";
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

  it("uses default requestWaitTime from the Presentation implementation if it is not overriden", () => {
    Presentation.initialize();
    const impl = new PresentationRpcImpl();
    expect(impl.requestTimeout).to.equal(90000);
  });

  it("uses custom requestTimeout from the Presentation implementation if it is passed through Presentation.initialize", () => {
    const randomRequestTimeout = faker.random.number({ min: 0, max: 90000 });
    Presentation.initialize({ requestTimeout: randomRequestTimeout });
    const impl = new PresentationRpcImpl();
    expect(impl.requestTimeout).to.not.throw;
    expect(impl.requestTimeout).to.equal(randomRequestTimeout);
  });

  describe("calls forwarding", () => {

    let testData: any;
    let defaultRpcParams: PresentationRpcRequestOptions;
    let impl: PresentationRpcImpl;
    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    const rulesetsMock = moq.Mock.ofType<RulesetManager>();
    const variablesMock = moq.Mock.ofType<RulesetVariablesManager>();

    beforeEach(() => {
      rulesetsMock.reset();
      variablesMock.reset();
      presentationManagerMock.reset();
      presentationManagerMock.setup((x) => x.vars(moq.It.isAnyString())).returns(() => variablesMock.object);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsMock.object);
      Presentation.initialize({
        requestTimeout: 10,
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
      const requestContext = new ClientRequestContext();
      requestContext.enter();
    });

    it("returns invalid argument status code when using invalid imodel token", async () => {
      IModelDb.find = () => undefined as any;
      const options: Paged<HierarchyRpcRequestOptions> = {
        ...defaultRpcParams,
        rulesetId: testData.rulesetId,
      };

      const response = await impl.getNodes(testData.imodelToken, options);
      expect(response.statusCode).to.equal(PresentationStatus.InvalidArgument);
    });

    describe("verifyRequest", () => {

      beforeEach(() => {
        presentationManagerMock.setup((x) => x.getNodesCount(ClientRequestContext.current, moq.It.isAny())).returns(async () => faker.random.number());
      });

      it("succeeds if request doesn't specify clientStateId", async () => {
        const options: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          clientStateId: undefined,
          rulesetId: testData.rulesetId,
        };
        await expect(impl.getNodesCount(testData.imodelToken, options)).to.eventually.be.fulfilled;
      });

      it("succeeds if clientStateId in request matches current client state id", async () => {
        const options: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          clientStateId: faker.random.uuid(),
          rulesetId: testData.rulesetId,
        };
        await impl.syncClientState(testData.imodelToken, { ...defaultRpcParams, clientStateId: options.clientStateId, state: {} });
        await expect(impl.getNodesCount(testData.imodelToken, options)).to.eventually.be.fulfilled;
      });

      it("returns BackendOutOfSync status code if clientStateId in request doesn't match current client state id", async () => {
        const options: HierarchyRpcRequestOptions = {
          ...defaultRpcParams,
          clientStateId: undefined,
          rulesetId: testData.rulesetId,
        };
        await impl.getNodesCount(testData.imodelToken, options); // this sets current client state id
        const response = await impl.getNodesCount(testData.imodelToken, { ...options, clientStateId: faker.random.uuid() });
        expect(response.statusCode).to.equal(PresentationStatus.BackendOutOfSync);
      });

      it("handles undefined clientId", async () => {
        const options: HierarchyRpcRequestOptions = {
          clientId: undefined,
          clientStateId: faker.random.uuid(),
          rulesetId: testData.rulesetId,
        };
        await impl.syncClientState(testData.imodelToken, { clientId: "", clientStateId: options.clientStateId, state: {} });
        await expect(impl.getNodesCount(testData.imodelToken, options)).to.eventually.be.fulfilled;
      });

    });

    describe("syncClientState", () => {

      it("syncs rulesets", async () => {
        const rulesets = [await createRandomRuleset(), await createRandomRuleset()];
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [RulesetManagerState.STATE_ID]: rulesets,
          },
        };
        await impl.syncClientState(testData.imodelToken, options);
        rulesetsMock.verify((x) => x.clear(), moq.Times.once());
        rulesets.forEach((ruleset) => rulesetsMock.verify((x) => x.add(ruleset), moq.Times.once()));
      });

      it("returns InvalidArgument status code if rulesets state object is not an array", async () => {
        const ruleset = await createRandomRuleset();
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [RulesetManagerState.STATE_ID]: ruleset,
          },
        };
        const response = await impl.syncClientState(testData.imodelToken, options);
        expect(response.statusCode).to.equal(PresentationStatus.InvalidArgument);
      });

      it("syncs ruleset vars", async () => {
        const values: RulesetVariablesState = {
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
            [RulesetVariablesState.STATE_ID]: values,
          },
        };
        await impl.syncClientState(testData.imodelToken, options);
        presentationManagerMock.verify((x) => x.vars("a"), moq.Times.once());
        presentationManagerMock.verify((x) => x.vars("b"), moq.Times.once());
        variablesMock.verify((x) => x.setValue(values.a[0][0], values.a[0][1], values.a[0][2]), moq.Times.once());
        variablesMock.verify((x) => x.setValue(values.a[1][0], values.a[1][1], values.a[1][2]), moq.Times.once());
        variablesMock.verify((x) => x.setValue(values.b[0][0], values.b[0][1], values.b[0][2]), moq.Times.once());
      });

      it("returns InvalidArgument status code if ruleset vars state object is not an object", async () => {
        const options: ClientStateSyncRequestOptions = {
          clientStateId: faker.random.uuid(),
          state: {
            [RulesetVariablesState.STATE_ID]: 456,
          },
        };
        const response = await impl.syncClientState(testData.imodelToken, options);
        expect(response.statusCode).to.equal(PresentationStatus.InvalidArgument);
      });

      it("returns InvalidArgument status code if clientStateId is not specified", async () => {
        const options: ClientStateSyncRequestOptions = {
          state: {},
        };
        const response = await impl.syncClientState(testData.imodelToken, options);
        expect(response.statusCode).to.equal(PresentationStatus.InvalidArgument);
      });

    });

    describe("getNodesAndCount", () => {

      it("calls manager for root nodes", async () => {
        const getRootNodesResult: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const getRootNodesCountResult = 999;
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };

        presentationManagerMock.setup((x) => x.getNodesAndCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, undefined))
          .returns(async () => ({ nodes: getRootNodesResult, count: getRootNodesCountResult }))
          .verifiable();
        const actualResult = await impl.getNodesAndCount(testData.imodelToken, { ...defaultRpcParams, ...options });

        presentationManagerMock.verifyAll();
        expect(actualResult.result!.nodes).to.deep.eq(getRootNodesResult.map(Node.toJSON));
        expect(actualResult.result!.count).to.eq(getRootNodesCountResult);
      });

      it("calls manager for child nodes", async () => {
        const getChildNodeResult: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const getChildNodesCountResult = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };

        presentationManagerMock.setup((x) => x.getNodesAndCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(async () => ({ nodes: getChildNodeResult, count: getChildNodesCountResult }))
          .verifiable();
        const actualResult = await impl.getNodesAndCount(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));

        presentationManagerMock.verifyAll();
        expect(actualResult.result!.nodes).to.deep.eq(getChildNodeResult.map(Node.toJSON));
        expect(actualResult.result!.count).to.eq(getChildNodesCountResult);
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const getChildNodeResult: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const getChildNodesCountResult = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };

        presentationManagerMock.setup((x) => x.getNodesAndCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return ({ nodes: getChildNodeResult, count: getChildNodesCountResult });
          })
          .verifiable();
        const actualResult = await impl.getNodesAndCount(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));

        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.equal(PresentationStatus.BackendTimeout);
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const getChildNodeResult: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const getChildNodesCountResult = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };

        presentationManagerMock.setup((x) => x.getNodesAndCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return ({ nodes: getChildNodeResult, count: getChildNodesCountResult });
          })
          .verifiable();
        const actualResult = await impl.getNodesAndCount(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));

        presentationManagerMock.verifyAll();
        expect(actualResult.result!.nodes).to.deep.eq(getChildNodeResult.map(Node.toJSON));
        expect(actualResult.result!.count).to.eq(getChildNodesCountResult);
      });
    });

    describe("getNodes", () => {

      it("calls manager for root nodes", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup((x) => x.getNodes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, undefined))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getNodes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result.map(Node.toJSON));
      });
      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup((x) => x.getNodes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, undefined))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getNodes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result.map(Node.toJSON));
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup((x) => x.getNodes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, undefined))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return result;
          })
          .verifiable();
        const actualResult = await impl.getNodes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.equal(PresentationStatus.BackendTimeout);
      });

      it("calls manager for child nodes", async () => {
        const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Paged<Omit<HierarchyRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup((x) => x.getNodes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getNodes(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result.map(Node.toJSON));
      });

    });

    describe("getNodesCount", () => {

      it("calls manager for root nodes count", async () => {
        const result = 999;
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodesCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, undefined))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getNodesCount(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.eq(result);
      });

      it("calls manager for child nodes count", async () => {
        const result = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodesCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getNodesCount(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.eq(result);
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const result = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodesCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(() => Promise.resolve(result))
          .verifiable();
        const actualResult = await impl.getNodesCount(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.eq(result);
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const result = 999;
        const parentNodeKey = createRandomECInstanceNodeKey();
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodesCount(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, parentNodeKey))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return Promise.resolve(result);
          })
          .verifiable();
        const actualResult = await impl.getNodesCount(testData.imodelToken, { ...defaultRpcParams, ...options }, NodeKey.toJSON(parentNodeKey));
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.equal(PresentationStatus.BackendTimeout);
      });
    });

    describe("getFilteredNodePaths", () => {

      it("calls manager", async () => {
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getFilteredNodePaths(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, "filter"))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getFilteredNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, "filter");
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.equal(result.map(NodePathElement.toJSON));
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getFilteredNodePaths(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, "filter"))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getFilteredNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, "filter");
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.equal(result.map(NodePathElement.toJSON));
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getFilteredNodePaths(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, "filter"))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return result;
          })
          .verifiable();
        const actualResult = await impl.getFilteredNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, "filter");
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.equal(PresentationStatus.BackendTimeout);
      });

    });

    describe("getNodePaths", () => {

      it("calls manager", async () => {
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const keyArray: InstanceKey[][] = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodePaths(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, keyArray, 1))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, keyArray.map((a) => a.map(InstanceKey.toJSON)), 1);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.equal(result.map(NodePathElement.toJSON));
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const keyArray: InstanceKey[][] = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodePaths(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, keyArray, 1))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, keyArray.map((a) => a.map(InstanceKey.toJSON)), 1);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.equal(result.map(NodePathElement.toJSON));
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const result = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
        const keyArray: InstanceKey[][] = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
        const options: Omit<HierarchyRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getNodePaths(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, keyArray, 1))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return result;
          })
          .verifiable();
        const actualResult = await impl.getNodePaths(testData.imodelToken, { ...defaultRpcParams, ...options }, keyArray.map((a) => a.map(InstanceKey.toJSON)), 1);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

    });

    describe("getContentDescriptor", () => {

      it("calls manager", async () => {
        const keys = new KeySet();
        const descriptor = createRandomDescriptor();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getContentDescriptor(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, testData.displayType, moq.isKeySet(keys), undefined))
          .returns(async () => descriptor)
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, { ...defaultRpcParams, ...options },
          testData.displayType, keys.toJSON(), undefined);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(descriptor.toJSON());
      });

      it("handles undefined descriptor response", async () => {
        const keys = new KeySet();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getContentDescriptor(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, testData.displayType, moq.isKeySet(keys), undefined))
          .returns(async () => undefined)
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, { ...defaultRpcParams, ...options },
          testData.displayType, keys.toJSON(), undefined);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const keys = new KeySet();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getContentDescriptor(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, testData.displayType, moq.isKeySet(keys), undefined))
          .returns(async () => undefined)
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, { ...defaultRpcParams, ...options },
          testData.displayType, keys.toJSON(), undefined);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const keys = new KeySet();
        const descriptor = createRandomDescriptor();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getContentDescriptor(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, testData.displayType, moq.isKeySet(keys), undefined))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return descriptor;
          })
          .verifiable();
        const actualResult = await impl.getContentDescriptor(testData.imodelToken, { ...defaultRpcParams, ...options },
          testData.displayType, keys.toJSON(), undefined);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

    });

    describe("getContentAndContentSize", () => {

      it("calls manager", async () => {
        const contentSize = 789;
        const keys = new KeySet();
        const content = createRandomContent();
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContentAndSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, content.descriptor, moq.isKeySet(keys)))
          .returns(async () => ({ content, size: contentSize }))
          .verifiable();
        const actualResult = await impl.getContentAndSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          content.descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result!.content).to.deep.eq(content.toJSON());
        expect(actualResult.result!.size).to.deep.eq(contentSize);
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const contentSize = 789;
        const keys = new KeySet();
        const content = createRandomContent();
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContentAndSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, content.descriptor, moq.isKeySet(keys)))
          .returns(async () => ({ content, size: contentSize }))
          .verifiable();
        const actualResult = await impl.getContentAndSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          content.descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result!.content).to.deep.eq(content.toJSON());
        expect(actualResult.result!.size).to.deep.eq(contentSize);
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const contentSize = 789;
        const keys = new KeySet();
        const content = createRandomContent();
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContentAndSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, content.descriptor, moq.isKeySet(keys)))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return ({ content, size: contentSize });
          })
          .verifiable();
        const actualResult = await impl.getContentAndSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          content.descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

      it("handles case when manager returns no content", async () => {
        const keys = new KeySet();
        const descriptorOverrides: DescriptorOverrides = {
          displayType: "",
          contentFlags: 0,
          hiddenFieldNames: [],
        };
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock
          .setup(async (x) => x.getContentAndSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptorOverrides, moq.isKeySet(keys)))
          .returns(async () => ({ content: undefined, size: 0 }))
          .verifiable();
        const actualResult = await impl.getContentAndSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptorOverrides, keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result!.content).to.be.undefined;
        expect(actualResult.result!.size).to.eq(0);
      });

    });

    describe("getContentSetSize", () => {

      it("calls manager", async () => {
        const keys = new KeySet();
        const result = 789;
        const descriptor = createRandomDescriptor();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock
          .setup(async (x) => x.getContentSetSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptor, moq.isKeySet(keys)))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getContentSetSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result);
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const keys = new KeySet();
        const result = 789;
        const descriptor = createRandomDescriptor();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock
          .setup(async (x) => x.getContentSetSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptor, moq.isKeySet(keys)))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getContentSetSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result);
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const keys = new KeySet();
        const result = 789;
        const descriptor = createRandomDescriptor();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock
          .setup((x) => x.getContentSetSize(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptor, moq.isKeySet(keys)))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return result;
          })
          .verifiable();
        const actualResult = await impl.getContentSetSize(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });
    });

    describe("getContent", () => {

      it("calls manager", async () => {
        const keys = new KeySet();
        const content = createRandomContent();
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContent(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, content.descriptor, moq.isKeySet(keys)))
          .returns(async () => content)
          .verifiable();
        const actualResult = await impl.getContent(testData.imodelToken, { ...defaultRpcParams, ...options },
          content.descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(content.toJSON());
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const keys = new KeySet();
        const content = createRandomContent();
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContent(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, content.descriptor, moq.isKeySet(keys)))
          .returns(async () => content)
          .verifiable();
        const actualResult = await impl.getContent(testData.imodelToken, { ...defaultRpcParams, ...options },
          content.descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(content.toJSON());
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const keys = new KeySet();
        const content = createRandomContent();
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContent(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, content.descriptor, moq.isKeySet(keys)))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return content;
          })
          .verifiable();
        const actualResult = await impl.getContent(testData.imodelToken, { ...defaultRpcParams, ...options },
          content.descriptor.toJSON(), keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

      it("handles case when manager returns no content", async () => {
        const keys = new KeySet();
        const descriptorOverrides: DescriptorOverrides = {
          displayType: "",
          contentFlags: 0,
          hiddenFieldNames: [],
        };
        const options: Paged<Omit<ContentRequestOptions<IModelToken>, "imodel">> = {
          rulesetId: testData.rulesetId,
          paging: testData.pageOptions,
        };
        presentationManagerMock.setup(async (x) => x.getContent(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptorOverrides, moq.isKeySet(keys)))
          .returns(async () => undefined)
          .verifiable();
        const actualResult = await impl.getContent(testData.imodelToken, { ...defaultRpcParams, ...options },
          descriptorOverrides, keys.toJSON());
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
      });

    });

    describe("getDistinctValues", () => {

      it("calls manager", async () => {
        const distinctValues = [faker.random.word(), faker.random.word()];
        const keys = new KeySet();
        const descriptor = createRandomDescriptor();
        const fieldName = faker.random.word();
        const maximumValueCount = faker.random.number();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getDistinctValues(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptor, moq.isKeySet(keys), fieldName, maximumValueCount))
          .returns(async () => distinctValues)
          .verifiable();
        const actualResult = await impl.getDistinctValues(testData.imodelToken, { ...defaultRpcParams, ...options }, descriptor.toJSON(),
          keys.toJSON(), fieldName, maximumValueCount);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(distinctValues);
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const distinctValues = [faker.random.word(), faker.random.word()];
        const keys = new KeySet();
        const descriptor = createRandomDescriptor();
        const fieldName = faker.random.word();
        const maximumValueCount = faker.random.number();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getDistinctValues(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptor, moq.isKeySet(keys), fieldName, maximumValueCount))
          .returns(async () => distinctValues)
          .verifiable();
        const actualResult = await impl.getDistinctValues(testData.imodelToken, { ...defaultRpcParams, ...options }, descriptor.toJSON(),
          keys.toJSON(), fieldName, maximumValueCount);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(distinctValues);
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const distinctValues = [faker.random.word(), faker.random.word()];
        const keys = new KeySet();
        const descriptor = createRandomDescriptor();
        const fieldName = faker.random.word();
        const maximumValueCount = faker.random.number();
        const options: Omit<ContentRequestOptions<IModelToken>, "imodel"> = {
          rulesetId: testData.rulesetId,
        };
        presentationManagerMock.setup((x) => x.getDistinctValues(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, descriptor, moq.isKeySet(keys), fieldName, maximumValueCount))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return distinctValues;
          })
          .verifiable();
        const actualResult = await impl.getDistinctValues(testData.imodelToken, { ...defaultRpcParams, ...options }, descriptor.toJSON(),
          keys.toJSON(), fieldName, maximumValueCount);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

    });

    describe("getDisplayLabel", () => {

      it("calls manager", async () => {
        const result = faker.random.word();
        const key = createRandomECInstanceKey();
        presentationManagerMock.setup(async (x) => x.getDisplayLabel(ClientRequestContext.current, { imodel: testData.imodelMock.object }, key))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getDisplayLabel(testData.imodelToken, { ...defaultRpcParams }, InstanceKey.toJSON(key));
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.eq(result);
      });

    });

    describe("getDisplayLabels", () => {

      it("calls manager", async () => {
        const result = [faker.random.word(), faker.random.word()];
        const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        presentationManagerMock.setup(async (x) => x.getDisplayLabels(ClientRequestContext.current, { imodel: testData.imodelMock.object }, keys))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getDisplayLabels(testData.imodelToken, { ...defaultRpcParams }, keys.map(InstanceKey.toJSON));
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result);
      });

    });

    describe("getSelectionScopes", () => {

      it("calls manager", async () => {
        const options: SelectionScopeRequestOptions<IModelToken> = {
          imodel: testData.imodelToken,
        };
        const result = [createRandomSelectionScope()];
        presentationManagerMock.setup(async (x) => x.getSelectionScopes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getSelectionScopes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result);
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const options: SelectionScopeRequestOptions<IModelToken> = {
          imodel: testData.imodelToken,
        };
        const result = [createRandomSelectionScope()];
        presentationManagerMock.setup(async (x) => x.getSelectionScopes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.getSelectionScopes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result);
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const options: SelectionScopeRequestOptions<IModelToken> = {
          imodel: testData.imodelToken,
        };
        const result = [createRandomSelectionScope()];
        presentationManagerMock.setup((x) => x.getSelectionScopes(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return result;
          })
          .verifiable();
        const actualResult = await impl.getSelectionScopes(testData.imodelToken, { ...defaultRpcParams, ...options });
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

    });

    describe("computeSelection", () => {

      it("calls manager", async () => {
        const options: SelectionScopeRequestOptions<IModelToken> = {
          imodel: testData.imodelToken,
        };
        const scope = createRandomSelectionScope();
        const ids = [createRandomId()];
        const result = new KeySet();
        presentationManagerMock.setup(async (x) => x.computeSelection(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, ids, scope.id))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.computeSelection(testData.imodelToken, { ...defaultRpcParams, ...options }, ids, scope.id);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result.toJSON());
      });

      it("should return result if `PresentationStatus.BackendTimeout` is set to 0", async () => {
        Presentation.terminate();
        Presentation.initialize({
          requestTimeout: 0,
          clientManagerFactory: () => presentationManagerMock.object,
        });
        const options: SelectionScopeRequestOptions<IModelToken> = {
          imodel: testData.imodelToken,
        };
        const scope = createRandomSelectionScope();
        const ids = [createRandomId()];
        const result = new KeySet();
        presentationManagerMock.setup(async (x) => x.computeSelection(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, ids, scope.id))
          .returns(async () => result)
          .verifiable();
        const actualResult = await impl.computeSelection(testData.imodelToken, { ...defaultRpcParams, ...options }, ids, scope.id);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.deep.eq(result.toJSON());
      });

      it("should return `PresentationStatus.BackendTimeout` without any result if manager request takes more than requestTimeout", async () => {
        const options: SelectionScopeRequestOptions<IModelToken> = {
          imodel: testData.imodelToken,
        };
        const scope = createRandomSelectionScope();
        const ids = [createRandomId()];
        const result = new KeySet();
        presentationManagerMock.setup((x) => x.computeSelection(ClientRequestContext.current, { ...options, imodel: testData.imodelMock.object }, ids, scope.id))
          .returns(async () => {
            await new Promise((resolve) => setTimeout(resolve, impl.requestTimeout));
            return result;
          })
          .verifiable();
        const actualResult = await impl.computeSelection(testData.imodelToken, { ...defaultRpcParams, ...options }, ids, scope.id);
        presentationManagerMock.verifyAll();
        expect(actualResult.result).to.be.undefined;
        expect(actualResult.statusCode).to.eq(PresentationStatus.BackendTimeout);
      });

    });

  });

});
