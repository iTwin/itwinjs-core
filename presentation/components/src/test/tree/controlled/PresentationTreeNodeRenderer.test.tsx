/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import {
  ITreeNodeLoader, TreeActions, TreeModelNode, TreeNodeItem, TreeRendererProps, UiComponents, VisibleTreeNodes,
} from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { Presentation } from "@itwin/presentation-frontend";
import { render } from "@testing-library/react";
import { translate } from "../../../presentation-components/common/Utils";
import {
  PresentationTreeNodeRenderer, PresentationTreeRenderer,
} from "../../../presentation-components/tree/controlled/PresentationTreeNodeRenderer";

const createTreeModelNode = (NodeId?: string, label?: string, NodeItem?: TreeNodeItem): TreeModelNode => {
  const nodeId = NodeId ?? "0";
  const labelRecord = PropertyRecord.fromString(label ?? "label", "label");
  const itemRecord = PropertyRecord.fromString(label ?? "label", "itemLabel");
  return {
    id: nodeId,
    numChildren: 0,
    parentId: "parentId",
    checkbox: {
      isDisabled: false,
      isVisible: false,
      state: 0,
    },
    depth: 0,
    isExpanded: false,
    isSelected: false,
    description: "desc",
    label: labelRecord,
    item: NodeItem ?? {
      id: "0",
      label: itemRecord,
    },
  };
};

describe("PresentationTreeRenderer", () => {
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const defaultProps: TreeRendererProps = {
    nodeLoader: nodeLoaderMock.object,
    treeActions: treeActionsMock.object,
    visibleNodes: visibleNodesMock.object,
    nodeHeight: () => 50,
    width: 200,
    height: 200,
  };

  before(async () => {
    await UiComponents.initialize(new ITwinLocalization());
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await Presentation.initialize();
    HTMLElement.prototype.scrollIntoView = () => { };
  });

  after(async () =>{
    UiComponents.terminate();
    Presentation.terminate();
    await IModelApp.shutdown();
    delete (HTMLElement.prototype as any).scrollIntoView;
  });

  afterEach(() => {
    visibleNodesMock.reset();
    treeActionsMock.reset();
    nodeLoaderMock.reset();
    sinon.restore();
  });

  it("renders with default node", () => {
    const testLabel = "testLabel";
    const defaultNode = createTreeModelNode(undefined, testLabel);

    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => defaultNode);

    const { getByText } = render(<PresentationTreeRenderer {...defaultProps} />);

    getByText(testLabel);
  });

  it("renders with too many children custom node", () => {
    const testLabel = "testLabel";
    const item: TreeNodeItem = {
      id: "0",
      label: PropertyRecord.fromString("itemLabel", "itemLabel"),
      extendedData: {
        tooManyChildren: true,
      },
    };
    const customNode = createTreeModelNode(undefined, testLabel, item);

    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => customNode);

    const { getByText } = render(<PresentationTreeRenderer {...defaultProps} />);

    getByText(translate("tree.presentation-components-muted-node-label"));
  });
});

describe("TreeNodeRenderer", () => {
  const treeActionsMock = moq.Mock.ofType<TreeActions>();

  before(async () => {
    await UiComponents.initialize(new ITwinLocalization());
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await Presentation.initialize();
    HTMLElement.prototype.scrollIntoView = () => { };
  });

  after(async () =>{
    UiComponents.terminate();
    Presentation.terminate();
    await IModelApp.shutdown();
    delete (HTMLElement.prototype as any).scrollIntoView;
  });

  afterEach(() => {
    treeActionsMock.reset();
    sinon.restore();
  });

  it("renders default tree node", () => {
    const testLabel = "testLabel";
    const node = createTreeModelNode(undefined, testLabel);

    const { getByText } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
      />);

    getByText(testLabel);
  });

  it("renders too many children tree node", () => {
    const testLabel = "testLabel";
    const item: TreeNodeItem = {
      id: "0",
      label: PropertyRecord.fromString("itemLabel", "itemLabel"),
      extendedData: {
        tooManyChildren: true,
      },
    };
    const node = createTreeModelNode(undefined, testLabel, item);

    const { getByText } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
      />);

    getByText(translate("tree.presentation-components-muted-node-label"));
  });

  it("renders using provided node renderer", () => {
    const testLabel = "testLabel";
    const nodeRendererSpy = sinon.spy();
    const node = createTreeModelNode(undefined, testLabel);

    render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        nodeRenderer={nodeRendererSpy}
      />);

    expect(nodeRendererSpy).to.be.called;
  });
});
