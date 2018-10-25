/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, within, cleanup, fireEvent, waitForElement } from "react-testing-library";
import { Breadcrumb, BreadcrumbPath } from "../../src/index";
import { mockTreeDataProvider } from "./mockTreeDataProvider";

afterEach(cleanup);

describe("Breadcrumb", () => {
  describe("<Breadcrumb />", () => {
    it("should render", () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { unmount } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      unmount();
    });
    it("should have one child in parent element", () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { getByTestId } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      const dropdownInputParent = getByTestId("breadcrumb-dropdown-input-parent");
      expect(dropdownInputParent).to.exist;
      // should only every have input or dropdown
      expect(dropdownInputParent!.children).to.have.lengthOf(1);
    });
    it("should update path", async () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { queryByText } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      const node = (await mockTreeDataProvider.getRootNodes())[0];
      expect(queryByText(node.label)).to.not.exist;
      path.setCurrentNode(node);
      expect(await waitForElement(() => queryByText(node.label))).to.exist;
    });
    it("should change to input mode when dropdown background is clicked", async () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { getByTestId } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      const dropdownBackground = getByTestId("breadcrumb-dropdown-background");
      fireEvent.click(dropdownBackground);
    });
    it("should close context menu when ESC is pressed", async () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { getByTestId } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      const dropdownBackground = getByTestId("breadcrumb-dropdown-background");
      fireEvent.click(dropdownBackground);
      const inputRoot = await waitForElement(() => getByTestId("breadcrumb-input-root"));
      const primaryInputMenu = within(inputRoot!).getByTestId("context-menu-root");
      fireEvent.keyUp(primaryInputMenu, { keyCode: 27 });
    });
    it("should return from input mode to dropdown mode when Return is pressed", async () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { getByTestId } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      const dropdownBackground = getByTestId("breadcrumb-dropdown-background");
      fireEvent.click(dropdownBackground);
      const inputRoot = await waitForElement(() => getByTestId("breadcrumb-input-root"));
      const primaryInputMenu = within(inputRoot!).getByTestId("context-menu-root");
      fireEvent.keyUp(primaryInputMenu, { keyCode: 13 });
    });
    it("should autocomplete when menu item is clicked", async () => {
      const path = new BreadcrumbPath(mockTreeDataProvider);
      const { getByTestId } = render(<Breadcrumb dataProvider={mockTreeDataProvider} path={path} />);
      const dropdownBackground = getByTestId("breadcrumb-dropdown-background");
      fireEvent.click(dropdownBackground);

      const primaryInputMenuItem = within(getByTestId("breadcrumb-input-root"));
      const node = (await mockTreeDataProvider.getRootNodes())[0];
      const menuItem = await waitForElement(() => primaryInputMenuItem.getByText(node.label));
      fireEvent.click(menuItem!);
    });
  });
});
