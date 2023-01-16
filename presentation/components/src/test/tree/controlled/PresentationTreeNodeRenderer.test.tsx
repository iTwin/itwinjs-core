/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyFilterRuleOperator, TreeActions, UiComponents } from "@itwin/components-react";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { createTestContentDescriptor, createTestPropertiesContentField, createTestPropertyInfo } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { PresentationInstanceFilterInfo } from "../../../presentation-components/instance-filter-builder/PresentationInstanceFilterBuilder";
import { PresentationTreeNodeRenderer } from "../../../presentation-components/tree/controlled/PresentationTreeNodeRenderer";
import { createTreeModelNode, createTreeNodeItem } from "./Helpers";

function createFilterInfo(propName: string = "prop"): PresentationInstanceFilterInfo {
  const property = createTestPropertyInfo({ name: propName });
  const field = createTestPropertiesContentField({ properties: [{ property }] });
  return {
    filter: {
      field,
      operator: PropertyFilterRuleOperator.IsNull,
    },
    usedClasses: [],
  };
}

describe("PresentationTreeNodeRenderer", () => {
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

  it("renders default tree node", async () => {
    const testLabel = "testLabel";
    const node = createTreeModelNode(undefined, { id: "node_id", label: PropertyRecord.fromString(testLabel) });

    const { getByText, container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={() => { }}
        onClearFilterClick={() => { }}
      />);

    await waitFor(() => getByText(testLabel));
    expect(container.querySelector(".presentation-components-node")).to.be.null;
  });

  it("renders presentation tree node", async () => {
    const testLabel = "testLabel";
    const item = createTreeNodeItem({ label: PropertyRecord.fromString(testLabel) });
    const node = createTreeModelNode(undefined, item);

    const { getByText, container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={() => { }}
        onClearFilterClick={() => { }}
      />);

    await waitFor(() => getByText(testLabel));
    expect(container.querySelector(".presentation-components-node")).to.not.be.null;
  });

  it("renders node with filter button", () => {
    const nodeItem = createTreeNodeItem({ filtering: { descriptor: createTestContentDescriptor({ fields: [] }) } });
    const node = createTreeModelNode(undefined, nodeItem);

    const { container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={() => { }}
        onClearFilterClick={() => { }}
      />);

    const buttons = container.querySelectorAll(".presentation-components-node-action-buttons button");
    expect(buttons.length).to.eq(1);
  });

  it("renders filtered node with filter and clear filter buttons", () => {
    const nodeItem = createTreeNodeItem({
      filtering: {
        descriptor: createTestContentDescriptor({ fields: [] }),
        active: createFilterInfo(),
      },
    });
    const node = createTreeModelNode(undefined, nodeItem);

    const { container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={() => { }}
        onClearFilterClick={() => { }}
      />);

    const buttons = container.querySelectorAll(".presentation-components-node-action-buttons button");
    expect(buttons.length).to.eq(2);
  });

  it("renders without buttons when node is not filterable", () => {
    const nodeItem = createTreeNodeItem();
    const node = createTreeModelNode(undefined, nodeItem);

    const { container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={() => { }}
        onClearFilterClick={() => { }}
      />);

    const buttons = container.querySelectorAll(".presentation-components-node-action-buttons button");
    expect(buttons).to.be.empty;
  });

  it("invokes 'onFilterClick' when filter button is clicked", () => {
    const spy = sinon.spy();
    const nodeItem = createTreeNodeItem({ filtering: { descriptor: createTestContentDescriptor({ fields: [] }) } });
    const node = createTreeModelNode(undefined, nodeItem);

    const { container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={spy}
        onClearFilterClick={() => { }}
      />);

    const buttons = container.querySelectorAll(".presentation-components-node-action-buttons button");
    expect(buttons.length).to.eq(1);
    fireEvent.click(buttons[0]);
    expect(spy).be.calledOnce;
  });

  it("invokes 'onClearFilterClick' when clear button is clicked", () => {
    const spy = sinon.spy();
    const nodeItem = createTreeNodeItem({
      filtering: {
        descriptor: createTestContentDescriptor({ fields: [] }),
        active: createFilterInfo(),
      },
    });
    const node = createTreeModelNode(undefined, nodeItem);

    const { container } = render(
      <PresentationTreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        onFilterClick={() => { }}
        onClearFilterClick={spy}
      />);

    const buttons = container.querySelectorAll(".presentation-components-node-action-buttons button");
    expect(buttons.length).to.eq(2);
    fireEvent.click(buttons[0]);
    expect(spy).be.calledOnce;
  });
});
