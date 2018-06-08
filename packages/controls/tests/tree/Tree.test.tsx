/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import * as spies from "@helpers/Spies";
import { createRandomECInstanceNodeKey } from "@helpers/random/Hierarchy";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, BaseNodeKey, ECInstanceNodeKey } from "@bentley/ecpresentation-common";
import {
  ECPresentation, ECPresentationManager,
  SelectionHandler, SelectionManager, SelectionChangeEvent, ISelectionProvider, SelectionChangeEventArgs, SelectionChangeType,
} from "@bentley/ecpresentation-frontend";
import { Tree as BaseTree, TreeNodeItem } from "@bentley/ui-components";
import DataProvider from "@src/tree/DataProvider";
import Tree, { Props as TreeProps, SelectionTarget} from "@src/tree/Tree";

describe("Tree", () => {

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<DataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  beforeEach(() => {
    selectionHandlerMock.reset();
    setupDataProvider();
  });

  const setupDataProvider = (rootNodes?: () => TreeNodeItem[], childNodes?: (parent: TreeNodeItem) => TreeNodeItem[]) => {
    dataProviderMock.reset();
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isAny())).returns((n: TreeNodeItem) => n.extendedData.key);
    if (!rootNodes)
      rootNodes = () => [];
    if (!childNodes)
      childNodes = () => [];
    dataProviderMock.setup((x) => x.getRootNodes(moq.It.isAny())).returns(async () => rootNodes!());
    dataProviderMock.setup((x) => x.getRootNodesCount()).returns(async () => rootNodes!().length);
    dataProviderMock.setup((x) => x.getChildNodes(moq.It.isAny(), moq.It.isAny())).returns(async (p) => childNodes!(p));
    dataProviderMock.setup((x) => x.getChildNodesCount(moq.It.isAny())).returns(async (p) => childNodes!(p).length);
  };

  const createRandomTreeNodeItem = (hasChildren: boolean = false, parentId?: string): TreeNodeItem => {
    return {
      id: faker.random.uuid(),
      parentId,
      label: faker.random.word(),
      description: faker.random.words(),
      hasChildren,
      extendedData: {
        key: createRandomECInstanceNodeKey(),
      },
    };
  };

  it("mounts", () => {
    mount(<Tree
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);
  });

  it("creates default implementation for selection handler and data provider when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    ECPresentation.selection = selectionManagerMock.object;

    const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
    presentationManagerMock.setup((x) => x.getRootNodes(imodelMock.object, moq.It.isAny(), moq.It.isAny())).returns(async () => []);
    ECPresentation.presentation = presentationManagerMock.object;

    const rulesetId = faker.random.word();

    const tree = mount(<Tree
      imodel={imodelMock.object}
      rulesetId={rulesetId} />).instance() as Tree;

    expect(tree.selectionHandler.name).to.not.be.undefined;
    expect(tree.selectionHandler.rulesetId).to.eq(rulesetId);
    expect(tree.selectionHandler.imodel).to.eq(imodelMock.object);

    expect(tree.dataProvider.rulesetId).to.eq(rulesetId);
    expect(tree.dataProvider.connection).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    expect(shallow(<Tree
      id={faker.random.uuid()}
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />)).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const tree = mount(<Tree
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);
    tree.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler and data provider when props change", () => {
    const tree = mount<TreeProps>(<Tree
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();

    tree.setProps({
      imodel: imodelMock2.object,
      rulesetId: rulesetId2,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());

    dataProviderMock.verify((x) => x.connection = imodelMock2.object, moq.Times.once());
    dataProviderMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  describe("selection handling", () => {

    describe("checking if node should be selected", () => {

      it("calls props callback and returns its result", () => {
        const node = createRandomTreeNodeItem();
        const result = faker.random.boolean();
        const spy = moq.Mock.ofType<(node: TreeNodeItem) => boolean>();
        spy.setup((x) => x(node)).returns(() => result).verifiable();

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, isNodeSelected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        const propCallback = tree.find(BaseTree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const actualResult = propCallback(node);

        spy.verifyAll();
        expect(actualResult).to.eq(result);
      });

      it("returns true when node key is in selection", () => {
        const nodeKey = createRandomECInstanceNodeKey();
        const node = createRandomTreeNodeItem();
        node.extendedData.key = nodeKey;
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([nodeKey]));

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        const propCallback = tree.find(BaseTree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.true;
      });

      it("returns true when ECInstance key of ECInstance node is in selection", () => {
        const nodeKey = createRandomECInstanceNodeKey();
        const node = createRandomTreeNodeItem();
        node.extendedData.key = nodeKey;
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([nodeKey.instanceKey]));

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        const propCallback = tree.find(BaseTree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.true;
      });

      it("returns false when node key is not in selection and node is not ECInstance node", () => {
        const nodeKey: BaseNodeKey = {
          type: faker.random.word(),
          pathFromRoot: [],
        };
        const node = createRandomTreeNodeItem();
        node.extendedData.key = nodeKey;
        selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet());

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        const propCallback = tree.find(BaseTree).prop("selectedNodes") as ((node: TreeNodeItem) => boolean);
        const result = propCallback(node);
        expect(result).to.be.false;
      });

    });

    describe("selecting nodes", () => {

      it("calls props callback and adds node keys to selection manager when callback returns true", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const spy = moq.Mock.ofType<(nodes: TreeNodeItem[], replace: boolean) => boolean>();
        spy.setup((x) => x(nodes, false)).returns(() => true).verifiable();

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onNodesSelected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        tree.find(BaseTree).prop("onNodesSelected")!(nodes, false);

        selectionHandlerMock.verify((x) => x.addToSelection(nodes.map((n) => n.extendedData.key)), moq.Times.once());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const spy = moq.Mock.ofType<(nodes: TreeNodeItem[], replace: boolean) => boolean>();
        spy.setup((x) => x(nodes, true)).returns(() => false).verifiable();

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onNodesSelected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        tree.find(BaseTree).prop("onNodesSelected")!(nodes, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("replaces ECInstance keys in selection manager when selection target is set to `ECInstance`", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        nodes[0].extendedData.key = createRandomECInstanceNodeKey();
        nodes[1].extendedData.key = { type: faker.random.word(), pathFromRoot: [] };

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, selectionTarget: SelectionTarget.Instance }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        tree.find(BaseTree).prop("onNodesSelected")!(nodes, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection([
          (nodes[0].extendedData.key as ECInstanceNodeKey).instanceKey,
          nodes[1].extendedData.key,
        ]), moq.Times.once());
      });

    });

    describe("deselecting nodes", () => {

      it("calls props callback and removes node keys from selection manager when callback returns true", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const spy = moq.Mock.ofType<(nodes: TreeNodeItem[]) => boolean>();
        spy.setup((x) => x(nodes)).returns(() => true).verifiable();

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onNodesDeselected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        tree.find(BaseTree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection(nodes.map((n) => n.extendedData.key)), moq.Times.once());
        spy.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        const spy = moq.Mock.ofType<(nodes: TreeNodeItem[]) => boolean>();
        spy.setup((x) => x(nodes)).returns(() => false).verifiable();

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onNodesDeselected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        tree.find(BaseTree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("removes ECInstance keys from selection manager when selection target is set to `ECInstance`", () => {
        const nodes = [createRandomTreeNodeItem(), createRandomTreeNodeItem()];
        nodes[0].extendedData.key = createRandomECInstanceNodeKey();
        nodes[1].extendedData.key = { type: faker.random.word(), pathFromRoot: [] };

        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, selectionTarget: SelectionTarget.Instance }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        tree.find(BaseTree).prop("onNodesDeselected")!(nodes);

        selectionHandlerMock.verify((x) => x.removeFromSelection([
          (nodes[0].extendedData.key as ECInstanceNodeKey).instanceKey,
          nodes[1].extendedData.key,
        ]), moq.Times.once());
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
        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        const spy = spies.spy.on(tree.instance(), Tree.prototype.render.name);
        triggerSelectionChange(0);
        expect(spy).to.be.called();
      });

      it("re-renders tree on selection changes when selection level is not 0", () => {
        const tree = shallow(<Tree
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        const spy = spies.spy.on(tree.instance(), Tree.prototype.render.name);
        triggerSelectionChange(1);
        expect(spy).to.not.be.called();
      });

    });

  });

});
