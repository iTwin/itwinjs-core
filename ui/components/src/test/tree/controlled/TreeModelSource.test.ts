/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import sinon from "sinon";
import * as faker from "faker";
import { BeEvent, BeUiEvent } from "@bentley/bentleyjs-core";
import { TreeModelSource, createModelSourceForNodeLoader, createDefaultNodeLoadHandler } from "../../../ui-components/tree/controlled/TreeModelSource";
import { ITreeDataProvider, TreeDataChangesListener } from "../../../ui-components/tree/TreeDataProvider";
import { TreeModelNodeInput, MutableTreeModel, VisibleTreeNodes, TreeNodeItemData } from "../../../ui-components/tree/controlled/TreeModel";
import { ITreeNodeLoader, LoadedNodeHierarchy } from "../../../ui-components/tree/controlled/TreeNodeLoader";
import { createRandomTreeNodeItems, createRandomTreeNodeItem } from "./RandomTreeNodesHelpers";

describe("TreeModelSource", () => {

  let modelSource: TreeModelSource;
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  const mutableTreeModelMock = moq.Mock.ofType<MutableTreeModel>();
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();

  let onTreeNodeChanged: BeEvent<TreeDataChangesListener>;

  beforeEach(() => {
    dataProviderMock.reset();
    mutableTreeModelMock.reset();

    onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();
    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChanged);
    modelSource = new TreeModelSource();
  });

  describe("constructor", () => {

    it("listens for onModelChanged events", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.exactly(2));
      modelSource.getVisibleNodes();
      modelSource.onModelChanged.emit(mutableTreeModelMock.object);
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

  });

  describe("modifyModel", () => {

    it("does not emit onModelChanged event if model did not change", () => {
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel(() => { });
      expect(spy).to.not.be.called;
    });

    it("emits onModelChanged event if model has changed", () => {
      const input: TreeModelNodeInput = {
        id: faker.random.uuid(),
        isExpanded: faker.random.boolean(),
        item: { id: faker.random.uuid(), label: faker.random.word() },
        label: faker.random.word(),
        isLoading: faker.random.boolean(),
        isSelected: faker.random.boolean(),
      };
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel((model) => { model.setChildren(undefined, [input], 0); });
      expect(spy).to.be.called;
    });

  });

  describe("getModel", () => {

    it("returns model", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      const model = modelSource.getModel();
      expect(model).to.be.eq(mutableTreeModelMock.object);
    });

  });

  describe("getVisibleNodes", () => {

    beforeEach(() => {
      (modelSource as any)._model = mutableTreeModelMock.object;
    });

    it("computes visible nodes", () => {
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.once());
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

    it("does not compute visible nodes second time", () => {
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.once());
      modelSource.getVisibleNodes();
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

  });

});

describe("createModelSourceForNodeLoader", () => {
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  let onNodeLoadedEvent: BeUiEvent<LoadedNodeHierarchy>;

  beforeEach(() => {
    nodeLoaderMock.reset();
    onNodeLoadedEvent = new BeUiEvent<LoadedNodeHierarchy>();
    nodeLoaderMock.setup((x) => x.onNodeLoaded).returns(() => onNodeLoadedEvent);
  });

  it("creates model source and adds listener to onNodeLoader event", () => {
    const spy = sinon.spy(onNodeLoadedEvent, "addListener");
    const { modelSource } = createModelSourceForNodeLoader(nodeLoaderMock.object);
    expect(modelSource).to.not.be.undefined;
    expect(spy).to.be.calledOnce;
  });

  it("removes listener from onNodeLoaded event", () => {
    const { disposeModelSource } = createModelSourceForNodeLoader(nodeLoaderMock.object);
    const spy = sinon.spy(onNodeLoadedEvent, "removeListener");
    disposeModelSource();
    expect(spy).to.be.calledOnce;
  });

});

describe("createDefaultNodeLoadHandler", () => {
  function convertToTreeModelNodeInput(item: TreeNodeItemData): TreeModelNodeInput {
    let numChildren: number | undefined;
    if (item.children) {
      numChildren = item.children.length;
    } else if (!item.hasChildren) {
      numChildren = 0;
    }

    return {
      description: item.description,
      isExpanded: !!item.autoExpand,
      id: item.id,
      item,
      label: item.label,
      isLoading: false,
      numChildren,
      isSelected: false,
    };
  }

  let modelSource: TreeModelSource;

  beforeEach(() => {
    modelSource = new TreeModelSource();
  });

  it("handles onNodeLoaded event with root nodes", () => {
    const loadedHierarchy: LoadedNodeHierarchy = {
      parentId: undefined,
      offset: 0,
      numChildren: 4,
      hierarchyItems: createRandomTreeNodeItems(6).map((item) => ({ item })),
    };

    createDefaultNodeLoadHandler(modelSource)(loadedHierarchy);

    expect(modelSource.getModel().getChildren(undefined)!.getLength()).to.be.eq(6);
  });

  it("handles onNodeLoaded event with root node and child node", () => {
    const loadedHierarchy: LoadedNodeHierarchy = {
      parentId: undefined,
      offset: 0,
      numChildren: 1,
      hierarchyItems: [
        {
          item: createRandomTreeNodeItem(),
          numChildren: 1,
          children: [
            {
              item: createRandomTreeNodeItem(),
            },
          ],
        },
      ],
    };
    createDefaultNodeLoadHandler(modelSource)(loadedHierarchy);

    expect(modelSource.getModel().getChildren(undefined)!.getLength()).to.be.eq(1);
    expect(modelSource.getModel().getChildren(loadedHierarchy.hierarchyItems[0].item.id)!.getLength()).to.be.eq(1);
  });

  it("handles onNodeLoaded event with child for existing parent node", () => {
    const parentNode = createRandomTreeNodeItem();
    modelSource.modifyModel((model) => {
      model.setNumChildren(undefined, 1);
      model.setChildren(undefined, [convertToTreeModelNodeInput(parentNode)], 0);
      const node = model.getNode(parentNode.id);
      node!.isLoading = true;
    });

    const loadedHierarchy: LoadedNodeHierarchy = {
      parentId: parentNode.id,
      offset: 0,
      numChildren: 1,
      hierarchyItems: [
        {
          item: createRandomTreeNodeItems(1, parentNode.id)[0],
        },
      ],
    };
    createDefaultNodeLoadHandler(modelSource)(loadedHierarchy);

    expect(modelSource.getModel().getChildren(parentNode.id)!.getLength()).to.be.eq(1);
    expect(modelSource.getModel().getNode(parentNode.id)!.isLoading).to.be.false;
  });

});
