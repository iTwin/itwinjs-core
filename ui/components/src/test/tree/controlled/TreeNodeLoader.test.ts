/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { Observable as RxjsObservable } from "rxjs/internal/Observable";
import { from as rxjsFrom } from "rxjs/internal/observable/from";
import sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "@bentley/ui-abstract";
import { Observable } from "../../../ui-components/tree/controlled/Observable";
import { MutableTreeModelNode, TreeModelNodeInput, TreeModelRootNode, TreeNodeItemData } from "../../../ui-components/tree/controlled/TreeModel";
import { TreeModelSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import {
  handleLoadedNodeHierarchy, LoadedNodeHierarchy, PagedTreeNodeLoader, TreeDataSource, TreeNodeLoader, TreeNodeLoadResult,
} from "../../../ui-components/tree/controlled/TreeNodeLoader";
import {
  ImmediatelyLoadedTreeNodeItem, ITreeDataProvider, TreeDataChangesListener, TreeDataProvider, TreeDataProviderRaw, TreeNodeItem,
} from "../../../ui-components/tree/TreeDataProvider";
import { extractSequence } from "../../common/ObservableTestHelpers";
import { ResolvablePromise } from "../../test-helpers/misc";
import { createRandomMutableTreeModelNode, createRandomTreeNodeItem, createRandomTreeNodeItems } from "./RandomTreeNodesHelpers";

/* eslint-disable @typescript-eslint/promise-function-async */

const mockDataProvider = (dataProviderMock: moq.IMock<ITreeDataProvider>, pageSize: number) => {
  const rootWithChildren = createRandomMutableTreeModelNode();
  rootWithChildren.item.autoExpand = false;

  const rootNodeItems: TreeNodeItemData[] = [rootWithChildren.item, ...createRandomTreeNodeItems(pageSize * 2 - 1, undefined, false)];
  const firstRootPage = rootNodeItems.slice(0, pageSize);
  const secondRootPage = rootNodeItems.slice(pageSize, pageSize);

  // disable children autoExpand to avoid mocking grandchildren load
  const childItems = createRandomTreeNodeItems(pageSize, rootWithChildren.id, false);
  childItems.forEach((item) => item.autoExpand = false);

  // mock tree hierarchy
  dataProviderMock.setup((x) => x.getNodesCount(undefined)).returns(async () => rootNodeItems.length);
  dataProviderMock.setup((x) => x.getNodesCount(rootWithChildren.item)).returns(async () => childItems.length);

  for (let i = 1; i < rootNodeItems.length; i++) {
    // disable autoExpand to avoid mocking children load
    rootNodeItems[i].autoExpand = false;
    const childCount = rootNodeItems[i].children ? rootNodeItems[i].children!.length : 0;
    dataProviderMock.setup((x) => x.getNodesCount(rootNodeItems[i])).returns(async () => childCount);
  }

  for (const item of childItems)
    dataProviderMock.setup((x) => x.getNodesCount(item)).returns(async () => 0);

  dataProviderMock.setup((x) => x.getNodes(undefined, undefined)).returns(async () => rootNodeItems);
  dataProviderMock.setup((x) => x.getNodes(undefined, { start: 0, size: pageSize })).returns(async () => firstRootPage);
  dataProviderMock.setup((x) => x.getNodes(undefined, { start: pageSize, size: pageSize })).returns(async () => secondRootPage);

  return {
    rootWithChildren,
    rootNodeItems,
    firstRootPage,
    secondRootPage,
    childItems,
  };
};

const extractLoadedNodeIds = async (obs: Observable<TreeNodeLoadResult>) => {
  const loadResult = await extractSequence(rxjsFrom(obs));
  if (loadResult.length === 0)
    return [];
  return loadResult[0]!.loadedNodes.map((item) => item.id);
};

const itemIds = (items: TreeNodeItem[]) => items.map((item) => item.id);

describe("TreeNodeLoader", () => {
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  let treeNodeLoader: TreeNodeLoader<TreeDataProvider>;

  beforeEach(() => {
    dataProviderMock.reset();
    modelSourceMock.reset();

    // eslint-disable-next-line deprecation/deprecation
    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => undefined);
    treeNodeLoader = new TreeNodeLoader(dataProviderMock.object, modelSourceMock.object);
  });

  describe("getDataProvider", () => {
    it("returns data provider", () => {
      expect(treeNodeLoader.dataProvider).to.be.eq(dataProviderMock.object);
    });
  });

  describe("modelSource", () => {
    it("returns model source", () => {
      expect(treeNodeLoader.modelSource).to.be.eq(modelSourceMock.object);
    });
  });

  describe("loadNode", () => {
    const treeRootNode: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };
    let rootNodes: TreeNodeItemData[];
    let rootWithChildren: MutableTreeModelNode;
    let childNodes: TreeNodeItemData[];

    beforeEach(() => {
      const mockedItems = mockDataProvider(dataProviderMock, 2);
      rootNodes = mockedItems.rootNodeItems;
      rootWithChildren = mockedItems.rootWithChildren;
      childNodes = mockedItems.childItems;
    });

    it("loads all root nodes", async () => {
      const loadResultObs = treeNodeLoader.loadNode(treeRootNode, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(rootNodes));
    });

    it("loads all children for node", async () => {
      rootWithChildren.isLoading = false;

      dataProviderMock.setup((x) => x.getNodesCount(rootWithChildren.item)).returns(async () => childNodes.length);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childNodes);

      const loadResultObs = treeNodeLoader.loadNode(rootWithChildren, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(childNodes));
    });

    it("makes only one request to load nodes", async () => {
      const loadResultObs = treeNodeLoader.loadNode(treeRootNode, 0);
      const loadResultObs2 = treeNodeLoader.loadNode(treeRootNode, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      const loadedIds2 = await extractLoadedNodeIds(loadResultObs2);
      expect(loadedIds).to.be.deep.eq(itemIds(rootNodes));
      expect(loadedIds2).to.be.empty;
    });

    describe("using raw data provider", () => {
      const nodesProvider: ImmediatelyLoadedTreeNodeItem[] = [
        {
          id: "1", label: PropertyRecord.fromString("1"), children: [
            { id: "1-1", label: PropertyRecord.fromString("1-1") },
            { id: "1-2", label: PropertyRecord.fromString("1-2") },
          ],
        },
        { id: "2", label: PropertyRecord.fromString("2"), children: [] },
      ];

      it("loads all immediately loaded nodes", async () => {
        treeNodeLoader = new TreeNodeLoader(nodesProvider, modelSourceMock.object);
        const loadObs = treeNodeLoader.loadNode(treeRootNode, 0);
        const loadedIds = await extractLoadedNodeIds(loadObs);
        expect(loadedIds).to.be.deep.eq(["1", "1-1", "1-2", "2"]);
      });
    });
  });
});

