/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PageOptions } from "@itwin/components-react";
import { BeEvent, Logger } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { CheckBoxState } from "@itwin/core-react";
import { Node, RegisteredRuleset } from "@itwin/presentation-common";
import {
  createRandomECInstancesNode, createRandomECInstancesNodeKey, createRandomLabelDefinition, createRandomNodePathElement, createRandomRuleset,
  PromiseContainer, ResolvablePromise,
} from "@itwin/presentation-common/lib/cjs/test";
import { Presentation, PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import { PresentationTreeDataProvider } from "../../presentation-components/tree/DataProvider";
import { pageOptionsUiToPresentation } from "../../presentation-components/tree/Utils";
import { createRandomTreeNodeItem } from "../_helpers/UiComponents";

describe("TreeDataProvider", () => {

  let rulesetId: string;
  let provider: PresentationTreeDataProvider;
  let onVariableChanged: BeEvent<(variableId: string) => void>;
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    rulesetId = faker.random.word();
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  after(() => {
    Presentation.terminate();
  });

  beforeEach(() => {
    onVariableChanged = new BeEvent();
    presentationManagerMock.reset();
    rulesetVariablesManagerMock.reset();
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
    rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => onVariableChanged);
    provider = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset: rulesetId });
  });

  afterEach(() => {
    provider.dispose();
  });

  describe("dispose", () => {

    it("disposes registered ruleset", async () => {
      const registerPromise = new ResolvablePromise<RegisteredRuleset>();
      const rulesetsManagerMock = moq.Mock.ofType<RulesetManager>();
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async () => registerPromise);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetsManagerMock.object);

      const ruleset = await createRandomRuleset();
      const p = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset });
      const rulesetDisposeSpy = sinon.spy();
      await registerPromise.resolve(new RegisteredRuleset(ruleset, "test", rulesetDisposeSpy));

      expect(rulesetDisposeSpy).to.not.be.called;
      p.dispose();
      expect(rulesetDisposeSpy).to.be.calledOnce;
    });

  });

  describe("rulesetId", () => {

    it("returns rulesetId provider is initialized with", () => {
      expect(provider.rulesetId).to.eq(rulesetId);
    });

  });

  describe("imodel", () => {

    it("returns imodel provider is initialized with", () => {
      expect(provider.imodel).to.eq(imodelMock.object);
    });

  });

  describe("getNodesCount", () => {

    it("returns presentation manager result through `getNodesCount` when page options not set", async () => {
      const parentKey = createRandomECInstancesNodeKey();
      const parentNode = createRandomTreeNodeItem(parentKey);
      presentationManagerMock
        .setup(async (x) => x.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, parentKey }))
        .returns(async () => 999)
        .verifiable();
      const actualResult = await provider.getNodesCount(parentNode);
      expect(actualResult).to.eq(999);
      presentationManagerMock.verifyAll();
    });

    it("returns presentation manager result through `getNodesAndCount` when page options are set", async () => {
      const resultNodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const parentKey = createRandomECInstancesNodeKey();
      const parentNode = createRandomTreeNodeItem(parentKey);
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 123 }, parentKey }))
        .returns(async () => ({ nodes: resultNodes, count: resultNodes.length }))
        .verifiable();
      provider.pagingSize = 123;
      const actualResult = await provider.getNodesCount(parentNode);
      expect(actualResult).to.eq(resultNodes.length);
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const parentKeys = [createRandomECInstancesNodeKey(), createRandomECInstancesNodeKey()];
      const parentNodes = parentKeys.map((key) => createRandomTreeNodeItem(key));
      const resultContainers = [new PromiseContainer<{ nodes: Node[], count: number }>(), new PromiseContainer<{ nodes: Node[], count: number }>()];

      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 }, parentKey: parentKeys[0] }))
        .returns(async () => resultContainers[0].promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 }, parentKey: parentKeys[1] }))
        .returns(async () => resultContainers[1].promise)
        .verifiable(moq.Times.once());

      provider.pagingSize = 10;
      const promises = [
        provider.getNodesCount(parentNodes[0]),
        provider.getNodesCount(parentNodes[0]),
        provider.getNodesCount(parentNodes[1]),
      ];
      resultContainers.forEach((c, index) => c.resolve({ nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: index }));
      const results = await Promise.all(promises);
      expect(results[0]).to.eq(results[1]).to.eq(0);
      expect(results[2]).to.eq(1);

      presentationManagerMock.verifyAll();
    });

    it("clears memoized result when ruleset variables changes", async () => {
      const parentKey = createRandomECInstancesNodeKey();
      const parentNode = createRandomTreeNodeItem(parentKey);
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 10 }, parentKey }))
        .returns(async () => ({ nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 }))
        .verifiable(moq.Times.exactly(2));

      provider.pagingSize = 10;
      await provider.getNodesCount(parentNode);
      onVariableChanged.raiseEvent("testVar");
      await provider.getNodesCount(parentNode);

      presentationManagerMock.verifyAll();
    });

    it("uses `getNodesCount` data source override if supplied", async () => {
      const override = sinon.mock().resolves(0);
      provider = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset: rulesetId, dataSourceOverrides: { getNodesCount: override } });
      await provider.getNodesCount(undefined);
      presentationManagerMock.verify(async (x) => x.getNodesCount(moq.It.isAny()), moq.Times.never());
      expect(override).to.be.calledOnce;
    });

  });

  describe("getNodes", () => {

    it("returns presentation manager result", async () => {
      const parentKey = createRandomECInstancesNodeKey();
      const parentNode = createRandomTreeNodeItem(parentKey);
      const pageOptions: PageOptions = { start: 0, size: faker.random.number() };
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: pageOptionsUiToPresentation(pageOptions), parentKey }))
        .returns(async () => ({ nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 }))
        .verifiable();
      const actualResult = await provider.getNodes(parentNode, pageOptions);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

    it("memoizes result", async () => {
      const parentKeys = [createRandomECInstancesNodeKey(), createRandomECInstancesNodeKey()];
      const parentNodes = parentKeys.map((key) => createRandomTreeNodeItem(key));
      const resultNodesFirstPageContainer0 = new PromiseContainer<{ nodes: Node[], count: number }>();
      const resultNodesFirstPageContainer1 = new PromiseContainer<{ nodes: Node[], count: number }>();
      const resultNodesNonFirstPageContainer = new PromiseContainer<{ nodes: Node[], count: number }>();

      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined, parentKey: parentKeys[0] }))
        .returns(async () => resultNodesFirstPageContainer0.promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 0 }, parentKey: parentKeys[0] }))
        .verifiable(moq.Times.never());
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 1, size: 0 }, parentKey: parentKeys[0] }))
        .returns(async () => resultNodesNonFirstPageContainer.promise)
        .verifiable(moq.Times.once());
      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: { start: 0, size: 1 }, parentKey: parentKeys[1] }))
        .returns(async () => resultNodesFirstPageContainer1.promise)
        .verifiable(moq.Times.once());

      const promises = [
        provider.getNodes(parentNodes[0], undefined), provider.getNodes(parentNodes[0], undefined),
        provider.getNodes(parentNodes[0], { start: 0, size: 0 }), provider.getNodes(parentNodes[0], { start: 0, size: 0 }),
        provider.getNodes(parentNodes[0], { start: 1, size: 0 }), provider.getNodes(parentNodes[0], { start: 1, size: 0 }),
        provider.getNodes(parentNodes[1], { start: 0, size: 1 }), provider.getNodes(parentNodes[1], { start: 0, size: 1 }),
      ];
      resultNodesFirstPageContainer0.resolve({ nodes: [createRandomECInstancesNode()], count: 1 });
      resultNodesFirstPageContainer1.resolve({ nodes: [createRandomECInstancesNode()], count: 1 });
      resultNodesNonFirstPageContainer.resolve({ nodes: [createRandomECInstancesNode()], count: 1 });
      const results = await Promise.all(promises);

      expect(results[0]).to.eq(results[1], "results[0] should eq results[1]");
      expect(results[2])
        .to.eq(results[3], "results[2] should eq results[3]")
        .to.eq(results[0], "both results[2] and results[3] should eq results[0]");
      expect(results[4]).to.eq(results[5], "results[4] should eq results[5]");
      expect(results[6]).to.eq(results[7], "results[6] should eq results[7]");

      presentationManagerMock.verifyAll();
    });

    it("uses `getNodesAndCount` data source override if supplied", async () => {
      const override = sinon.mock().resolves({ count: 0, nodes: [] });
      provider = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset: rulesetId, dataSourceOverrides: { getNodesAndCount: override } });
      await provider.getNodes();
      presentationManagerMock.verify(async (x) => x.getNodesAndCount(moq.It.isAny()), moq.Times.never());
      expect(override).to.be.calledOnce;
    });

    it("logs a warning when requesting nodes and pagingSize is not the same as passed pageOptions", async () => {
      const pageOptions: PageOptions = { start: 0, size: 10 };
      const loggerSpy = sinon.spy(Logger, "logWarning");
      const result = { nodes: [createRandomECInstancesNode(), createRandomECInstancesNode()], count: 2 };
      presentationManagerMock.setup(async (x) => x.getNodesAndCount(moq.It.isAny())).returns(async () => result);

      // Paging size is not set and pageOptions are passed
      await provider.getNodes(undefined, pageOptions);
      expect(loggerSpy.calledOnce).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is set and no pageOptions are passed
      provider.pagingSize = 10;
      await provider.getNodes();
      expect(loggerSpy.notCalled).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is set and pageOptions are passed but not equal to paging size
      provider.pagingSize = 20;
      await provider.getNodes(undefined, pageOptions);
      expect(loggerSpy.calledOnce).to.be.true;
      loggerSpy.resetHistory();

      // Paging size is set and pageOptions are passed and equal to paging size
      provider.pagingSize = 10;
      await provider.getNodes(undefined, pageOptions);
      expect(loggerSpy.notCalled).to.be.true;
    });

  });

  describe("getFilteredNodes", () => {

    it("returns presentation manager result", async () => {
      const filter = faker.random.word();
      presentationManagerMock
        .setup(async (x) => x.getFilteredNodePaths({ imodel: imodelMock.object, rulesetOrId: rulesetId, filterText: filter }))
        .returns(async () => [createRandomNodePathElement(), createRandomNodePathElement()])
        .verifiable();
      const actualResult = await provider.getFilteredNodePaths(filter);
      expect(actualResult).to.matchSnapshot();
      presentationManagerMock.verifyAll();
    });

    it("uses `getFilteredNodePaths` data source override if supplied", async () => {
      const override = sinon.mock().resolves([]);
      provider = new PresentationTreeDataProvider({ imodel: imodelMock.object, ruleset: rulesetId, dataSourceOverrides: { getFilteredNodePaths: override } });
      await provider.getFilteredNodePaths("test");
      presentationManagerMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAny()), moq.Times.never());
      expect(override).to.be.calledOnce;
    });

  });

  describe("diagnostics", () => {

    it("passes rule diagnostics options to presentation manager", async () => {
      const diagnosticsHandler = sinon.stub();

      provider.dispose();
      provider = new PresentationTreeDataProvider({
        imodel: imodelMock.object,
        ruleset: rulesetId,
        ruleDiagnostics: { severity: "error", handler: diagnosticsHandler },
      });

      presentationManagerMock
        .setup(async (x) => x.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, diagnostics: { editor: "error", handler: diagnosticsHandler } }))
        .returns(async () => 0)
        .verifiable();
      await provider.getNodesCount();
      presentationManagerMock.verifyAll();
    });

    it("passes dev diagnostics options to presentation manager", async () => {
      const diagnosticsHandler = sinon.stub();

      provider.dispose();
      provider = new PresentationTreeDataProvider({
        imodel: imodelMock.object,
        ruleset: rulesetId,
        devDiagnostics: { backendVersion: true, perf: true, severity: "error", handler: diagnosticsHandler },
      });

      presentationManagerMock
        .setup(async (x) => x.getNodesCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, diagnostics: { backendVersion: true, perf: true, dev: "error", handler: diagnosticsHandler } }))
        .returns(async () => 0)
        .verifiable();
      await provider.getNodesCount();
      presentationManagerMock.verifyAll();
    });

  });

  describe("documentation snippets", () => {

    function mockPresentationManager(extendedData: { [key: string]: any }) {
      const node: Node = {
        key: createRandomECInstancesNodeKey(),
        label: createRandomLabelDefinition(),
        extendedData,
      };

      presentationManagerMock
        .setup(async (x) => x.getNodesAndCount({ imodel: imodelMock.object, rulesetOrId: rulesetId, paging: undefined }))
        .returns(async () => ({ nodes: [node], count: 1 }));
    }

    it("uses ExtendedDataRule to set tree item icon", async () => {
      const providerProps = {
        imodel: imodelMock.object,
        ruleset: rulesetId,
      };

      // __PUBLISH_EXTRACT_START__ Presentation.TreeDataProvider.Customization.Icon
      const dataProvider = new PresentationTreeDataProvider({
        ...providerProps,
        customizeTreeNodeItem: (treeNodeItem, node) => {
          treeNodeItem.icon = node.extendedData?.iconName;
        },
      });
      // __PUBLISH_EXTRACT_END__

      mockPresentationManager({ iconName: "custom-icon" });
      const treeNodeItems = await dataProvider.getNodes();
      expect(treeNodeItems).to.be.lengthOf(1).and.to.containSubset([
        { icon: "custom-icon" },
      ]);
    });

    it("uses ExtendedDataRule to set tree item checkbox", async () => {
      const providerProps = {
        imodel: imodelMock.object,
        ruleset: rulesetId,
      };

      // __PUBLISH_EXTRACT_START__ Presentation.TreeDataProvider.Customization.Checkbox
      const dataProvider = new PresentationTreeDataProvider({
        ...providerProps,
        customizeTreeNodeItem: (treeNodeItem, node) => {
          treeNodeItem.isCheckboxVisible = node.extendedData?.showCheckbox;
          treeNodeItem.checkBoxState = node.extendedData?.isChecked ? CheckBoxState.On : CheckBoxState.Off;
          treeNodeItem.isCheckboxDisabled = node.extendedData?.disableCheckbox;
        },
      });
      // __PUBLISH_EXTRACT_END__

      mockPresentationManager({
        showCheckbox: true,
        isChecked: true,
        disableCheckbox: false,
      });
      const treeNodeItems = await dataProvider.getNodes();
      expect(treeNodeItems).to.be.lengthOf(1).and.to.containSubset([
        {
          isCheckboxVisible: true,
          checkBoxState: CheckBoxState.On,
          isCheckboxDisabled: false,
        },
      ]);
    });

    it("uses ExtendedDataRule to set tree item style", async () => {
      const providerProps = {
        imodel: imodelMock.object,
        ruleset: rulesetId,
      };

      // __PUBLISH_EXTRACT_START__ Presentation.TreeDataProvider.Customization.Style
      const dataProvider = new PresentationTreeDataProvider({
        ...providerProps,
        customizeTreeNodeItem: (treeNodeItem, node) => {
          treeNodeItem.style = {
            isBold: node.extendedData?.isBold,
            isItalic: node.extendedData?.isItalic,
            colorOverrides: {
              color: node.extendedData?.color,
            },
          };
        },
      });
      // __PUBLISH_EXTRACT_END__

      mockPresentationManager({
        isBold: true,
        isItalic: false,
        color: 255,
      });
      const treeNodeItems = await dataProvider.getNodes();
      expect(treeNodeItems).to.be.lengthOf(1).and.to.containSubset([
        {
          style: {
            isBold: true,
            isItalic: false,
            colorOverrides: {
              color: 255,
            },
          },
        },
      ]);
    });

  });

});
