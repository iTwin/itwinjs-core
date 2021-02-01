/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { VariableSizeList } from "react-window";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@bentley/ui-abstract";
import { CheckBoxState } from "@bentley/ui-core";
import { render } from "@testing-library/react";
import { SelectionMode } from "../../../../ui-components/common/selection/SelectionModes";
import { ControlledTree } from "../../../../ui-components/tree/controlled/component/ControlledTree";
import { from } from "../../../../ui-components/tree/controlled/Observable";
import { TreeEvents } from "../../../../ui-components/tree/controlled/TreeEvents";
import { MutableTreeModelNode, TreeModel, VisibleTreeNodes } from "../../../../ui-components/tree/controlled/TreeModel";
import { ITreeNodeLoader } from "../../../../ui-components/tree/controlled/TreeNodeLoader";
import { HighlightableTreeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import TestUtils from "../../../TestUtils";

describe("ControlledTree", () => {

  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  let node: MutableTreeModelNode;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);

    visibleNodesMock.reset();
    nodeLoaderMock.reset();

    node = {
      id: "0",
      label: PropertyRecord.fromString("label", "label"),
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
        label: PropertyRecord.fromString("label", "label"),
        description: "Test Node Description",
      },
    };

    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 0);
    visibleNodesMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ depth: -1, id: undefined, numChildren: undefined }));
    nodeLoaderMock.setup((x) => x.loadNode(moq.It.isAny(), moq.It.isAny())).returns(() => from([]));
  });

  afterEach(() => {
    sinon.restore();
  });

  const mockVisibleNode = () => {
    visibleNodesMock.reset();
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);
    visibleNodesMock.setup((x) => x[Symbol.iterator]()).returns([node][Symbol.iterator]);
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

    const message = container.querySelector(".components-controlledTree-loader");
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

    const message = container.querySelector(".components-controlledTree-errorMessage");
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

    const tree = container.querySelector(".components-controlledTree");
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
      searchText: "label",
      activeMatch: {
        nodeId: node.id,
        matchIndex: 0,
      },
    };

    const verticalScrollSpy = sinon.spy();
    sinon.replace(VariableSizeList.prototype, "scrollToItem", verticalScrollSpy);

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
