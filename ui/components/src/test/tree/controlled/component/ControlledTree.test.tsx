/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import sinon from "sinon";
import { render } from "@testing-library/react";
import { CheckBoxState } from "@bentley/ui-core";
import { ControlledTree } from "../../../../ui-components/tree/controlled/component/ControlledTree";
import { VisibleTreeNodes, MutableTreeModelNode, TreeModel } from "../../../../ui-components/tree/controlled/TreeModel";
import { ITreeNodeLoader } from "../../../../ui-components/tree/controlled/TreeNodeLoader";
import { from } from "../../../../ui-components/tree/controlled/Observable";
import TestUtils from "../../../TestUtils";
import { SelectionMode } from "../../../../ui-components/common/selection/SelectionModes";
import { HighlightableTreeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import { TreeEvents } from "../../../../ui-components/tree/controlled/TreeEvents";

describe("ControlledTree", () => {

  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  let node: MutableTreeModelNode;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    visibleNodesMock.reset();
    nodeLoaderMock.reset();

    node = {
      id: "0",
      label: "label",
      checkbox: { isVisible: false, state: CheckBoxState.Off, isDisabled: false },
      depth: 0,
      description: "Test Node Description",
      isExpanded: false,
      isLoading: false,
      numChildren: 0,
      isSelected: false,
      parentId: undefined,
      item: {
        id: "0",
        label: "label",
        description: "Test Node Description",
      },
    };

    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 0);
    visibleNodesMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ depth: -1, id: undefined, numChildren: undefined }));
    nodeLoaderMock.setup((x) => x.loadNode(moq.It.isAny(), moq.It.isAny())).returns(() => from([]));
  });

  const mockVisibleNode = () => {
    visibleNodesMock.reset();
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);
  };

  it("renders loading spinner if root nodes are not loaded", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => undefined);
    const { container } = render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        selectionMode={SelectionMode.Single}
      />);

    const message = container.querySelector(".components-tree-loader");
    expect(message).to.not.be.null;
  });

  it("renders no data message if there are no nodes", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => 0);
    const { container } = render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        selectionMode={SelectionMode.Single}
      />);

    const message = container.querySelector(".components-tree-errormessage");
    expect(message).to.not.be.null;
  });

  it("renders tree with loaded root nodes", () => {
    mockVisibleNode();

    const { container } = render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        selectionMode={SelectionMode.Single}
      />);

    const tree = container.querySelector(".components-tree");
    expect(tree).to.not.be.null;
  });

  it("renders node with description", () => {
    mockVisibleNode();

    const { getByText } = render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        descriptionsEnabled={true}
        selectionMode={SelectionMode.Single}
      />);

    getByText("Test Node Description");
  });

  it("renders node with icon", () => {
    mockVisibleNode();
    node.item.icon = "test-icon";

    const { container } = render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        iconsEnabled={true}
        selectionMode={SelectionMode.Single}
      />);

    const iconNode = container.querySelector(".test-icon");
    expect(iconNode).to.not.be.undefined;
  });

  it("renders highlighted node", () => {
    mockVisibleNode();
    const highlightProps: HighlightableTreeProps = {
      searchText: node.label,
      activeMatch: {
        nodeId: node.id,
        matchIndex: 0,
      },
    };

    const { container } = render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        descriptionsEnabled={true}
        selectionMode={SelectionMode.Single}
        nodeHighlightingProps={highlightProps}
      />);

    const tree = container.querySelector(`.${HighlightingEngine.ACTIVE_CLASS_NAME}`);
    expect(tree).to.not.be.null;
  });

  it("uses provided tree renderer", () => {
    mockVisibleNode();

    const treeRenderer = () => {
      return <div />;
    };
    const spy = sinon.spy(treeRenderer);

    render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        treeRenderer={spy}
        selectionMode={SelectionMode.Single}
      />);

    expect(spy).to.be.called;
  });

  it("uses provided spinner renderer", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => undefined);
    const spinnerRenderer = () => {
      return <div />;
    };
    const spy = sinon.spy(spinnerRenderer);

    render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        spinnerRenderer={spy}
        selectionMode={SelectionMode.Single}
      />);

    expect(spy).to.be.called;
  });

  it("uses provided no data renderer", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => 0);
    const noDataRenderer = () => {
      return <div />;
    };
    const spy = sinon.spy(noDataRenderer);

    render(
      <ControlledTree
        visibleNodes={visibleNodesMock.object}
        nodeLoader={nodeLoaderMock.object}
        treeEvents={treeEventsMock.object}
        noDataRenderer={spy}
        selectionMode={SelectionMode.Single}
      />);

    expect(spy).to.be.called;
  });

});