describe("PagedTreeNodeLoader", () => {
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();

  let pagedTreeNodeLoader: PagedTreeNodeLoader<TreeDataProvider>;

  const pageSize = 2;

  beforeEach(() => {
    dataProviderMock.reset();
    modelSourceMock.reset();

    // eslint-disable-next-line deprecation/deprecation
    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => undefined);

    pagedTreeNodeLoader = new PagedTreeNodeLoader(dataProviderMock.object, modelSourceMock.object, pageSize);
  });

  describe("[get] pageSize", () => {
    it("returns page size", () => {
      expect(pagedTreeNodeLoader.pageSize).to.be.eq(pageSize);
    });
  });

  describe("[get] dataProvider", () => {
    it("return data provider", () => {
      expect(pagedTreeNodeLoader.dataProvider).to.be.eq(dataProviderMock.object);
    });
  });

  describe("modelSource", () => {
    it("returns model source", () => {
      expect(pagedTreeNodeLoader.modelSource).to.be.eq(modelSourceMock.object);
    });
  });

  describe("loadNode", () => {
    const treeRootNode: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };

    let rootWithChildren: MutableTreeModelNode;

    let firstRootPage: TreeNodeItemData[];
    let secondRootPage: TreeNodeItemData[];

    let childItems: TreeNodeItemData[];

    beforeEach(() => {
      const mockedItems = mockDataProvider(dataProviderMock, pageSize);
      rootWithChildren = mockedItems.rootWithChildren;
      firstRootPage = mockedItems.firstRootPage;
      secondRootPage = mockedItems.secondRootPage;
      childItems = mockedItems.childItems;
    });

    it("loads root nodes page when asking for first node", async () => {
      const loadResultObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(firstRootPage));
    });

    it("loads child nodes page when asking for first child", async () => {
      rootWithChildren.isLoading = false;

      dataProviderMock.setup((x) => x.getNodesCount(rootWithChildren.item)).returns(async () => childItems.length);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const loadResultObs = pagedTreeNodeLoader.loadNode(rootWithChildren, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(childItems));
    });

    it("loads children of auto expanded node", async () => {
      rootWithChildren.item.autoExpand = true;

      dataProviderMock.setup((x) => x.getNodesCount(rootWithChildren.item)).returns(async () => childItems.length);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const loadResultObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      const expectedNodeIds = [rootWithChildren.id, ...itemIds(childItems), ...itemIds(firstRootPage.slice(1))];
      expect(loadedIds).to.be.deep.eq(expectedNodeIds);
    });

    it("does one request when loading 2 nodes from same page", async () => {
      const loadResultObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const loadResultObs2 = pagedTreeNodeLoader.loadNode(treeRootNode, 1);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      const loadedIds2 = await extractLoadedNodeIds(loadResultObs2);
      expect(loadedIds).to.be.deep.eq(itemIds(firstRootPage));
      expect(loadedIds2).to.be.empty;
    });

    it("loads two pages of root nodes", async () => {
      const pageOne = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const pageTwo = pagedTreeNodeLoader.loadNode(treeRootNode, pageSize);

      const pageOneLoadedIds = await extractLoadedNodeIds(pageOne);
      const pageTwoLoadedIds = await extractLoadedNodeIds(pageTwo);
      expect(pageOneLoadedIds).to.be.deep.eq(itemIds(firstRootPage));
      expect(pageTwoLoadedIds).to.be.deep.eq(itemIds(secondRootPage));
    });

    describe("using raw data provider", () => {
      const nodesProvider: ImmediatelyLoadedTreeNodeItem[] = [
        {
          id: "1", label: PropertyRecord.fromString("1"), children: [
            { id: "1-1", label: PropertyRecord.fromString("1-1") },
            { id: "1-2", label: PropertyRecord.fromString("1-2") },
          ],
        },
        { id: "2", label: PropertyRecord.fromString("2"), children: [] },
      ];

      it("loads all immediately loaded nodes", async () => {
        pagedTreeNodeLoader = new PagedTreeNodeLoader(nodesProvider, modelSourceMock.object, pageSize);
        const loadObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
        const loadedIds = await extractLoadedNodeIds(loadObs);
        expect(loadedIds).to.be.deep.eq(["1", "1-1", "1-2", "2"]);
      });

    });

  });

});

