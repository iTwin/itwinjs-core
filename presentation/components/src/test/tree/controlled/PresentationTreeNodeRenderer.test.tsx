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
  TreeActions, TreeModelNode, UiComponents,
} from "@itwin/components-react";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { render } from "@testing-library/react";
import { translate } from "../../../presentation-components/common/Utils";
import {
  PresentationTreeNodeRenderer,
} from "../../../presentation-components/tree/controlled/PresentationTreeNodeRenderer";
import { PresentationTreeNodeItem } from "../../../presentation-components/tree/DataProvider";
import { createRandomECInstancesNodeKey } from "@itwin/presentation-common/lib/cjs/test";

function createTreeNodeItem(item?: Partial<PresentationTreeNodeItem>): PresentationTreeNodeItem {
  return {
    id: item?.id ?? "node_id",
    key: item?.key ?? createRandomECInstancesNodeKey(),
    label: item?.label ?? PropertyRecord.fromString("Node Label"),
    ...item,
  };
}

function createTreeModelNode(nodeId: string = "0", nodeItem?: PresentationTreeNodeItem): TreeModelNode {
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
    label: nodeItem?.label ?? PropertyRecord.fromString("TestLabel"),
    item: nodeItem ?? createTreeNodeItem(),
  };
}

describe("PresentationTreeNodeRenderer", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();

  before(async () => {
    await NoRenderApp.startup();
    await UiComponents.initialize(IModelApp.localization);
    await Presentation.initialize();
    HTMLElement.prototype.scrollIntoView = () => { };
  });

  after(async () => {
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
    const nodeItem = createTreeNodeItem({ label: PropertyRecord.fromString(testLabel) });
    const node = createTreeModelNode(undefined, nodeItem);

    const { getByText } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        nodeItem={nodeItem}
        imodel={imodelMock.object}
        onFilterApplied={() => { }}
        onFilterClear={() => { }}
      />);

    getByText(testLabel);
  });

  it("renders too many children tree node", () => {
    const item = createTreeNodeItem({
      tooManyChildren: true,
    });
    const node = createTreeModelNode(undefined, item);

    const { getByText } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        nodeItem={item}
        imodel={imodelMock.object}
        onFilterApplied={() => { }}
        onFilterClear={() => { }}
      />);

    getByText(translate("tree.too-many-child-nodes"));
  });

  it("renders node with filter button", () => {
    const nodeItem = createTreeNodeItem();
    const node = createTreeModelNode(undefined, nodeItem);

    const { container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        nodeItem={nodeItem}
        imodel={imodelMock.object}
        onFilterApplied={() => { }}
        onFilterClear={() => { }}
      />);

    const button = container.querySelector("presentation-components-filter-action-buttons");
    expect(button).to.not.be.undefined;
  });

  // it("invokes 'onFilter' callback when filter button is clicked", () => {
  //   const nodeItem = createTreeNodeItem();
  //   const node = createTreeModelNode(undefined, nodeItem);
  //   const buttonSpy = sinon.spy();

  //   const { container } = render(
  //     <PresentationTreeNodeRenderer
  //       treeActions={treeActionsMock.object}
  //       node={node}
  //       nodeItem={nodeItem}
  //       onFilterApplied={buttonSpy}
  //       onFilterClear={() => { }}
  //       imodel={imodelMock.object}
  //     />);

  //   const buttonContainer = container.getElementsByClassName("presentation-components-filter-action-buttons")[0];
  //   const button = buttonContainer.getElementsByClassName("iui-button")[0];
  //   fireEvent.click(button);
  //   expect(buttonSpy).to.be.called;
  // });
});
