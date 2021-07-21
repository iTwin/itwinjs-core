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
import { ControlledTree, ControlledTreeProps } from "../../../../ui-components/tree/controlled/component/ControlledTree";
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
  const defaultProps: ControlledTreeProps = {
    visibleNodes: visibleNodesMock.object,
    nodeLoader: nodeLoaderMock.object,
    treeEvents: treeEventsMock.object,
    selectionMode: SelectionMode.Single,
    width: 200,
    height: 200,
  };
  let node: MutableTreeModelNode;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
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

    const { container } = render(<ControlledTree {...defaultProps} />);

    const message = container.querySelector(".components-controlledTree-loader");
    expect(message).to.not.be.null;
  });

  it("renders no data message if there are no nodes", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => 0);

    const { container } = render(<ControlledTree {...defaultProps} />);

    const message = container.querySelector(".components-controlledTree-errorMessage");
    expect(message).to.not.be.null;
  });

  it("renders tree with loaded root nodes", () => {
    mockVisibleNode();

    const { container } = render(<ControlledTree {...defaultProps} />);

    const tree = container.querySelector(".components-controlledTree");
    expect(tree).to.not.be.null;
  });

  it("renders node with description", () => {
    mockVisibleNode();

    const { getByText } = render(<ControlledTree {...defaultProps} descriptionsEnabled={true} />);

    getByText("Test Node Description");
  });

  it("renders node with icon", () => {
    mockVisibleNode();
    node.item.icon = "test-icon";

    const { container } = render(<ControlledTree {...defaultProps} iconsEnabled={true} />);

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
        {...defaultProps}
        descriptionsEnabled={true}
        nodeHighlightingProps={highlightProps}
      />,
    );

    const tree = container.querySelector(`.${HighlightingEngine.ACTIVE_CLASS_NAME}`);
    expect(tree).to.not.be.null;
  });

  it("uses provided tree renderer", () => {
    mockVisibleNode();

    const treeRenderer = () => <div />;
    const spy = sinon.spy(treeRenderer);

    render(<ControlledTree {...defaultProps} treeRenderer={spy} />);

    expect(spy).to.be.called;
  });

  it("uses provided spinner renderer", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => undefined);
    const spinnerRenderer = () => <div />;
    const spy = sinon.spy(spinnerRenderer);

    render(<ControlledTree {...defaultProps} spinnerRenderer={spy} />);

    expect(spy).to.be.called;
  });

  it("uses provided no data renderer", () => {
    visibleNodesMock.setup((x) => x.getNumRootNodes()).returns(() => 0);
    const noDataRenderer = () => <div />;
    const spy = sinon.spy(noDataRenderer);

    render(<ControlledTree {...defaultProps} noDataRenderer={spy} />);

    expect(spy).to.be.called;
  });
});
