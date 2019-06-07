/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { render, cleanup } from "react-testing-library";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { ContextMenu, GlobalContextMenu, ContextMenuItem, ContextSubMenu, ContextMenuDivider } from "../../ui-core";
import { ContextMenuDirection, TildeFinder } from "../../ui-core/contextmenu/ContextMenu";

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
      expect(component.getByTestId("core-context-menu-container")).to.exist;
      expect(component.getByTestId("core-context-menu-container").className).to.contain("opened");
    });
    it("renders close correctly", () => {
      const component = render(<ContextMenu opened={false} />);
      expect(component.getByTestId("core-context-menu-container").className).to.not.contain("opened");
    });
    it("renders with ContextMenuItem correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextMenuItem> Test </ContextMenuItem>
        </ContextMenu>);
      expect(component.getByTestId("core-context-menu-item")).to.exist;
    });
    it("renders with text children correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          Test
        </ContextMenu>);
      expect(component.queryByTestId("core-context-menu-item")).to.not.exist;
      expect(component.getByText("Test")).to.exist;
    });
    it("renders with non MenuItem children correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <div data-testid="core-context-menu-test-div">Test</div>
        </ContextMenu>);
      expect(component.getByTestId("core-context-menu-test-div")).to.exist;
    });
    describe("Keyboard navigation", () => {
      it("should handle Escape press", () => {
        const handleEsc = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onEsc={handleEsc} />);
        const root = component.getByTestId("core-context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 27 /* <Esc> */ }));
        expect(handleEsc).to.be.calledOnce;
      });
      it("should handle one-level Left press", () => {
        const handleEsc = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onEsc={handleEsc} />);
        const root = component.getByTestId("core-context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { keyCode: 37 /* <Left> */ }));
        expect(handleEsc).to.be.calledOnce;
      });
      it("should handle one-level select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextMenuItem>Item 1</ContextMenuItem>
          </ContextMenu>);
        const root = component.getByTestId("core-context-menu-root");
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
        const root = component.getByTestId("core-context-menu-root");
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
        const root = component.getByTestId("core-context-menu-root");
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
        const root1 = component.getAllByTestId("core-context-menu-root")[0];
        const root2 = component.getAllByTestId("core-context-menu-root")[1];
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
        const root1 = component.getAllByTestId("core-context-menu-root")[0];
        const root2 = component.getAllByTestId("core-context-menu-root")[1];
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 39 /* <Right> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { keyCode: 37 /* <Left> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 40 /* <Down> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
      it("should select list item of hotkey", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true}>
            <ContextMenuItem onSelect={onSelectFake}>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.have.been.calledOnce;
      });
      it("should select sub menu list item of hotkey", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true}>
            <ContextSubMenu label="~First item" onSelect={onSelectFake}>
              <ContextMenuItem>~First first item</ContextMenuItem>
              <ContextMenuItem>~Second first item</ContextMenuItem>
            </ContextSubMenu>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.have.been.calledOnce;
      });
      it("should find list item of hotkey", () => {
        const component = render(
          <ContextMenu opened={true} hotkeySelect={false}>
            <ContextMenuItem>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "s" }));
        const items = component.getAllByTestId("core-context-menu-item");
        const idx = items.findIndex((value) => value.className.indexOf("is-selected") !== -1);
        expect(idx).to.equal(1);
      });
      it("should find sub menu list item of hotkey", () => {
        const component = render(
          <ContextMenu opened={true} hotkeySelect={false}>
            <ContextSubMenu label="~First item">
              <ContextMenuItem>~First first item</ContextMenuItem>
              <ContextMenuItem>~Second first item</ContextMenuItem>
            </ContextSubMenu>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        const items = component.getAllByTestId("core-context-menu-item");
        const idx = items.findIndex((value) => value.className.indexOf("is-selected") !== -1);
        expect(idx).to.equal(0);
      });
      it("should find next list item of hotkey", () => {
        const component = render(
          <ContextMenu opened={true} hotkeySelect={false}>
            <ContextMenuItem>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
            <ContextMenuItem>~Third item</ContextMenuItem>
            <ContextMenuItem>~Fourth item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        const items = component.getAllByTestId("core-context-menu-item");
        const idx = items.findIndex((value) => value.className.indexOf("is-selected") !== -1);
        expect(idx).to.equal(3);
      });
      it("should wrap back to beginning to find next list item of hotkey", () => {
        const component = render(
          <ContextMenu opened={true} hotkeySelect={false}>
            <ContextMenuItem>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
            <ContextMenuItem>~Third item</ContextMenuItem>
            <ContextMenuItem>~Fourth item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: "s" }));
        const items = component.getAllByTestId("core-context-menu-item");
        const idx = items.findIndex((value) => value.className.indexOf("is-selected") !== -1);
        expect(idx).to.equal(1);
      });
    });
  });
  // TODO: tests for hover/current active menu item
  describe("<GlobalContextMenu />", () => {
    it("renders correctly", () => {
      const component = render(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      expect(component.getByTestId("core-context-menu-root")).to.exist;
    });
    it("mounts and unmounts correctly", () => {
      const wrapper = render(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      wrapper.unmount();
    });
  });
  describe("<ContextMenuDivider />", () => {
    it("renders correctly", () => {
      const component = render(<ContextMenuDivider />);
      expect(component.getByTestId("core-context-menu-divider")).to.exist;
    });
  });
  describe("<ContextMenuItem />", () => {
    it("renders correctly", () => {
      const component = render(<ContextMenuItem>Test</ContextMenuItem>);
      expect(component.getByText("Test")).to.exist;
    });

    it("focuses correctly", () => {
      const component = render(<ContextMenuItem>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("focus"));
    });

    it("onClick handled correctly", () => {
      const handleClick = sinon.fake();
      const component = render(<ContextMenuItem onClick={handleClick}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("click"));
      handleClick.should.have.been.calledOnce;
    });
    it("onSelect handled correctly on click", () => {
      const handleSelect = sinon.fake();
      const component = render(<ContextMenuItem onSelect={handleSelect}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("click"));
      handleSelect.should.have.been.calledOnce;
    });
    it("onHover handled correctly", () => {
      const handleHover = sinon.fake();
      const component = render(<ContextMenuItem onHover={handleHover}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("mouseover"));
      handleHover.should.have.been.calledOnce;
    });
    it("onSelect handled correctly on Enter", () => {
      const handleSelect = sinon.fake();
      const component = render(<ContextMenuItem onSelect={handleSelect}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("keyup", { keyCode: 13 /* <Return> */ }));
      handleSelect.should.have.been.calledOnce;
    });
    it("onSelect not called on Escape", () => {
      const handleSelect = sinon.fake();
      const component = render(<ContextMenuItem onSelect={handleSelect}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("keyup", { keyCode: 27 /* <Esc> */ }));
      handleSelect.should.not.have.been.called;
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
    it("onHover handled correctly", () => {
      const handleHover = sinon.fake();
      const component = render(
        <ContextSubMenu label="test" onHover={handleHover}>
          <ContextMenuItem> Test </ContextMenuItem>
        </ContextSubMenu>);
      const item = component.getByTestId("core-context-submenu");
      item.dispatchEvent(createBubbledEvent("mouseover"));
      handleHover.should.have.been.calledOnce;
    });
    it("onHover handled internally when in ContextMenu", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test">
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      const item = component.getByTestId("core-context-submenu");
      item.dispatchEvent(createBubbledEvent("mouseover"));
    });
    it("onClick handled correctly", () => {
      const handleClick = sinon.fake();
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" onClick={handleClick}>
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      const item = component.getByTestId("core-context-submenu-container");
      item.dispatchEvent(createBubbledEvent("click"));
      handleClick.should.have.been.calledOnce;
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
  describe("TildeFinder", () => {
    it("should not find character in string when there is no tilde", () => {
      const tildeFindRet = TildeFinder.findAfterTilde("s");
      expect(tildeFindRet.character).to.be.undefined;
    });
    it("should find character after tilde in string", () => {
      const tildeFindRet = TildeFinder.findAfterTilde("~s");
      expect(tildeFindRet.character).to.equal("S");
    });
    it("should find remove tilde and add underline in string", () => {
      const tildeFindRet = TildeFinder.findAfterTilde("~s");
      const node = (tildeFindRet.node as Array<React.ReactElement<any>>)[1];
      expect(node.type).to.equal("u");
      expect(node.props.children).to.equal("s");
    });
    it("should not find character after array when there is no tilde", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(["te", "s", "t"]);
      expect(tildeFindRet.character).to.be.undefined;
    });
    it("should find character after tilde in array", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(["te", "~s", "t"]);
      expect(tildeFindRet.character).to.equal("S");
    });
    it("should find remove tilde and add underline in array", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(["te", "~s", "t"]);
      const node = (tildeFindRet.node as Array<Array<React.ReactElement<any>>>)[1][1];
      expect(node.type).to.equal("u");
      expect(node.props.children).to.equal("s");
    });
    it("should find character after tilde in node", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(<span>~s</span>);
      expect(tildeFindRet.character).to.equal("S");
    });
    it("should not find character in node when there is no tilde", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(<span>s</span>);
      expect(tildeFindRet.character).to.be.undefined;
    });
    it("should remove tilde and add underline in node", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(<span>~s</span>);
      const node = ((tildeFindRet.node as React.ReactElement<any>).props.children as React.ReactNode[])[1] as React.ReactElement<any>;
      expect(node.type).to.equal("u");
      expect(node.props.children).to.equal("s");
    });
    it("should fallback to undefined character when node passed is undefined", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(undefined);
      expect(tildeFindRet.character).to.equal(undefined);
    });
    it("should fallback to undefined character when node passed is not string, array, or node", () => {
      const tildeFindRet = TildeFinder.findAfterTilde(true);
      expect(tildeFindRet.character).to.equal(undefined);
    });
    it("should fallback to undefined character when node passed is an empty object", () => {
      const tildeFindRet = TildeFinder.findAfterTilde({});
      expect(tildeFindRet.character).to.equal(undefined);
    });
    it("should pass node value through when node passed is not string, array, or node", () => {
      const node = true;
      const tildeFindRet = TildeFinder.findAfterTilde(node);
      expect(tildeFindRet.node).to.equal(node);
    });
  });
});
