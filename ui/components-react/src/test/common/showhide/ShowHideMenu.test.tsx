/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { ShowHideMenu } from "../../../components-react";
import TestUtils from "../../TestUtils";

describe("ShowHideMenu", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("<ShowHideMenu />", () => {
    const items = [{ id: "0", label: "" }, { id: "1", label: "Item 1" }, { id: "2", label: "Item 2" }, { id: "3", label: "Item 3" }];
    it("should render", () => {
      render(<ShowHideMenu
        x={0} y={0}
        items={items}
        opened={true} />);
    });
    it("should close", () => {
      const { rerender, getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items}
        opened={true} />);
      expect(getByTestId("core-context-menu-container").classList.contains("core-context-menu-opened")).to.be.true;
      rerender(<ShowHideMenu
        x={0} y={0}
        items={items}
        opened={false} />);
      expect(getByTestId("core-context-menu-container").classList.contains("core-context-menu-opened")).to.be.false;
    });
    it("should render with initialHidden", () => {
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items}
        opened={true} initialHidden={["1"]} />);
      expect((getByTestId("show-hide-menu-input-1") as HTMLInputElement).checked).to.be.false;
    });
    it("should update initialHidden", () => {
      const { rerender, getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items}
        opened={true} initialHidden={["1"]} />);
      const item1 = getByTestId("show-hide-menu-input-1") as HTMLInputElement;
      const item2 = getByTestId("show-hide-menu-input-2") as HTMLInputElement;
      expect(item1.checked).to.be.false;
      expect(item2.checked).to.be.true;
      rerender(<ShowHideMenu
        x={0} y={0}
        items={items}
        opened={true} initialHidden={["2"]} />);
      expect(item1.checked).to.be.true;
      expect(item2.checked).to.be.false;
    });
    it("should toggle checked", () => {
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} />);
      const item1 = getByTestId("show-hide-menu-input-1") as HTMLInputElement;
      fireEvent.click(item1);
      expect(item1.checked).to.be.false;
      fireEvent.click(item1);
      expect(item1.checked).to.be.true;
    });
    it("should trigger onClose when toggled", () => {
      const closeSpy = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onClose={closeSpy} />);
      const item1 = getByTestId("show-hide-menu-input-1") as HTMLInputElement;
      fireEvent.click(item1);
      expect(closeSpy).to.have.been.calledOnce;
    });
    it("should trigger onShowHideChange", () => {
      const showHideChange = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onShowHideChange={showHideChange} />);
      const item1 = getByTestId("show-hide-menu-input-1") as HTMLInputElement;
      fireEvent.click(item1);
      expect(showHideChange).to.have.been.calledWithMatch(["1"]);
      fireEvent.click(item1);
      expect(showHideChange).to.have.been.calledWithMatch([]);
    });
    it("should trigger showAll", () => {
      const showHideChange = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onShowHideChange={showHideChange} />);
      const showAll = getByTestId("show-hide-showall");
      fireEvent.click(showAll);
      expect(showHideChange).to.have.been.calledWithMatch([]);
    });
    it("should trigger onClose when 'show all' is pressed", () => {
      const closeSpy = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onClose={closeSpy} />);
      const showAll = getByTestId("show-hide-showall");
      fireEvent.click(showAll);
      expect(closeSpy).to.have.been.calledOnce;
    });
    it("should trigger showDialog", () => {
      const showHideChange = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onShowHideChange={showHideChange} />);
      const list = getByTestId("show-hide-list");
      fireEvent.click(list);
      expect(getByTestId("core-dialog-container")).to.exist;
    });
    it("should trigger onClose when 'list' is pressed", () => {
      const closeSpy = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onClose={closeSpy} />);
      const list = getByTestId("show-hide-list");
      fireEvent.click(list);
      expect(closeSpy).to.have.been.calledOnce;
    });
    it("should trigger onClose when 'list' is pressed", () => {
      const { getByTestId, queryByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} />);
      const list = getByTestId("show-hide-list");
      fireEvent.click(list);
      fireEvent.click(getByTestId("core-dialog-close"));
      expect(queryByTestId("core-dialog-container" as any)).to.not.exist;
    });
    it("should block contextMenu propagation in dialog", () => {
      const showHideChange = sinon.spy();
      const { getByTestId } = render(<ShowHideMenu
        x={0} y={0}
        items={items} opened={true} onShowHideChange={showHideChange} />);
      const showAll = getByTestId("show-hide-showall");
      fireEvent.click(showAll);
      const dialogRoot = getByTestId("core-dialog-root");
      fireEvent.contextMenu(dialogRoot);
    });
  });
});
