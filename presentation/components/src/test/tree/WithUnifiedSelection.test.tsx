/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as React from "react";
import * as sinon from "sinon";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import { BaseNodeKey, KeySet } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomECInstancesNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import {
  ISelectionProvider, Presentation, SelectionChangeEvent, SelectionChangeEventArgs, SelectionChangeType, SelectionHandler, SelectionHelper,
  SelectionManager,
} from "@bentley/presentation-frontend";
import { DEPRECATED_Tree as Tree, TreeNodeItem, TreeProps, UiComponents } from "@bentley/ui-components";
import { IUnifiedSelectionComponent } from "../../presentation-components/common/IUnifiedSelectionComponent";
import { IPresentationTreeDataProvider } from "../../presentation-components/tree/IPresentationTreeDataProvider";
import { PRESENTATION_TREE_NODE_KEY } from "../../presentation-components/tree/Utils";
import {
  DEPRECATED_treeWithUnifiedSelection as treeWithUnifiedSelection, TreeWithUnifiedSelectionProps,
} from "../../presentation-components/tree/WithUnifiedSelection";
import { createRandomTreeNodeItem } from "../_helpers/UiComponents";

/* eslint-disable deprecation/deprecation */

// eslint-disable-next-line @typescript-eslint/naming-convention
const PresentationTree = treeWithUnifiedSelection(Tree);

