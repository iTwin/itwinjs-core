/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { TreeModelNodeInput, TreeModelSource, TreeNodeItem } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation, StateTracker } from "@itwin/presentation-frontend";
import { cleanup, renderHook } from "@testing-library/react-hooks";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { createLabelRecord } from "../../../presentation-components/common/Utils";
import {
  useHierarchyStateTracking, UseHierarchyStateTrackingProps,
} from "../../../presentation-components/tree/controlled/UseHierarchyStateTracking";
import { mockPresentationManager } from "../../_helpers/UiComponents";

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

describe("useHierarchyStateTracking", () => {
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const stateTrackerMock = moq.Mock.ofType<StateTracker>();
  const rulesetId = "ruleset-id";
  let modelSource: TreeModelSource;
  let initialProps: UseHierarchyStateTrackingProps;

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
      enableTracking: true,
    };

    const presentationMocks = mockPresentationManager();
    presentationMocks.presentationManager.setup((x) => x.stateTracker).returns(() => stateTrackerMock.object);
    Presentation.setPresentationManager(presentationMocks.presentationManager.object);
  });

  afterEach(async () => {
    await cleanup();
    Presentation.terminate();
  });

  it("does not add 'onModelChange' event listener if nodes tracking is disabled", () => {
    const addListenerSpy = sinon.spy(modelSource.onModelChanged, "addListener");
    renderHook(
      useHierarchyStateTracking,
      { initialProps: { ...initialProps, enableTracking: false } },
    );

    expect(addListenerSpy).to.be.not.called;
  });

  it("adds and removes 'onModelChange' event listener if auto update is enabled", () => {
    const addListenerSpy = sinon.spy(modelSource.onModelChanged, "addListener");
    const removeListenerSpy = sinon.spy(modelSource.onModelChanged, "removeListener");
    const { unmount } = renderHook(
      useHierarchyStateTracking,
      { initialProps },
    );

    expect(addListenerSpy).to.be.calledOnce;
    unmount();
    expect(removeListenerSpy).to.be.calledOnce;
  });

  it("calls 'onHierarchyClosed' when unmounted", () => {
    const { unmount } = renderHook(
      useHierarchyStateTracking,
      { initialProps },
    );

    stateTrackerMock.setup(async (x) => x.onHierarchyClosed(imodelMock.object, rulesetId, moq.It.isAnyString())).verifiable(moq.Times.once());
    unmount();
    stateTrackerMock.verifyAll();
  });

  it("calls 'onHierarchyStateChanged' with root node when expanded root node is added to model", () => {
    const node = createNodeItem("root-1");
    renderHook(
      useHierarchyStateTracking,
      { initialProps },
    );
    stateTrackerMock.reset();
    stateTrackerMock.setup(async (x) => x.onHierarchyStateChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [{
      node: { id: node.id, key: node.key },
      state: { isExpanded: true },
    }])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node, true)], 0);
    });
    stateTrackerMock.verifyAll();
  });

  it("call 'onHierarchyStateChanged' without nodes when non expanded root node is added to model", () => {
    const node = createNodeItem("root-1");
    renderHook(
      useHierarchyStateTracking,
      { initialProps },
    );
    stateTrackerMock.reset();
    stateTrackerMock.setup(async (x) => x.onHierarchyStateChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node, false)], 0);
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onHierarchyStateChanged' with existing node that was expanded", () => {
    const node = createNodeItem("root-1");
    modelSource.modifyModel((model) => { model.setChildren(undefined, [createTreeModelInput(node)], 0); });
    renderHook(
      useHierarchyStateTracking,
      { initialProps },
    );
    stateTrackerMock.reset();
    stateTrackerMock.setup(async (x) => x.onHierarchyStateChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [{
      node: { id: node.id, key: node.key },
      state: { isExpanded: true },
    }])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = true;
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onHierarchyStateChanged' with expanded children nodes and parent when parent is expanded", () => {
    const node = createNodeItem("root-1");
    const children = [createNodeItem("child-1"), createNodeItem("child-2")];
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node)], 0);
      model.setChildren(node.id, [createTreeModelInput(children[0], false), createTreeModelInput(children[1], true)], 0);
    });
    renderHook(
      useHierarchyStateTracking,
      { initialProps },
    );
    stateTrackerMock.reset();
    stateTrackerMock.setup(async (x) => x.onHierarchyStateChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [{
      node: { id: node.id, key: node.key },
      state: { isExpanded: true },
    }, {
      node: { id: children[1].id, key: children[1].key },
      state: { isExpanded: true },
    }])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = true;
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onHierarchyStateChanged' without nodes when node is collapsed", () => {
    const node = createNodeItem("root-1");
    modelSource.modifyModel((model) => { model.setChildren(undefined, [createTreeModelInput(node, true)], 0); });
    renderHook(
      useHierarchyStateTracking,
      { initialProps }
    );
    stateTrackerMock.reset();
    stateTrackerMock.setup(async (x) => x.onHierarchyStateChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = false;
    });
    stateTrackerMock.verifyAll();
  });

  it("calls 'onHierarchyStateChanged' without nodes when parent with expanded child nodes is collapsed", () => {
    const node = createNodeItem("root-1");
    const children = [createNodeItem("child-1"), createNodeItem("child-2")];
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createTreeModelInput(node, true)], 0);
      model.setChildren(node.id, [createTreeModelInput(children[0], false), createTreeModelInput(children[1], true)], 0);
    });
    renderHook(
      useHierarchyStateTracking,
      { initialProps }
    );
    stateTrackerMock.reset();
    stateTrackerMock.setup(async (x) => x.onHierarchyStateChanged(imodelMock.object, rulesetId, moq.It.isAnyString(), [])).verifiable(moq.Times.once());
    modelSource.modifyModel((model) => {
      model.getNode(node.id)!.isExpanded = false;
    });
    stateTrackerMock.verifyAll();
  });
});
