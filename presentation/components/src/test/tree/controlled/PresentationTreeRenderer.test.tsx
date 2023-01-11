/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord, StandardTypeNames } from "@itwin/appui-abstract";
import { ITreeNodeLoader, TreeActions, TreeModel, TreeModelSource, UiComponents, VisibleTreeNodes } from "@itwin/components-react";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { PropertyValueFormat } from "@itwin/presentation-common";
import { createTestContentDescriptor, createTestPropertiesContentField, createTestPropertyInfo } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { PresentationTreeRenderer, PresentationTreeRendererProps } from "../../../presentation-components/tree/controlled/PresentationTreeRenderer";
import { mockPresentationManager } from "../../_helpers/UiComponents";
import { stubRaf } from "../../instance-filter-builder/Common";
import { createTreeModelNode } from "./Helpers";

describe("PresentationTreeRenderer", () => {
  stubRaf();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const treeProps: PresentationTreeRendererProps = {
    imodel: imodelMock.object,
    treeActions: treeActionsMock.object,
    modelSource: modelSourceMock.object,
    nodeLoader: nodeLoaderMock.object,
    height: 100,
    width: 100,
    nodeHeight: () => 20,
    visibleNodes: visibleNodesMock.object,
  };

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
    visibleNodesMock.reset();
    nodeLoaderMock.reset();
    modelSourceMock.reset();
    sinon.restore();
  });

  it("renders default tree node", async () => {
    const testLabel = "testLabel";
    const node = createTreeModelNode(undefined, { id: "node_id", label: PropertyRecord.fromString(testLabel) });
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText, container } = render(
      <PresentationTreeRenderer
        {...treeProps}
      />);

    await waitFor(() => getByText(testLabel));
    expect(container.querySelector(".presentation-components-node")).to.be.null;
  });

  it("renders filter builder dialog when node filter button is clicked", async () => {
    const label = "Node Label";
    const node = createTreeModelNode({ label: PropertyRecord.fromString(label) });
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText, container } = render(
      <PresentationTreeRenderer
        {...treeProps}
      />);

    await waitFor(() => getByText(label));
    expect(container.querySelector(".presentation-components-node")).to.not.be.null;

    const filterButton = container.querySelector(".presentation-components-node-action-buttons button");
    expect(filterButton).to.not.be.null;
    fireEvent.click(filterButton!);

    // wait for dialog to be visible
    await waitFor(() => {
      expect(container.querySelector(".presentation-instance-filter-dialog")).to.not.be.null;
    });

    const closeButton = container.querySelector(".presentation-instance-filter-dialog-close-button");
    expect(closeButton).to.not.be.null;
    fireEvent.click(closeButton!);

    const dialog = container.querySelector(".presentation-instance-filter-dialog");
    expect(dialog).to.be.null;
  });

  it("renders filter builder dialog when node filter button is clicked", async () => {
    const label = "Node Label";
    const node = createTreeModelNode({ label: PropertyRecord.fromString(label) });
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText, container } = render(
      <PresentationTreeRenderer
        {...treeProps}
      />);

    await waitFor(() => getByText(label));
    expect(container.querySelector(".presentation-components-node")).to.not.be.null;

    const filterButton = container.querySelector(".presentation-components-node-action-buttons button");
    expect(filterButton).to.not.be.null;
    fireEvent.click(filterButton!);

    // wait for dialog to be visible
    await waitFor(() => {
      expect(container.querySelector(".presentation-instance-filter-dialog")).to.not.be.null;
    });

    const closeButton = container.querySelector(".presentation-instance-filter-dialog-close-button");
    expect(closeButton).to.not.be.null;
    fireEvent.click(closeButton!);

    const dialog = container.querySelector(".presentation-instance-filter-dialog");
    expect(dialog).to.be.null;
  });

  it("applies filter and closes dialog", async () => {
    const label = "Node Label";
    const node = createTreeModelNode({ label: PropertyRecord.fromString(label) });
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const treeModelMock = moq.Mock.ofType<TreeModel>();
    treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);
    modelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);

    const { propertyField } = mockNodeDescriptor();
    modelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).verifiable(moq.Times.once());

    const { getByText, container } = render(
      <PresentationTreeRenderer
        {...treeProps}
      />);

    await waitFor(() => getByText(label));

    const filterButton = container.querySelector(".presentation-components-node-action-buttons button");
    expect(filterButton).to.not.be.null;
    fireEvent.click(filterButton!);

    // wait for dialog to be visible
    await waitFor(() => {
      expect(container.querySelector(".presentation-instance-filter-dialog")).to.not.be.null;
    });

    // select property in filter builder dialog
    const propertySelector = container.querySelector<HTMLInputElement>(".rule-property .iui-input");
    expect(propertySelector).to.not.be.null;
    propertySelector?.focus();
    fireEvent.click(getByText(propertyField.label));

    // wait until apply button is enabled
    const applyButton = await waitFor(() => {
      const button = container.querySelector<HTMLInputElement>(".presentation-instance-filter-dialog-apply-button");
      expect(button?.disabled).to.be.false;
      return button;
    });
    fireEvent.click(applyButton!);

    // wait until dialog closes
    await waitFor(() => {
      expect(container.querySelector(".presentation-instance-filter-dialog")).to.be.null;
    });

    modelSourceMock.verifyAll();
  });
});

function mockNodeDescriptor() {
  const { presentationManager } = mockPresentationManager();
  Presentation.setPresentationManager(presentationManager.object);

  const property = createTestPropertyInfo({ name: "TestProperty", type: StandardTypeNames.Bool });
  const propertyField = createTestPropertiesContentField({
    properties: [{ property }],
    name: property.name,
    label: property.name,
    type: { typeName: StandardTypeNames.Bool, valueFormat: PropertyValueFormat.Primitive },
  });
  presentationManager
    .setup(async (x) => x.getContentDescriptor(moq.It.isAny()))
    .returns(async () => createTestContentDescriptor({ fields: [propertyField] }));
  return { property, propertyField };
}
