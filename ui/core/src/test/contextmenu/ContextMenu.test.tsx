/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { render, cleanup } from "react-testing-library";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { ContextMenu, GlobalContextMenu, ContextMenuItem, ContextSubMenu, ContextMenuDivider } from "../../ui-core";
import { ContextMenuDirection } from "../../ui-core/contextmenu/ContextMenu";

describe("ContextMenu", () => {

  afterEach(cleanup);

  const createBubbledEvent = (type: string, props = {}) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  };

  describe("<ContextMenu />", () => {
    it("renders open correctly", () => {
      const component = render(<ContextMenu opened={true} />);
      expect(component.getByTestId("context-menu-container")).to.exist;
      expect(component.getByTestId("context-menu-container").className).to.contain("opened");
    });
    it("renders close correctly", () => {
      const component = render(<ContextMenu opened={false} />);
      expect(component.getByTestId("context-menu-container").className).to.not.contain("opened");
    });
    it("renders with ContextMenuItem correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextMenuItem> Test </ContextMenuItem>
        </ContextMenu>);
      expect(component.getByTestId("context-menu-item")).to.exist;
    });
    it("renders with text children correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          Test
        </ContextMenu>);
      expect(component.queryByTestId("context-menu-item")).to.not.exist;
      expect(component.getByText("Test")).to.exist;
    });
    it("renders with non MenuItem children correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <div data-testid="context-menu-test-div">Test</div>
        </ContextMenu>);
      expect(component.getByTestId("context-menu-test-div")).to.exist;
    });
    describe("Keyboard navigation", () => {
      it("should handle Escape press", () => {
        const handleEsc = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onEsc={handleEsc} />);
        const root = component.getByTestId("context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 27 /* <Esc> */ }));
        expect(handleEsc).to.be.calledOnce;
      });
      it("should handle one-level Left press", () => {
        const handleEsc = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onEsc={handleEsc} />);
        const root = component.getByTestId("context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 37 /* <Left> */ }));
        expect(handleEsc).to.be.calledOnce;
      });
      it("should handle one-level select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextMenuItem>Item 1</ContextMenuItem>
          </ContextMenu>);
        const root = component.getByTestId("context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
      it("should handle one-level down arrow select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextMenuItem>Item 1</ContextMenuItem>
            <ContextMenuItem>Item 2</ContextMenuItem>
          </ContextMenu>);
        const root = component.getByTestId("context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
      it("should handle one-level up arrow select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextMenuItem>Item 1</ContextMenuItem>
            <ContextMenuItem>Item 2</ContextMenuItem>
          </ContextMenu>);
        const root = component.getByTestId("context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 38 /* <Up> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 38 /* <Up> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 38 /* <Up> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
      it("should handle multi-level right arrow select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextSubMenu label="Item 1" >
              <ContextMenuItem>Item 1.1</ContextMenuItem>
              <ContextMenuItem>Item 1.2</ContextMenuItem>
            </ContextSubMenu>
          </ContextMenu>);
        const root1 = component.getAllByTestId("context-menu-root")[0];
        const root2 = component.getAllByTestId("context-menu-root")[1];
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 39 /* <Right> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
      it("should handle multi-level left arrow select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextSubMenu label="Item 1" >
              <ContextMenuItem>Item 1.1</ContextMenuItem>
              <ContextMenuItem>Item 1.2</ContextMenuItem>
            </ContextSubMenu>
            <ContextMenuItem>Item 2</ContextMenuItem>
          </ContextMenu>);
        const root1 = component.getAllByTestId("context-menu-root")[0];
        const root2 = component.getAllByTestId("context-menu-root")[1];
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 39 /* <Right> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { keyCode: 37 /* <Left> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
    });
  });
  // TODO: tests for hover/current active menu item
  describe("<GlobalContextMenu />", () => {
    it("renders correctly", () => {
      const component = render(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      expect(component.getByTestId("context-menu-root")).to.exist;
    });
    it("mounts and unmounts correctly", () => {
      const wrapper = render(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      wrapper.unmount();
    });
  });
  describe("<ContextMenuDivider />", () => {
    it("renders correctly", () => {
      const component = render(<ContextMenuDivider />);
      expect(component.getByTestId("context-menu-divider")).to.exist;
    });
  });
  describe("<ContextMenuItem />", () => {
    it("renders correctly", () => {
      const component = render(<ContextMenuItem>Test</ContextMenuItem>);
      expect(component.getByText("Test")).to.exist;
    });

    it("focuses correctly", () => {
      const component = render(<ContextMenuItem>Test</ContextMenuItem>);
      const item = component.getByTestId("context-menu-item");
      item.dispatchEvent(createBubbledEvent("focus"));
    });

    it("onClick handled correctly", () => {
      const handleClick = sinon.fake();
      const component = render(<ContextMenuItem onClick={handleClick}>Test</ContextMenuItem>);
      const item = component.getByTestId("context-menu-item");
      item.dispatchEvent(createBubbledEvent("click"));
      handleClick.should.have.been.calledOnce;
    });
    it("onSelect handled correctly", () => {
      const handleSelect = sinon.fake();
      const component = render(<ContextMenuItem onSelect={handleSelect}>Test</ContextMenuItem>);
      const item = component.getByTestId("context-menu-item");
      item.dispatchEvent(createBubbledEvent("click"));
      handleSelect.should.have.been.calledOnce;
    });
  });
  describe("<ContextSubMenu />", () => {
    it("renders correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test">
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      expect(component.getByText("test")).to.exist;
    });
  });
  describe("ContextMenu.autoFlip", () => {
    it("should handle rect overflowing right side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopRight, { left: 51, top: 25, right: 101, bottom: 75, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.TopLeft);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Right, { left: 51, top: 25, right: 101, bottom: 75, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.Left);
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomRight, { left: 51, top: 25, right: 101, bottom: 75, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.BottomLeft);
    });
    it("should handle rect overflowing left side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopLeft, { left: -1, top: 25, right: 49, bottom: 75, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.TopRight);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Left, { left: -1, top: 25, right: 49, bottom: 75, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.Right);
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomLeft, { left: -1, top: 25, right: 49, bottom: 75, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.BottomRight);
    });
    it("should handle rect overflowing bottom side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomLeft, { left: 25, top: 51, right: 75, bottom: 101, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.TopLeft);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Bottom, { left: 25, top: 51, right: 75, bottom: 101, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.Top);
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomRight, { left: 25, top: 51, right: 75, bottom: 101, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.TopRight);
    });
    it("should handle rect overflowing top side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopLeft, { left: 25, top: -1, right: 75, bottom: 49, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.BottomLeft);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Top, { left: 25, top: -1, right: 75, bottom: 49, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.Bottom);
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopRight, { left: 25, top: -1, right: 75, bottom: 49, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.BottomRight);
    });
    it("should handle rect overflowing top left side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopLeft, { left: -1, top: -1, right: 49, bottom: 49, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.BottomRight);
    });
    it("should handle rect overflowing top right side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopRight, { left: 51, top: -1, right: 101, bottom: 49, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.BottomLeft);
    });
    it("should handle rect overflowing bottom left side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomLeft, { left: -1, top: 51, right: 49, bottom: 101, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.TopRight);
    });
    it("should handle rect overflowing bottom right side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomRight, { left: 51, top: 51, right: 101, bottom: 101, height: 50, width: 50 }, 100, 100))
        .to.equal(ContextMenuDirection.TopLeft);
    });
  });
});
