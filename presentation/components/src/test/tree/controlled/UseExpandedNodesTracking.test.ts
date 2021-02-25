/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { cleanup, renderHook } from "@testing-library/react-hooks";
import { useExpandedNodesTracking, UseExpandedNodesTrackingProps } from "../../../presentation-components/tree/controlled/UseExpandedNodesTracking";
import { TreeModelNodeInput, TreeModelSource, TreeNodeItem } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { NodeKey } from "@bentley/presentation-common";
import { mockPresentationManager } from "../../_helpers/UiComponents";
import { Presentation, StateTracker } from "@bentley/presentation-frontend";
import { createRandomECInstancesNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { createLabelRecord } from "../../../presentation-components/common/Utils";
import { IModelConnection } from "@bentley/imodeljs-frontend";

interface TestTreeNodeItem extends TreeNodeItem {
  key: NodeKey;
}

function createNodeItem(nodeId: string): TestTreeNodeItem {
  return { id: nodeId, label: createLabelRecord({ displayValue: nodeId, typeName: "string", rawValue: nodeId }, nodeId), key: createRandomECInstancesNodeKey() };
}

function createTreeModelInput(node: TestTreeNodeItem, isExpanded?: boolean): TreeModelNodeInput {
  return {
    id: node.id,
    isExpanded: isExpanded ?? false,
    isLoading: false,
    isSelected: false,
    label: node.label,
    item: node,
  };
}

describe("UseExpandedNodesTracking", () => {
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const stateTrackerMock = moq.Mock.ofType<StateTracker>();
  const rulesetId = "ruleset-id";
  let modelSource: TreeModelSource;
  let initialProps: UseExpandedNodesTrackingProps;

  beforeEach(() => {
    stateTrackerMock.reset();
    dataProviderMock.reset();
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isAny())).returns((node) => (node as TestTreeNodeItem).key);
    dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
    dataProviderMock.setup((x) => x.rulesetId).returns(() => rulesetId);

    modelSource = new TreeModelSource();
    initialProps = {
      modelSource,
      dataProvider: dataProviderMock.object,
      enableAutoUpdate: true,
    };

    const presentationMocks = mockPresentationManager();
    presentationMocks.presentationManager.setup((x) => x.stateTracker).returns(() => stateTrackerMock.object);
    Presentation.setPresentationManager(presentationMocks.presentationManager.object);
  });

  afterEach(async () => {
    await cleanup();
    Presentation.terminate();
  });

  it("does not add 'onModelChange' event listener if auto update is disabled", () => {
    const addListenerSpy = sinon.spy(modelSource.onModelChanged, "addListener");
    renderHook(
      useExpandedNodesTracking,
      { initialProps: { ...initialProps, enableAutoUpdate: false } },
    );

    expect(addListenerSpy).to.be.not.called;
  });

  it("adds and removes 'onModelChange' event listener if auto update is enabled", () => {

    const addListenerSpy = sinon.spy(modelSource.onModelChanged, "addListener");
    const removeListenerSpy = sinon.spy(modelSource.onModelChanged, "removeListener");
    const { unmount } = renderHook(
      useExpandedNodesTracking,
      { initialProps },
    );

    expect(addListenerSpy).to.be.calledOnce;
    unmount();
    expect(removeListenerSpy).to.be.calledOnce;
  });

  it("calls 'onHierarchyClosed' when unmounted", () => {
    const { unmount } = renderHook(
      useExpandedNodesTracking,
      { initialProps },
    );

    stateTrackerMock.setup(async (x) => x.onHierarchyClosed(imodelMock.object, rulesetId, moq.It.isAnyString())).verifiable(moq.Times.once());
    unmount();
    stateTrackerMock.verifyAll();
  });

  it("calls 'onExpandedNodesChanged' with root node when expanded root node is added to model", () => {
    const node = createNodeItem("root-1");
    renderHook(
      useExpandedNodesTracking,
      { initialProps },
    );

    stateTrackerMock.setup(async (x) => x.onExpandedNodesChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [{ id: node.id, key: node.key }])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node, true)], 0);
    });
    stateTrackerMock.verifyAll();
  });

  it("call 'onExpandedNodesChanged' without nodes when non expanded root node is added to model", () => {
    const node = createNodeItem("root-1");
    renderHook(
      useExpandedNodesTracking,
      { initialProps },
    );

    stateTrackerMock.setup(async (x) => x.onExpandedNodesChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node, false)], 0);
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onExpandedNodesChanged' with existing node that was expanded", () => {
    const node = createNodeItem("root-1");
    modelSource.modifyModel((model) => { model.setChildren(undefined, [createTreeModelInput(node)], 0); });
    renderHook(
      useExpandedNodesTracking,
      { initialProps },
    );

    stateTrackerMock.setup(async (x) => x.onExpandedNodesChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [{ id: node.id, key: node.key }])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = true;
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onExpandedNodesChanged' with expanded children nodes and parent when parent is expanded", () => {
    const node = createNodeItem("root-1");
    const children = [createNodeItem("child-1"), createNodeItem("child-2")];
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node)], 0);
      model.setChildren(node.id, [createTreeModelInput(children[0], false), createTreeModelInput(children[1], true)], 0);
    });
    renderHook(
      useExpandedNodesTracking,
      { initialProps },
    );

    stateTrackerMock.setup(async (x) => x.onExpandedNodesChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [{ id: node.id, key: node.key }, { id: children[1].id, key: children[1].key }])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = true;
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onExpandedNodesChanged' without nodes when node is collapsed", () => {
    const node = createNodeItem("root-1");
    modelSource.modifyModel((model) => { model.setChildren(undefined, [createTreeModelInput(node, true)], 0); });
    renderHook(
      useExpandedNodesTracking,
      { initialProps }
    );

    stateTrackerMock.setup(async (x) => x.onExpandedNodesChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = false;
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onExpandedNodesChanged' without nodes when parent with expanded child nodes is collapsed", () => {
    const node = createNodeItem("root-1");
    const children = [createNodeItem("child-1"), createNodeItem("child-2")];
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node, true)], 0);
      model.setChildren(node.id, [createTreeModelInput(children[0], false), createTreeModelInput(children[1], true)], 0);
    });
    renderHook(
      useExpandedNodesTracking,
      { initialProps }
    );

    stateTrackerMock.setup(async (x) => x.onExpandedNodesChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = false;
    });
    stateTrackerMock.verifyAll();
  });
});