describe("Tree withUnifiedSelection", () => {
  before(async () => {
    await UiComponents.initialize(new I18N());
  });

  let testRulesetId: string;
  let imodelMock: moq.IMock<IModelConnection>;
  let dataProviderMock: moq.IMock<IPresentationTreeDataProvider>;
  let selectionHandlerMock: moq.IMock<SelectionHandler>;
  beforeEach(() => {
    imodelMock = moq.Mock.ofType<IModelConnection>();
    // note: can't use `ofType` because it creates a mock whose typeof is "function" and
    // we expect it to be "object" for IPresentationTreeDataProvider instances
    dataProviderMock = moq.Mock.ofInstance<any>({
      imodel: undefined,
      rulesetId: undefined,
      onTreeNodeChanged: undefined,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      getNodeKey: () => createRandomECInstancesNodeKey(),
      getFilteredNodePaths: async () => [],
    });
    selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
    testRulesetId = faker.random.word();
    setupDataProvider();
  });

  const setupDataProvider = (providerMock?: moq.IMock<IPresentationTreeDataProvider>, imodel?: IModelConnection, rulesetId?: string, rootNodes?: () => TreeNodeItem[], childNodes?: (parent: TreeNodeItem) => TreeNodeItem[]) => {
    if (!providerMock)
      providerMock = dataProviderMock;
    if (!imodel)
      imodel = imodelMock.object;
    if (!rulesetId)
      rulesetId = testRulesetId;
    if (!rootNodes)
      rootNodes = () => [];
    if (!childNodes)
      childNodes = () => [];
    providerMock.setup((x) => x.imodel).returns(() => imodel!);
    providerMock.setup((x) => x.rulesetId).returns(() => rulesetId!);
    providerMock.setup((x) => x.onTreeNodeChanged).returns(() => undefined);
    providerMock.setup((x) => x.getNodeKey(moq.It.isAny())).returns((n: TreeNodeItem) => (n as any)[PRESENTATION_TREE_NODE_KEY]);
    providerMock.setup(async (x) => x.getNodes(moq.It.isAny())).returns(async (p) => p ? childNodes!(p) : rootNodes!());
    providerMock.setup(async (x) => x.getNodesCount(moq.It.isAny())).returns(async (p) => (p ? childNodes!(p) : rootNodes!()).length);
  };

  it("mounts", () => {
    mount(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);
  });

  it("uses data provider's imodel", () => {
    const component = shallow(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).dive().instance() as any as IUnifiedSelectionComponent;
    expect(component.imodel).to.equal(imodelMock.object);
  });

  it("creates default implementation for selection handler when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    Presentation.setSelectionManager(selectionManagerMock.object);

    const tree = shallow(<PresentationTree
      dataProvider={dataProviderMock.object}
    />).dive().instance() as any as IUnifiedSelectionComponent;

    expect(tree.selectionHandler).to.not.be.undefined;
    expect(tree.selectionHandler!.name).to.not.be.undefined;
    expect(tree.selectionHandler!.rulesetId).to.eq(testRulesetId);
    expect(tree.selectionHandler!.imodel).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    expect(shallow(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).dive()).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const tree = shallow(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).dive();
    tree.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler and data provider when props change", () => {
    const tree = shallow<TreeProps>(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).dive();

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();
    const providerMock2 = moq.Mock.ofType<IPresentationTreeDataProvider>();
    setupDataProvider(providerMock2, imodelMock2.object, rulesetId2);

    tree.setProps({
      dataProvider: providerMock2.object,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  it("handles missing selection handler when unmounts", () => {
    const component = shallow(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true }).dive();
    component.unmount();
  });

  it("handles missing selection handler when updates", () => {
    const component = shallow(<PresentationTree
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true }).dive<TreeWithUnifiedSelectionProps, {}>();
    component.instance().componentDidUpdate!(component.props(), component.state());
  });

  describe("selection handling", () => {

    describe("checking if node should be selected", () => {

      it("returns false when there's no selection handler", () => {
        const node = createRandomTreeNodeItem();
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet());

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />, { disableLifecycleMethods: true }).dive();

        const propCallback = tree.find(Tree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.false;
      });

      it("returns true when node key is in selection", () => {
        const nodeKey = createRandomECInstancesNodeKey();
        const node = createRandomTreeNodeItem(nodeKey);
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([nodeKey]));

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();

        const propCallback = tree.find(Tree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.true;
      });

      it("returns true when ECInstance key of ECInstances node is in selection", () => {
        const nodeKey = createRandomECInstancesNodeKey();
        const node = createRandomTreeNodeItem(nodeKey);
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([nodeKey.instanceKeys[0]]));

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();

        const propCallback = tree.find(Tree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.true;
      });

      it("returns false when node key is not in selection and node is not ECInstance node", () => {
        const nodeKey: BaseNodeKey = {
          type: faker.random.word(),
          version: 0,
          pathFromRoot: [],
        };
        const node = createRandomTreeNodeItem(nodeKey);
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet());

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();

        const propCallback = tree.find(Tree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.false;
      });

    });

    describe("selecting nodes", () => {

      it("calls props callback and adds node keys to selection manager when callback returns true", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const selectionKeys = SelectionHelper.getKeysForSelection(nodes.map((n) => dataProviderMock.target.getNodeKey(n)));
        const callback = moq.Mock.ofType<(nodes: TreeNodeItem[], replace: boolean) => boolean>();
        callback.setup((x) => x(nodes, false)).returns(() => true).verifiable();

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onNodesSelected={callback.object}
        />).dive();

        tree.find(Tree).prop("onNodesSelected")!(nodes, false);

        selectionHandlerMock.verify((x) => x.addToSelection(selectionKeys), moq.Times.once());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny()), moq.Times.never());
        callback.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const callback = moq.Mock.ofType<(nodes: TreeNodeItem[], replace: boolean) => boolean>();
        callback.setup((x) => x(nodes, true)).returns(() => false).verifiable();

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onNodesSelected={callback.object}
        />).dive();

        tree.find(Tree).prop("onNodesSelected")!(nodes, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny()), moq.Times.never());
        callback.verifyAll();
      });

      it("returns false when there's no selection handler", () => {
        const nodes = [createRandomTreeNodeItem()];
        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
        />, { disableLifecycleMethods: true }).dive();

        tree.find(Tree).prop("onNodesSelected")!(nodes, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny()), moq.Times.never());
      });

      it("replaces ECInstance keys in selection manager", () => {
        const keys = [
          createRandomECInstancesNodeKey(),
          { type: faker.random.word(), version: 0, pathFromRoot: [] },
        ];
        const nodes = keys.map((key) => createRandomTreeNodeItem(key));

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();

        tree.find(Tree).prop("onNodesSelected")!(nodes, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(SelectionHelper.getKeysForSelection(keys)), moq.Times.once());
      });

    });

    describe("deselecting nodes", () => {

      it("calls props callback and removes node keys from selection manager when callback returns true", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const selectionKeys = SelectionHelper.getKeysForSelection(nodes.map((n) => dataProviderMock.target.getNodeKey(n)));
        const callback = moq.Mock.ofType<(nodes: TreeNodeItem[]) => boolean>();
        callback.setup((x) => x(nodes)).returns(() => true).verifiable();

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onNodesDeselected={callback.object}
        />).dive();

        tree.find(Tree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection(selectionKeys), moq.Times.once());
        callback.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const callback = moq.Mock.ofType<(nodes: TreeNodeItem[]) => boolean>();
        callback.setup((x) => x(nodes)).returns(() => false).verifiable();

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onNodesDeselected={callback.object}
        />).dive();

        tree.find(Tree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny()), moq.Times.never());
        callback.verifyAll();
      });

      it("returns false when there's no selection handler", () => {
        const nodes = [createRandomTreeNodeItem()];
        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
        />, { disableLifecycleMethods: true }).dive();

        tree.find(Tree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny()), moq.Times.never());
      });

      it("removes ECInstance keys from selection manager", () => {
        const keys = [
          createRandomECInstancesNodeKey(),
          { type: faker.random.word(), version: 0, pathFromRoot: [] },
        ];
        const nodes = keys.map((key) => createRandomTreeNodeItem(key));

        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();

        tree.find(Tree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection(SelectionHelper.getKeysForSelection(keys)), moq.Times.once());
      });

    });

    describe("reacting to unified selection changes", () => {

      const triggerSelectionChange = (selectionLevel: number) => {
        const args: SelectionChangeEventArgs = {
          changeType: SelectionChangeType.Clear,
          imodel: imodelMock.object,
          level: selectionLevel,
          source: selectionHandlerMock.name,
          timestamp: new Date(),
          keys: new KeySet(),
        };
        const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
        selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
        selectionHandlerMock.target.onSelect!(args, selectionProviderMock.object);
      };

      it("re-renders tree on selection changes when selection level is 0", () => {
        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();
        const s = sinon.spy(tree.instance(), "render");
        triggerSelectionChange(0);
        expect(s).to.be.calledOnce;
      });

      it("doesn't re-render tree on selection changes when selection level is not 0", () => {
        const tree = shallow(<PresentationTree
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />).dive();
        const s = sinon.spy(tree.instance(), "render");
        triggerSelectionChange(1);
        expect(s).to.not.be.called;
      });

    });

  });

});
