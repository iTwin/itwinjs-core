/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyRecord } from "@itwin/appui-abstract/lib/cjs/appui-abstract/properties/Record";
import { TreeRendererProps } from "@itwin/components-react/lib/cjs/components-react/tree/controlled/component/TreeRenderer";
import { TreeActions } from "@itwin/components-react/lib/cjs/components-react/tree/controlled/TreeActions";
import { TreeModelNode, VisibleTreeNodes } from "@itwin/components-react/lib/cjs/components-react/tree/controlled/TreeModel";
import { ITreeNodeLoader } from "@itwin/components-react/lib/cjs/components-react/tree/controlled/TreeNodeLoader";
import { render } from "@testing-library/react";
import React from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { PresentationTreeNodeRenderer, PresentationTreeRenderer } from "../../../presentation-components/tree/controlled/PresentationTreeNodeRenderer";
import { translate } from "../../../presentation-components/common/Utils";
import { UiComponents } from "@itwin/components-react/lib/cjs/components-react/UiComponents";
import { ITwinLocalization } from "@itwin/core-i18n/lib/cjs/ITwinLocalization";
import { Presentation } from "@itwin/presentation-frontend";
import { EmptyLocalization } from "@itwin/core-common/lib/cjs/Localization";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { TreeNodeItem } from "@itwin/components-react/lib/cjs/components-react/tree/TreeDataProvider";

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

    getByText(translate("tree.presentation-custom-node-label"));
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

    const renderedNode = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
      />);

    renderedNode.getByText(testLabel);
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

    const renderedNode = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
      />);

    renderedNode.getByText(translate("tree.presentation-custom-node-label"));
  });
});
