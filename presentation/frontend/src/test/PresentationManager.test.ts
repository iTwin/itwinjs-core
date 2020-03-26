/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import {
  createRandomDescriptor,
  createRandomECInstancesNode, createRandomECInstancesNodeKey, createRandomNodePathElement,
  createRandomECInstanceKey, createRandomRuleset, createRandomLabelDefinition,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  KeySet, Content, HierarchyRequestOptions, Node, Ruleset, VariableValueTypes, RulesetVariable,
  Paged, ContentRequestOptions, RpcRequestsHandler, LabelRequestOptions, NodeKey, NodePathElement, InstanceKey, Descriptor, RequestPriority,
} from "@bentley/presentation-common";
import { PresentationManager } from "../presentation-frontend/PresentationManager";
import { RulesetVariablesManagerImpl } from "../presentation-frontend/RulesetVariablesManager";
import { RulesetManagerImpl } from "../presentation-frontend/RulesetManager";
import { Presentation } from "../presentation-frontend/Presentation";

describe("PresentationManager", () => {

  let rpcRequestsHandlerMock: moq.IMock<RpcRequestsHandler>;
  let manager: PresentationManager;
  const i18nMock = moq.Mock.ofType<I18N>();
  const testData = {
    imodelToken: new IModelToken(""),
    imodelMock: moq.Mock.ofType<IModelConnection>(),
    pageOptions: { start: 0, size: 0 },
    rulesetId: "",
  };

  beforeEach(() => {
    mockI18N();
    testData.imodelMock.setup((x) => x.getRpcToken()).returns(() => testData.imodelToken);
    testData.pageOptions = { start: faker.random.number(), size: faker.random.number() };
    testData.rulesetId = faker.random.uuid();
    rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
    manager = PresentationManager.create({ rpcRequestsHandler: rpcRequestsHandlerMock.object });
  });

  afterEach(() => {
    manager.dispose();
    Presentation.terminate();
  });

  const mockI18N = () => {
    i18nMock.reset();
    Presentation.setI18nManager(i18nMock.object);
    const resolvedPromise = new Promise<void>((resolve) => resolve());
    i18nMock.setup((x) => x.registerNamespace(moq.It.isAny())).returns((name: string) => new I18NNamespace(name, resolvedPromise));
    i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns((stringId) => stringId);
  };

  const toIModelTokenOptions = <TOptions extends { imodel: IModelConnection, locale?: string }>(options: TOptions) => {
    // 1. put default `locale`
    // 2. put all `options` members (if `locale` is set, it'll override the default put at #1)
    // 3. put `imodel` of type `IModelToken` which overwrites the `imodel` from `options`
    return Object.assign({}, { locale: undefined }, options, {
      imodel: testData.imodelToken,
    });
  };

  const addRulesetAndVariablesToOptions = <TOptions extends { rulesetId?: string, rulesetOrId?: Ruleset | string }>(options: TOptions) => {
    const { rulesetId, rulesetOrId } = options;

    let foundRulesetOrId;
    if (rulesetOrId && typeof rulesetOrId === "object") {
      foundRulesetOrId = rulesetOrId;
    } else {
      foundRulesetOrId = rulesetOrId || rulesetId || "";
    }

    return { ...options, rulesetOrId: foundRulesetOrId, rulesetVariables: [] };
  };

  const prepareOptions = <TOptions extends { imodel: IModelConnection, locale?: string, rulesetId?: string, rulesetOrId?: Ruleset | string }>(options: TOptions) => {
    return toIModelTokenOptions(addRulesetAndVariablesToOptions(options));
  };

  describe("constructor", () => {

    it("sets active locale if supplied with props", async () => {
      const props = { activeLocale: faker.locale };
      const mgr = PresentationManager.create(props);
      expect(mgr.activeLocale).to.eq(props.activeLocale);
    });

    it("sets custom RpcRequestsHandler if supplied with props", async () => {
      const handler = moq.Mock.ofType<RpcRequestsHandler>();
      const props = { rpcRequestsHandler: handler.object };
      const mgr = PresentationManager.create(props);
      expect(mgr.rpcRequestsHandler).to.eq(handler.object);
    });

    it("sets RpcRequestsHandler clientId if supplied with props", async () => {
      const props = { clientId: faker.random.uuid() };
      const mgr = PresentationManager.create(props);
      expect(mgr.rpcRequestsHandler.clientId).to.eq(props.clientId);
    });

  });

  describe("dispose", () => {

    it("disposes RPC requests handler", () => {
      manager.dispose();
      rpcRequestsHandlerMock.verify((x) => x.dispose(), moq.Times.once());
    });

  });

  describe("onConnection", () => {

    it("caches IModelConnection", () => {
      const managerStub = sinon.stub(manager, "onNewiModelConnection");
      const imodelConnectionMock = moq.Mock.ofType<IModelConnection>();
      (manager as any).onConnection(imodelConnectionMock.object).then(() => {
        (manager as any).onConnection(imodelConnectionMock.object).then(() => {
          expect(managerStub.calledOnceWith(imodelConnectionMock.object)).to.be.true;
        });
      });
    });

  });

  describe("activeLocale", () => {

    it("requests with manager's locale if not set in request options", async () => {
      const locale = faker.random.locale();
      manager.activeLocale = locale;
      await manager.getNodesCount({
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      });
      rpcRequestsHandlerMock.verify((x) => x.getNodesCount({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        locale,
        rulesetVariables: [],
      }, undefined), moq.Times.once());
    });

    it("requests with request's locale if set", async () => {
      const locale = faker.random.locale();
      await manager.getNodesCount({
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        locale,
      });
      rpcRequestsHandlerMock.verify((x) => x.getNodesCount({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        locale,
        rulesetVariables: [],
      }, undefined), moq.Times.once());
    });

  });

  describe("rulesets", () => {

    it("returns rulesets manager", () => {
      const rulesets = manager.rulesets();
      expect(rulesets).to.be.instanceOf(RulesetManagerImpl);
    });

  });

  describe("vars", () => {

    it("returns ruleset variables manager", () => {
      const vars = manager.vars(testData.rulesetId);
      expect(vars).to.be.instanceOf(RulesetVariablesManagerImpl);

      const vars2 = manager.vars(testData.rulesetId);
      expect(vars2).to.equal(vars);
    });

  });

  describe("getNodesAndCount", () => {

    it("requests root nodes from proxy", async () => {
      const result = { nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 };
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesAndCount(prepareOptions(options), undefined))
        .returns(async () => ({ ...result, nodes: result.nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = { nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 };
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesAndCount(prepareOptions(options), NodeKey.toJSON(parentNodeKey)))
        .returns(async () => ({ ...result, nodes: result.nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options, parentNodeKey);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodes", () => {

    it("requests root nodes from proxy", async () => {
      const result = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodes(prepareOptions(options), undefined))
        .returns(async () => result.map(Node.toJSON))
        .verifiable();
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodes(prepareOptions(options), NodeKey.toJSON(parentNodeKey)))
        .returns(async () => result.map(Node.toJSON))
        .verifiable();
      const actualResult = await manager.getNodes(options, parentNodeKey);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodesCount", () => {

    it("requests root nodes count from proxy", async () => {
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(prepareOptions(options), undefined))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes count from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(prepareOptions(options), NodeKey.toJSON(parentNodeKey)))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options, parentNodeKey);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getFilteredNodePaths", () => {

    it("calls getFilteredNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.getFilteredNodePaths(prepareOptions(options), "filter"))
        .returns(async () => value.map(NodePathElement.toJSON))
        .verifiable();
      const result = await manager.getFilteredNodePaths(options, "filter");
      expect(result).to.be.deep.equal(value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodePaths", () => {

    it("calls getNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const keyArray = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.getNodePaths(prepareOptions(options), keyArray.map((k) => k.map(InstanceKey.toJSON)), 1))
        .returns(async () => value.map(NodePathElement.toJSON))
        .verifiable();
      const result = await manager.getNodePaths(options, keyArray, 1);
      expect(result).to.be.deep.equal(value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("loadHierarchy", () => {

    it("calls loadHierarchy through proxy with default 'preload' priority", async () => {
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.loadHierarchy({ ...prepareOptions(options), priority: RequestPriority.Preload }))
        .returns(() => Promise.resolve())
        .verifiable();
      await manager.loadHierarchy(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("calls loadHierarchy through proxy with specified priority", async () => {
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        priority: 999,
      };
      rpcRequestsHandlerMock.setup((x) => x.loadHierarchy({ ...prepareOptions(options), priority: 999 }))
        .returns(() => Promise.resolve())
        .verifiable();
      await manager.loadHierarchy(options);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContentDescriptor", () => {

    it("requests descriptor from proxy and rebuilds parentship", async () => {
      const keyset = new KeySet();
      const result = createRandomDescriptor();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(prepareOptions(options), "test", keyset.toJSON(), undefined))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined);
      expect(actualResult).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles undefined descriptor", async () => {
      const keyset = new KeySet();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(prepareOptions(options), "test", keyset.toJSON(), undefined))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.be.undefined;
    });

  });

  describe("getContentSetSize", () => {

    it("requests content set size from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = faker.random.number();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentSetSize(prepareOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options, descriptor, keyset);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = faker.random.number();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentSetSize(prepareOptions(options), overrides, keyset.toJSON()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options, overrides, keyset);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContent", () => {

    it("requests content from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = new Content(descriptor, []);
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContent(prepareOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContent(options, descriptor, keyset);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = new Content(descriptor, []);
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContent(prepareOptions(options), overrides, keyset.toJSON()))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContent(options, overrides, keyset);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContent(prepareOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContent(options, descriptor, keyset);
      expect(actualResult).to.be.undefined;
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContentAndContentSize", () => {

    it("requests content and contentSize from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        content: new Content(descriptor, []),
        size: 0,
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentAndSize(prepareOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => ({ ...result, content: result.content.toJSON() }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, descriptor, keyset);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content and content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = {
        content: new Content(descriptor, []),
        size: 0,
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentAndSize(prepareOptions(options), overrides, keyset.toJSON()))
        .returns(async () => ({ ...result, content: result.content.toJSON() }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, overrides, keyset);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        content: undefined,
        size: 0,
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentAndSize(prepareOptions(options), moq.deepEquals(descriptor.createStrippedDescriptor()), keyset.toJSON()))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, descriptor, keyset);
      expect(actualResult).to.be.undefined;
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getDistinctValues", () => {

    it("requests distinct values", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      const result = [faker.random.word(), faker.random.word()];
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getDistinctValues(prepareOptions(options),
          moq.deepEquals(descriptor.createStrippedDescriptor().toJSON()),
          moq.deepEquals(keyset.toJSON()), fieldName, maximumValueCount))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDistinctValues(options, descriptor, keyset, fieldName, maximumValueCount);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("passes 0 for maximumValueCount by default", async () => {
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getDistinctValues(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAnyString(), 0))
        .verifiable();
      await manager.getDistinctValues(options, createRandomDescriptor(), new KeySet(), "");
      rpcRequestsHandlerMock.verifyAll();
    });
  });

  describe("getDisplayLabelDefinition", () => {

    it("requests display label definition", async () => {
      const key = createRandomECInstanceKey();
      const result = createRandomLabelDefinition();
      const options: LabelRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getDisplayLabelDefinition(toIModelTokenOptions(options), key))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinition(options, key);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getDisplayLabelDefinitions", () => {

    it("requests display labels definitions", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      const options: LabelRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getDisplayLabelDefinitions(toIModelTokenOptions(options), keys))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinitions(options, keys);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("options handling", () => {

    let testRuleset: Ruleset;
    let testRulesetVariable: RulesetVariable;

    beforeEach(async () => {
      testRuleset = await createRandomRuleset();
      await manager.rulesets().add(testRuleset);
      testRulesetVariable = { id: faker.random.word(), type: VariableValueTypes.String, value: faker.random.word() };
      await manager.vars(testRuleset.id).setString(testRulesetVariable.id, testRulesetVariable.value as string);
    });

    it("adds ruleset to the options", async () => {
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        paging: testData.pageOptions,
        rulesetOrId: testRuleset.id,
      };
      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [testRulesetVariable] };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions), undefined))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("leaves ruleset in the options if already provided", async () => {
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testRuleset,
        paging: testData.pageOptions,
      };

      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [testRulesetVariable] };

      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions), undefined))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("adds empty values if ruleset and rulesetId is not provided", async () => {
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        paging: testData.pageOptions,
        rulesetOrId: "",
      };
      const expectedOptions = { ...options, rulesetVariables: [] };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions), undefined))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("appends ruleset variables from ruleset variables manager", async () => {
      const rulesetVariable = { id: faker.random.word(), type: VariableValueTypes.String, value: faker.random.word() };
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        paging: testData.pageOptions,
        rulesetOrId: testRuleset,
        rulesetVariables: [rulesetVariable],
      };

      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [rulesetVariable, testRulesetVariable] };

      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions), undefined))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

});
