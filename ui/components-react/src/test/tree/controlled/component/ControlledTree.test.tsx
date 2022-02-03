/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { VariableSizeList } from "react-window";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/core-react";
import { render } from "@testing-library/react";
import { SelectionMode } from "../../../../components-react/common/selection/SelectionModes";
import type { ControlledTreeProps } from "../../../../components-react/tree/controlled/component/ControlledTree";
import { ControlledTree } from "../../../../components-react/tree/controlled/component/ControlledTree";
import { from } from "../../../../components-react/tree/controlled/Observable";
import type { TreeEvents } from "../../../../components-react/tree/controlled/TreeEvents";
import type { MutableTreeModelNode, TreeModel } from "../../../../components-react/tree/controlled/TreeModel";
import type { ITreeNodeLoader } from "../../../../components-react/tree/controlled/TreeNodeLoader";
import type { HighlightableTreeProps} from "../../../../components-react/tree/HighlightingEngine";
import { HighlightingEngine } from "../../../../components-react/tree/HighlightingEngine";
import TestUtils from "../../../TestUtils";
import { SparseArray } from "../../../../components-react/tree/controlled/internal/SparseTree";

describe("ControlledTree", () => {
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  const defaultProps: ControlledTreeProps = {
    model: treeModelMock.object,
    nodeLoader: nodeLoaderMock.object,
    eventsHandler: treeEventsMock.object,
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
    treeModelMock.reset();
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

    nodeLoaderMock.setup((x) => x.loadNode(moq.It.isAny(), moq.It.isAny())).returns(() => from([]));
  });

  afterEach(() => {
    sinon.restore();
  });

  const mockVisibleNode = () => {
    treeModelMock.reset();

    const nodes = new SparseArray<string>();
    nodes.setLength(1);
    nodes.set(0, node.id);

    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ id: undefined, depth: -1, numChildren: 1 }));
    treeModelMock.setup((x) => x.getChildren(undefined)).returns(() => nodes);
    treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);
    treeModelMock.setup((x) => x.getChildOffset(undefined, node.id)).returns(() => 0);
    treeModelMock.setup((x) => x.iterateTreeModelNodes(undefined)).returns([node][Symbol.iterator]);
  };

  it("renders loading spinner if root nodes are not loaded", () => {
    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ id: undefined, depth: -1, numChildren: undefined }));

    const { container } = render(<ControlledTree {...defaultProps} />);

    const message = container.querySelector(".components-controlledTree-loader");
    expect(message).to.not.be.null;
  });

  it("renders no data message if there are no nodes", () => {
    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ id: undefined, depth: -1, numChildren: 0 }));

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
    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ id: undefined, depth: -1, numChildren: undefined }));

    const spinnerRenderer = () => <div />;
    const spy = sinon.spy(spinnerRenderer);

    render(<ControlledTree {...defaultProps} spinnerRenderer={spy} />);

    expect(spy).to.be.called;
  });

  it("uses provided no data renderer", () => {
    treeModelMock.setup((x) => x.getRootNode()).returns(() => ({ id: undefined, depth: -1, numChildren: 0 }));

    const noDataRenderer = () => <div />;
    const spy = sinon.spy(noDataRenderer);

    render(<ControlledTree {...defaultProps} noDataRenderer={spy} />);

    expect(spy).to.be.called;
  });
});