describe("TreeDataSource", () => {
  describe("constructor", () => {
    it("handles dataProvider onTreeNodeChanged event", () => {
      const onTreeNodeChangedEvent = new BeEvent<TreeDataChangesListener>();
      const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
      // eslint-disable-next-line deprecation/deprecation
      dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChangedEvent);

      const treeDataSource = new TreeDataSource(dataProviderMock.object);
      const spy = sinon.spy(treeDataSource.onItemsChanged, "raiseEvent");
      onTreeNodeChangedEvent.raiseEvent([]);
      expect(spy).to.be.called;
    });
  });

  describe("dispose", () => {
    it("stops listening from dataProvider onTreeNodeChanges event", () => {
      const onTreeNodeChangedEvent = new BeEvent<TreeDataChangesListener>();
      const spy = sinon.spy(onTreeNodeChangedEvent, "removeListener");
      const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
      // eslint-disable-next-line deprecation/deprecation
      dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChangedEvent);

      const treeDataSource = new TreeDataSource(dataProviderMock.object);
      treeDataSource.dispose();
      expect(spy).to.be.called;
    });
  });

  describe("requestItems", () => {
    describe("using TreeDataProviderRaw", () => {
      const rawProvider = [
        {
          id: faker.random.uuid(),
          label: PropertyRecord.fromString(faker.random.uuid(), "label"),
          children: [
            {
              id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word(), "label"), children: [
                { id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word(), "label") },
              ],
            },
          ],
        },
        {
          id: faker.random.uuid(),
          label: PropertyRecord.fromString(faker.random.uuid(), "label"),
          children: [{ id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word(), "label") }],
        },
      ];

      it("loads one node", async () => {
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(undefined, 0, 1, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider.slice(0, 1));
      });

      it("loads all nodes", async () => {
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(undefined, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider);
      });

      it("loads nodes for root node", async () => {
        const rootNode = rawProvider[1];
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(rootNode, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rootNode.children);
      });

      it("loads nodes for parent node in hierarchy", async () => {
        const parentNode: ImmediatelyLoadedTreeNodeItem = rawProvider[0].children[0];
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(parentNode, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(parentNode.children);
      });

      it("returns empty array if parent is not found", async () => {
        const nonExistingNode = { id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word()) };
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(nonExistingNode, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.empty;
      });
    });

    describe("using ITreeDataProvider interface", () => {
      it("avoids loading stale data from the data provider", async () => {
        const getNodesCountPromise = new ResolvablePromise();
        const dataProvider: ITreeDataProvider = {
          getNodesCount: sinon.fake(() => getNodesCountPromise),
          getNodes: sinon.fake(),
        };

        const subscription = new TreeDataSource(dataProvider).requestItems(undefined, 0, 1, true).subscribe();
        expect(dataProvider.getNodesCount).to.have.been.calledOnce;

        // Simulating unsubscribing from TreeDataSource in between getNodesCount call and getNodes call
        subscription.unsubscribe();
        await getNodesCountPromise.resolve(1);
        expect(dataProvider.getNodes).not.to.have.been.called;
      });
    });

    describe("using TreeDataProviderMethod", () => {
      const nodeItems = createRandomTreeNodeItems(2);
      const methodProvider = async () => nodeItems;

      it("loads one node", async () => {
        const dataSource = new TreeDataSource(methodProvider);

        const request = dataSource.requestItems(undefined, 0, 1, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(nodeItems.slice(0, 1));
      });

      it("loads all nodes", async () => {
        const dataSource = new TreeDataSource(methodProvider);

        const request = dataSource.requestItems(undefined, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(nodeItems);
      });
    });

    describe("using TreeDataProviderPromise", () => {
      const rawProvider = [
        {
          id: faker.random.uuid(),
          label: PropertyRecord.fromString(faker.random.uuid(), "label"),
          children: [
            {
              id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word(), "label"), children: [
                { id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word(), "label") },
              ],
            },
          ],
        },
        {
          id: faker.random.uuid(),
          label: PropertyRecord.fromString(faker.random.uuid(), "label"),
          children: [{ id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word(), "label") }],
        },
      ];
      const promiseProvider = new Promise<TreeDataProviderRaw>((resolve) => resolve(rawProvider));

      it("loads one node", async () => {
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(undefined, 0, 1, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider.slice(0, 1));
      });

      it("loads all nodes", async () => {
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(undefined, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider);
      });

      it("loads nodes for root node", async () => {
        const rootNode = rawProvider[1];
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(rootNode, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rootNode.children);
      });

      it("loads nodes for parent node in hierarchy", async () => {
        const parentNode: ImmediatelyLoadedTreeNodeItem = rawProvider[0].children[0];
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(parentNode, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(parentNode.children);
      });

      it("returns empty array if parent is not found", async () => {
        const nonExistingNode = { id: faker.random.uuid(), label: PropertyRecord.fromString(faker.random.word()) };
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(nonExistingNode, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.empty;
      });
    });

    describe("using Unknown tree data provider", () => {
      const waitForCompleteOrError = async <T extends {}>(observable: RxjsObservable<T>) => {
        return new Promise<void>((resolve, reject) => {
          observable.subscribe({
            error: (err) => reject(err),
            complete: () => resolve(),
          });
        });
      };

      it("throws error", async () => {
        const dataSource = new TreeDataSource({} as any);

        const request = dataSource.requestItems(undefined, 0, 5, false);
        await expect(waitForCompleteOrError(request)).to.eventually.be.rejected;
      });
    });
  });
});

