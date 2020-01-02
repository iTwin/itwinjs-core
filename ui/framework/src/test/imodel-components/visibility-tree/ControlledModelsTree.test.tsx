/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { render, waitForElement, cleanup, fireEvent } from "@testing-library/react";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks"; // tslint:disable-line: no-direct-imports
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { BeEvent, Id64String } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { SelectionManager, SelectionChangeEvent, Presentation, PresentationManager, RulesetManager } from "@bentley/presentation-frontend";
import { KeySet, ECInstanceNodeKey, StandardNodeTypes, InstanceKey, BaseNodeKey } from "@bentley/presentation-common";
import { initializeAsync as initializePresentationTesting, terminate as terminatePresentationTesting, HierarchyBuilder } from "@bentley/presentation-testing";
import { VisibilityHandler } from "../../../ui-framework/imodel-components/visibility-tree/VisibilityTree";
import TestUtils from "../../TestUtils";
import { ControlledModelsTree, RULESET as ControlledModelsTreeRuleset } from "../../../ui-framework/imodel-components/visibility-tree/ControlledModelsTree";

describe("ControlledModelsTree", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    Object.defineProperties(HTMLElement.prototype, {
      offsetHeight: { get: () => 200 },
      offsetWidth: { get: () => 200 },
    });
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("#unit", () => {

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
    let dataProvider: IPresentationTreeDataProvider;

    beforeEach(() => {
      cleanup();

      imodelMock.reset();
      selectionManagerMock.reset();
      presentationManagerMock.reset();
      rulesetManagerMock.reset();
      dataProvider = {
        imodel: imodelMock.object,
        rulesetId: "",
        onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
        getFilteredNodePaths: async () => [],
        getNodeKey: (node: TreeNodeItem) => (node as any).__key,
        getNodesCount: async () => 0,
        getNodes: async () => [],
        loadHierarchy: async () => { },
      };

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.selection = selectionManagerMock.object;
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
      Presentation.presentation = presentationManagerMock.object;
    });

    after(() => {
      Presentation.terminate();
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      dataProvider.getNodesCount = async () => nodes.length;
      dataProvider.getNodes = async () => nodes.map((n) => ({ __key: createKey("element", n.id), ...n }));
    };

    const setupDataProviderForEachNodeType = () => {
      setupDataProvider([
        createSubjectNode(),
        createModelNode(),
        createCategoryNode(),
        createElementNode(),
      ]);
    };

    const createSubjectNode = () => ({
      __key: createKey("subject", "subject_id"),
      id: "subject",
      label: "subject",
      extendedData: {
        isSubject: true,
      },
    });

    const createModelNode = () => ({
      __key: createKey("model", "model_id"),
      id: "model",
      label: "model",
      extendedData: {
        isModel: true,
      },
    });

    const createCategoryNode = (parentModelKey?: InstanceKey) => ({
      __key: createKey("category", "category_id"),
      id: "category",
      parentId: "model",
      label: "category",
      extendedData: {
        isCategory: true,
        modelId: parentModelKey ? parentModelKey.id : undefined,
      },
    });

    const createElementNode = (modelId?: Id64String, categoryId?: Id64String) => ({
      __key: createKey("element", "element_id"),
      id: "element",
      label: "element",
      extendedData: {
        modelId,
        categoryId,
      },
    });

    const createKey = (type: "subject" | "model" | "category" | "element", id: Id64String): ECInstanceNodeKey => {
      let className: string;
      switch (type) {
        case "subject": className = "MyDomain:Subject"; break;
        case "model": className = "MyDomain:PhysicalModel"; break;
        case "category": className = "MyDomain:SpatialCategory"; break;
        default: className = "MyDomain:SomeElementType";
      }
      return {
        type: StandardNodeTypes.ECInstanceNode,
        instanceKey: { className, id },
        pathFromRoot: [],
      };
    };

    describe("<ControlledModelsTree />", () => {

      const visibilityHandlerMock = moq.Mock.ofType<VisibilityHandler>();

      beforeEach(() => {
        visibilityHandlerMock.reset();
      });

      const isNodeChecked = (node: HTMLElement): boolean => {
        const cb = node.querySelector("input");
        return cb!.checked;
      };

      it("should match snapshot", async () => {
        setupDataProvider([{ id: "test", label: "test-node", isCheckboxVisible: true }]);
        visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));
        const result = render(<ControlledModelsTree imodel={imodelMock.object} dataProvider={dataProvider} visibilityHandler={visibilityHandlerMock.object} />);
        await waitForElement(() => result.getByText("test-node"), { container: result.container });
        expect(result.baseElement).to.matchSnapshot();
      });

      it("requests data provider to load the hierarchy if `enablePreloading` is set in props", async () => {
        const spy = sinon.spy(dataProvider, "loadHierarchy");
        render(<ControlledModelsTree imodel={imodelMock.object} dataProvider={dataProvider}
          visibilityHandler={visibilityHandlerMock.object} enablePreloading={true} />);
        expect(spy).to.be.calledOnce;
      });

      it("renders nodes without checkboxes when they're not instance-based", async () => {
        setupDataProvider([createElementNode()]);
        dataProvider.getNodeKey = (): BaseNodeKey => ({ type: "test", pathFromRoot: [] });

        visibilityHandlerMock.setup((x) => x.getDisplayStatus(moq.It.isAny())).returns(() => ({ isDisplayed: false }));

        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        const renderedNode = await waitForElement(() => result.getByText("element"));
        expect(renderedNode.querySelectorAll("input").length).to.eq(0);
      });

      it("renders nodes as unchecked when they're not displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));

        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.false);
      });

      it("renders nodes as checked when they're displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: true }));

        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.true);
      });

      it("re-renders nodes on `onVisibilityChange` callback", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        let cb: undefined | (() => void);
        visibilityHandlerMock.setup((x) => x.onVisibilityChange = moq.It.isAny()).callback((value) => cb = value).verifiable();
        visibilityHandlerMock.setup((x) => x.getDisplayStatus(moq.It.isAny())).returns(() => ({ isDisplayed: false })).verifiable(moq.Times.exactly(1));
        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (isNodeChecked(renderedNode))
            throw new Error("expecting unchecked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();

        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.getDisplayStatus(moq.It.isAny())).returns(() => ({ isDisplayed: true })).verifiable(moq.Times.exactly(1));
        cb!();
        await waitForElement(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (!isNodeChecked(renderedNode))
            throw new Error("expecting checked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();
      });

      it("re-renders nodes without checkboxes if visibility handler does not exist", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup((x) => x.getDisplayStatus(moq.It.isAny())).returns(() => ({ isDisplayed: true }));
        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        const renderedNode = await waitForElement(() => result.getByTestId("tree-node"));
        expect(renderedNode.querySelectorAll("input").length).to.eq(1);

        result.rerender(<ControlledModelsTree imodel={imodelMock.object} dataProvider={dataProvider} />);
        const rerenderedNode = await waitForElement(() => result.getByTestId("tree-node"));
        expect(rerenderedNode.querySelectorAll("input").length).to.eq(0);
      });

      it("calls visibility handler's `changeVisibility` on node checkbox state changes to 'checked'", async () => {
        const node = createModelNode();
        setupDataProvider([node]);
        visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));
        visibilityHandlerMock.setup(async (x) => x.changeVisibility(node, true)).verifiable();

        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const renderedNode = result.getByTestId("tree-node");
        const cb = renderedNode.querySelector("input");
        fireEvent.click(cb!);

        visibilityHandlerMock.verifyAll();
      });

      it("rerenders when data provider changes", async () => {
        const modelNode = createModelNode();
        setupDataProvider([modelNode]);

        visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));

        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));

        const subjectNode = createSubjectNode();
        const newDataProvider: IPresentationTreeDataProvider = {
          imodel: imodelMock.object,
          rulesetId: "",
          onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
          getFilteredNodePaths: async () => [],
          getNodeKey: (node: TreeNodeItem) => (node as any).__key,
          getNodesCount: async () => 1,
          getNodes: async () => [subjectNode],
          loadHierarchy: async () => { },
        };

        result.rerender(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={newDataProvider} />);
        await waitForElement(() => result.getByText("subject"));
      });

      it("disposes visibility handler when new is provided", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));

        const newVisibilityHandlerMock = moq.Mock.ofType<VisibilityHandler>();
        newVisibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));

        const result = render(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));

        result.rerender(<ControlledModelsTree imodel={imodelMock.object} visibilityHandler={newVisibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));

        visibilityHandlerMock.verify((x) => x.dispose(), moq.Times.once());
      });

    });

  });

  describe("#integration", () => {

    let imodel: IModelConnection;
    const testIModelPath = "src/test/test-data/JoesHouse.bim";

    before(async () => {
      await initializePresentationTesting();
    });

    after(() => {
      terminatePresentationTesting();
    });

    beforeEach(async () => {
      imodel = await IModelConnection.openSnapshot(testIModelPath);
    });

    afterEach(async () => {
      await imodel.closeSnapshot();
    });

    it("shows correct hierarchy", async () => {
      const hierarchyBuilder = new HierarchyBuilder(imodel);
      const hierarchy = await hierarchyBuilder.createHierarchy(ControlledModelsTreeRuleset);
      expect(hierarchy).to.matchSnapshot();
    });

    it("renders component with real data and no active viewport", async () => {
      const result = render(<ControlledModelsTree imodel={imodel} />);
      await waitForElement(() => result.getByText("Joe's house.bim"), { timeout: 60 * 1000 });
      expect(result.container).to.matchSnapshot();
    });

  });

});
