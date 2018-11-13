/*---------------------------------------------------------------------------------------------
 | $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { waitForUpdate } from "../test-helpers/misc";
import { render, cleanup, fireEvent, RenderResult, waitForElement } from "react-testing-library";
import { Breadcrumb, BreadcrumbMode, BreadcrumbPath } from "../../index";
import { mockRawTreeDataProvider, mockInterfaceTreeDataProvider } from "./mockTreeDataProvider";

afterEach(cleanup);

describe("Breadcrumb", () => {
  let renderSpy: sinon.SinonSpy;
  let renderedComponent: RenderResult;
  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
  });

  describe("<Breadcrumb />", () => {
    it("should render", () => {
      render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />);
    });
    it("should render with interface dataProvider", () => {
      render(<Breadcrumb onRender={renderSpy} dataProvider={mockInterfaceTreeDataProvider} />);
    });

    describe("Raw DataProvider", () => {
      it("should rerender from interface DataProvider to raw dataProvider", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 1);
        const rootNode = mockRawTreeDataProvider[1];
        expect(await waitForElement(() => renderedComponent.getByText(rootNode.label))).to.exist;
        const mockRawTreeDataProvider2 = [...mockRawTreeDataProvider];
        mockRawTreeDataProvider2[1].label += " 2";
        await waitForUpdate(() => renderedComponent.rerender(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider2} />), renderSpy, 3);
        const rootNode2 = mockRawTreeDataProvider2[1];
        expect(await waitForElement(() => renderedComponent.getByText(rootNode2.label))).to.exist;
      });
      it("should have one child in parent element", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 1);
        const dropdownInputParent = renderedComponent.getByTestId("breadcrumb-dropdown-input-parent");
        expect(dropdownInputParent).to.exist;
        // should only every have input or dropdown
        expect(dropdownInputParent.children).to.have.lengthOf(1);
      });
      it("should change to input mode when dropdown background is clicked", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} />), renderSpy, 1);
        const dropdownBackground = renderedComponent.getByTestId("breadcrumb-dropdown-background");
        await waitForUpdate(() => fireEvent.click(dropdownBackground), renderSpy, 1);
        expect(renderedComponent.getByTestId("breadcrumb-input-root")).to.exist;
      });
      it("should change back from input mode when (X) button is clicked", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} initialBreadcrumbMode={BreadcrumbMode.Input} />), renderSpy, 1);
        const inputRoot = renderedComponent.getByTestId("breadcrumb-input-close");
        await waitForUpdate(() => fireEvent.click(inputRoot), renderSpy, 1);
        expect(renderedComponent.getByTestId("breadcrumb-dropdown-background")).to.exist;
      });
    });
    describe("With path", () => {
      const path = new BreadcrumbPath(mockRawTreeDataProvider);
      it("should render with path", () => {
        render(<Breadcrumb dataProvider={mockRawTreeDataProvider} path={path} />);
      });
      it("should update path to node", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} path={path} />), renderSpy, 1);
        const rootNode = mockRawTreeDataProvider[1];
        expect(await waitForElement(() => renderedComponent.getByText(rootNode.label))).to.exist;
        const node = mockRawTreeDataProvider[1].children![0];
        path.setCurrentNode(node);
        expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
      });
      it("should update path to root", async () => {
        await waitForUpdate(() => renderedComponent = render(<Breadcrumb onRender={renderSpy} dataProvider={mockRawTreeDataProvider} path={path} />), renderSpy, 1);
        const node = mockRawTreeDataProvider[1].children![0];
        path.setCurrentNode(node);
        expect(await waitForElement(() => renderedComponent.getByText(node.label))).to.exist;
        path.setCurrentNode(undefined);
        const list = await waitForElement(() => renderedComponent.getByTestId("breadcrumb-crumb-list"));
        expect(list).to.exist;
        expect(list!.children.length).to.equal(1);
      });
    });
  });
});