describe("handleLoadedNodeHierarchy", () => {
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

  it("handles loaded hierarchy with root nodes", () => {
    const loadedHierarchy: LoadedNodeHierarchy = {
      parentId: undefined,
      offset: 0,
      numChildren: 4,
      hierarchyItems: createRandomTreeNodeItems(6).map((item) => ({ item })),
    };

    handleLoadedNodeHierarchy(modelSource, loadedHierarchy);

    expect(modelSource.getModel().getChildren(undefined)!.getLength()).to.be.eq(6);
  });

  it("handles loaded hierarchy with root node and child node", () => {
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
    handleLoadedNodeHierarchy(modelSource, loadedHierarchy);

    expect(modelSource.getModel().getChildren(undefined)!.getLength()).to.be.eq(1);
    expect(modelSource.getModel().getChildren(loadedHierarchy.hierarchyItems[0].item.id)!.getLength()).to.be.eq(1);
  });

  it("handles loaded hierarchy with child for existing parent node", () => {
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
    handleLoadedNodeHierarchy(modelSource, loadedHierarchy);

    expect(modelSource.getModel().getChildren(parentNode.id)!.getLength()).to.be.eq(1);
    expect(modelSource.getModel().getNode(parentNode.id)!.isLoading).to.be.false;
  });

  it("does not add children if parent was collapsed and children should be disposed", () => {
    const parentNode = createRandomTreeNodeItem();
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [convertToTreeModelNodeInput(parentNode)], 0);
    });

    const loadedHierarchy: LoadedNodeHierarchy = {
      parentId: parentNode.id,
      offset: 0,
      numChildren: undefined,
      hierarchyItems: [
        {
          item: createRandomTreeNodeItems(1, parentNode.id)[0],
        },
      ],
    };
    handleLoadedNodeHierarchy(modelSource, loadedHierarchy);

    expect(modelSource.getModel().getChildren(parentNode.id)).to.be.undefined;
  });

  it("updates existing expanded nodes in the same position", () => {
    const root1 = createRandomTreeNodeItem("root1", undefined, "root-node-1");
    const root2 = createRandomTreeNodeItem("root2", undefined, "root-node-2");
    const root3 = createRandomTreeNodeItem("root3", undefined, "root-node-3");
    const child1 = createRandomTreeNodeItem("child1", root2.id, "child-node-1");
    const child2 = createRandomTreeNodeItem("child2", root3.id, "child-node-2");
    const newNode = createRandomTreeNodeItem("new-root1", undefined, "new-root-node");
    modelSource.modifyModel((model) => {
      model.setChildren(
        undefined,
        [convertToTreeModelNodeInput(root1), { ...convertToTreeModelNodeInput(root2), isExpanded: true }, { ...convertToTreeModelNodeInput(root3), isExpanded: true, description: "description" }],
        0,
      );
      model.setChildren(root2.id, [convertToTreeModelNodeInput(child1)], 0);
      model.setChildren(root3.id, [convertToTreeModelNodeInput(child2)], 0);
    });

    const loadedHierarchy: LoadedNodeHierarchy = {
      parentId: undefined,
      offset: 0,
      numChildren: undefined,
      hierarchyItems: [
        {
          item: newNode,
        },
        {
          item: { ...root2, label: PropertyRecord.fromString("new-label"), hasChildren: true },
        },
        {
          item: { ...root3, description: undefined, hasChildren: true },
        },
      ],
    };
    handleLoadedNodeHierarchy(modelSource, loadedHierarchy);

    expect(modelSource.getModel().getNode(root1.id)).to.be.undefined;
    expect(modelSource.getModel().getNode(newNode.id)).to.be.not.undefined;
    expect(modelSource.getModel().getNode(root2.id)?.label).to.be.deep.equal(PropertyRecord.fromString("new-label"));
    expect(modelSource.getModel().getNode(child1.id)).to.be.not.undefined;
    expect(modelSource.getModel().getNode(root3.id)?.description).to.be.equal("");
    expect(modelSource.getModel().getNode(child2.id)).to.be.not.undefined;
  });
});
