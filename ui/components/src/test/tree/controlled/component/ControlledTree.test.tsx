/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import sinon from "sinon";
import { render } from "@testing-library/react";
import { ControlledTree } from "../../../../ui-components/tree/controlled/component/ControlledTree";
import { VisibleTreeNodes, TreeModel, MutableTreeModelNode } from "../../../../ui-components/tree/controlled/TreeModel";
import { TreeEvents } from "../../../../ui-components";
import { TreeNodeLoader } from "../../../../ui-components/tree/controlled/TreeModelSource";
import { from } from "../../../../ui-components/tree/controlled/Observable";
import { CheckBoxState } from "@bentley/ui-core";
import TestUtils from "../../../TestUtils";
import { SelectionMode } from "../../../../ui-components/common/selection/SelectionModes";

describe("ControlledTree", () => {

  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const nodeLoaderMock = moq.Mock.ofType<TreeNodeLoader>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const modelMock = moq.Mock.ofType<TreeModel>();
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
    nodeLoaderMock.setup((x) => x.loadNode(undefined, moq.It.isAny())).returns(() => from([{ loadedNodes: [], model: modelMock.object }]));
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
