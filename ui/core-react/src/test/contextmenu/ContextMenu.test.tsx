/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { mount } from "enzyme";
import { BadgeType, ConditionalBooleanValue, SpecialKey } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import { ContextMenu, ContextMenuDirection, ContextMenuDivider, ContextMenuItem, ContextSubMenu, GlobalContextMenu } from "../../core-react";
import { TildeFinder } from "../../core-react/contextmenu/TildeFinder";
import TestUtils from "../TestUtils";

describe("ContextMenu", () => {

  const createBubbledEvent = (type: string, props = {}) => {
    return TestUtils.createBubbledEvent(type, props);
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
    it("should call onOutsideClick on window mouseup", () => {
      const spyMethod = sinon.fake();
      render(
        <ContextMenu opened={true} onOutsideClick={spyMethod}>
          <ContextMenuItem> Test </ContextMenuItem>
        </ContextMenu>);

      const mouseUp = new MouseEvent("mouseup");
      sinon.stub(mouseUp, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseUp);

      spyMethod.should.have.been.called;
    });
    it("should not call onOutsideClick on window mouseup if closed", () => {
      const spyMethod = sinon.fake();
      render(
        <ContextMenu onOutsideClick={spyMethod}>
          <ContextMenuItem> Test </ContextMenuItem>
        </ContextMenu>);

      const mouseUp = new MouseEvent("mouseup");
      sinon.stub(mouseUp, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseUp);

      spyMethod.should.not.have.been.called;
    });
    it("should support selectedIndex", () => {
      const component = render(
        <ContextMenu selectedIndex={0}>
          <ContextMenuItem> Test 1 </ContextMenuItem>
          <ContextMenuItem> Test 2 </ContextMenuItem>
        </ContextMenu>);

      let items = component.getAllByTestId("core-context-menu-item");
      let idx = items.findIndex((value) => value.className.indexOf("is-selected") !== -1);
      expect(idx).to.equal(0);

      component.rerender(
        <ContextMenu selectedIndex={1}>
          <ContextMenuItem> Test 1 </ContextMenuItem>
          <ContextMenuItem> Test 2 </ContextMenuItem>
        </ContextMenu>);

      items = component.getAllByTestId("core-context-menu-item");
      idx = items.findIndex((value) => value.className.indexOf("is-selected") !== -1);
      expect(idx).to.equal(1);
    });

    describe("Keyboard navigation", () => {
      it("should handle Escape press", () => {
        const handleEsc = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onEsc={handleEsc} />);
        const root = component.getByTestId("core-context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Escape /* <Esc> */ }));
        expect(handleEsc).to.be.calledOnce;
      });
      it("should handle one-level Left press", () => {
        const handleEsc = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onEsc={handleEsc} />);
        const root = component.getByTestId("core-context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowLeft /* <Left> */ }));
        expect(handleEsc).to.be.calledOnce;
      });
      it("should handle one-level select", () => {
        const handleSelect = sinon.fake();
        const component = render(
          <ContextMenu opened={true} onSelect={handleSelect}>
            <ContextMenuItem>Item 1</ContextMenuItem>
          </ContextMenu>);
        const root = component.getByTestId("core-context-menu-root");
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
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
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
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
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowUp /* <Up> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowUp /* <Up> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowUp /* <Up> */ }));
        root.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
        expect(handleSelect).to.be.calledOnce;
      });
      it("should handle multi-level right arrow then enter select", () => {
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
        root1.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowRight /* <Right> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
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
        root1.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowRight /* <Right> */ }));
        root2.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowLeft /* <Left> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.ArrowDown /* <Down> */ }));
        root1.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
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
      it("should not select list item of hotkey if disabled", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true}>
            <ContextMenuItem onSelect={onSelectFake} disabled={true}>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.not.have.been.called;
      });
      it("should not select list item of hotkey if hidden", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true}>
            <ContextMenuItem onSelect={onSelectFake} hidden={true}>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.not.have.been.called;
      });
      it("should ignore next keyup when ignoreNextKeyUp=true", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true} ignoreNextKeyUp={true}>
            <ContextMenuItem onSelect={onSelectFake}>~First item</ContextMenuItem>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.not.have.been.called;
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
      it("should not select sub menu list item of hotkey if disabled", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true}>
            <ContextSubMenu label="~First item" onSelect={onSelectFake} disabled={true}>
              <ContextMenuItem>~First first item</ContextMenuItem>
              <ContextMenuItem>~Second first item</ContextMenuItem>
            </ContextSubMenu>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.not.have.been.called;
      });
      it("should not select sub menu list item of hotkey if hidden", () => {
        const onSelectFake = sinon.fake();
        const component = render(
          <ContextMenu opened={true}>
            <ContextSubMenu label="~First item" onSelect={onSelectFake} hidden={true}>
              <ContextMenuItem>~First first item</ContextMenuItem>
              <ContextMenuItem>~Second first item</ContextMenuItem>
            </ContextSubMenu>
            <ContextMenuItem>~Second item</ContextMenuItem>
          </ContextMenu>);
        const root = component.getAllByTestId("core-context-menu-root")[0];
        root.dispatchEvent(createBubbledEvent("keyup", { key: "f" }));
        expect(onSelectFake).to.not.have.been.called;
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

    describe("direction", () => {
      it("should render bottom right by default", () => {
        const component = render(<ContextMenu opened={true} />);
        expect(component.container.querySelector(".core-context-menu-bottom")).not.to.be.null;
        expect(component.container.querySelector(".core-context-menu-right")).not.to.be.null;
      });
      it("should render no direction for None", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.None} />);
        expect(component.container.querySelector(".core-context-menu-bottom")).to.be.null;
        expect(component.container.querySelector(".core-context-menu-right")).to.be.null;
      });
      it("should render top left", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.TopLeft} />);
        expect(component.container.querySelector(".core-context-menu-top")).not.to.be.null;
        expect(component.container.querySelector(".core-context-menu-left")).not.to.be.null;
      });
      it("should render top", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.Top} />);
        expect(component.container.querySelector(".core-context-menu-top")).not.to.be.null;
      });
      it("should render top right", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.TopRight} />);
        expect(component.container.querySelector(".core-context-menu-top")).not.to.be.null;
        expect(component.container.querySelector(".core-context-menu-right")).not.to.be.null;
      });
      it("should render left", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.Left} />);
        expect(component.container.querySelector(".core-context-menu-left")).not.to.be.null;
      });
      it("should render center", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.Center} />);
        expect(component.container.querySelector(".core-context-menu-center")).not.to.be.null;
      });
      it("should render right", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.Right} />);
        expect(component.container.querySelector(".core-context-menu-right")).not.to.be.null;
      });
      it("should render bottom left", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.BottomLeft} />);
        expect(component.container.querySelector(".core-context-menu-bottom")).not.to.be.null;
        expect(component.container.querySelector(".core-context-menu-left")).not.to.be.null;
      });
      it("should render bottom", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.Bottom} />);
        expect(component.container.querySelector(".core-context-menu-bottom")).not.to.be.null;
      });
      it("should render bottom right", () => {
        const component = render(<ContextMenu opened={true} direction={ContextMenuDirection.BottomRight} />);
        expect(component.container.querySelector(".core-context-menu-bottom")).not.to.be.null;
        expect(component.container.querySelector(".core-context-menu-right")).not.to.be.null;
      });
      it("should support changing direction", () => {
        const wrapper = mount<ContextMenu>(<ContextMenu opened={true} direction={ContextMenuDirection.Right} />);
        expect(wrapper.state().direction === ContextMenuDirection.Right);
        wrapper.setProps({ direction: ContextMenuDirection.Left, opened: false });
        expect(wrapper.state().direction === ContextMenuDirection.Left);
        wrapper.unmount();
      });
    });
  });

  describe("<GlobalContextMenu />", () => {
    it("renders correctly", () => {
      const component = render(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      expect(component.getByTestId("core-context-menu-root")).to.exist;
    });
    it("mounts and unmounts correctly", () => {
      const wrapper = render(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      wrapper.unmount();
    });
    it("mounts and unmounts without an identifier correctly", () => {
      const wrapper = render(<GlobalContextMenu opened={true} x="0" y="0" />);
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

    it("renders with icon correctly", () => {
      const component = render(<ContextMenuItem icon="icon-placeholder">Test</ContextMenuItem>);
      expect(component.container.querySelector(".icon-placeholder")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-icon")).not.to.be.null;
    });

    it("renders with iconRight correctly", () => {
      const component = render(<ContextMenuItem iconRight="icon-checkmark">Test</ContextMenuItem>);
      expect(component.container.querySelector(".icon-checkmark")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-icon")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-icon-right")).not.to.be.null;
    });

    it("handles props changes correctly", () => {
      const component = render(<ContextMenuItem>Test ~A</ContextMenuItem>);
      expect(component.getByText("Test")).to.exist;
      expect(component.getByText("A")).to.exist;
      component.rerender(<ContextMenuItem>Test ~B</ContextMenuItem>);
      expect(component.getByText("Test")).to.exist;
      expect(component.getByText("B")).to.exist;
    });

    it("focuses correctly", () => {
      const component = render(<ContextMenuItem>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("focus"));
    });

    it("renders disabled correctly", () => {
      const component = render(<ContextMenuItem disabled={true}>Test</ContextMenuItem>);
      expect(component.container.querySelector(".core-context-menu-disabled")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-disabled]")).not.to.be.null;
    });

    it("renders disabled by condition correctly", () => {
      const isDisabled = new ConditionalBooleanValue(() => true, ["Test:CustomId"]);
      const component = render(<ContextMenuItem disabled={isDisabled}>Test</ContextMenuItem>);
      expect(component.container.querySelector(".core-context-menu-disabled")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-disabled]")).not.to.be.null;
    });

    it("renders hidden correctly", () => {
      const component = render(<ContextMenuItem hidden={true}>Test</ContextMenuItem>);
      expect(component.container.querySelector(".core-context-menu-hidden")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-hidden]")).not.to.be.null;
    });

    it("renders hidden by condition correctly", () => {
      const isHidden = new ConditionalBooleanValue(() => true, ["Test:CustomId"]);
      const component = render(<ContextMenuItem hidden={isHidden}>Test</ContextMenuItem>);
      expect(component.container.querySelector(".core-context-menu-hidden")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-hidden]")).not.to.be.null;
    });

    it("renders badge correctly", () => {
      const component = render(<ContextMenuItem badgeType={BadgeType.New}>Test</ContextMenuItem>);
      expect(component.container.querySelector(".core-badge")).not.to.be.null;
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
      item.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
      handleSelect.should.have.been.calledOnce;
    });
    it("onSelect not called on Escape", () => {
      const handleSelect = sinon.fake();
      const component = render(<ContextMenuItem onSelect={handleSelect}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Escape /* <Esc> */ }));
      handleSelect.should.not.have.been.called;
    });
    it("onSelect not called when disabled", () => {
      const handleSelect = sinon.fake();
      const component = render(<ContextMenuItem onSelect={handleSelect} disabled={true}>Test</ContextMenuItem>);
      const item = component.getByTestId("core-context-menu-item");
      item.dispatchEvent(createBubbledEvent("keyup", { key: SpecialKey.Enter /* <Return> */ }));
      handleSelect.should.not.have.been.called;
      item.dispatchEvent(createBubbledEvent("click"));
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
    it("renders disabled correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" disabled={true}>
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      expect(component.container.querySelector(".core-context-menu-disabled")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-disabled]")).not.to.be.null;
    });
    it("renders disabled by condition correctly", () => {
      const isDisabled = new ConditionalBooleanValue(() => true, ["Test:CustomId"]);
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" disabled={isDisabled}>
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      expect(component.container.querySelector(".core-context-menu-disabled")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-disabled]")).not.to.be.null;
    });
    it("renders hidden correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" hidden={true}>
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      expect(component.container.querySelector(".core-context-menu-hidden")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-hidden]")).not.to.be.null;
    });
    it("renders hidden by condition correctly", () => {
      const isHidden = new ConditionalBooleanValue(() => true, ["Test:CustomId"]);
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" hidden={isHidden}>
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      expect(component.container.querySelector(".core-context-menu-hidden")).not.to.be.null;
      expect(component.container.querySelector(".core-context-menu-item[aria-hidden]")).not.to.be.null;
    });
    it("renders badge correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" badgeType={BadgeType.TechnicalPreview}>
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      expect(component.container.querySelector(".core-badge")).not.to.be.null;
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
    it("onFocus handled correctly", () => {
      const component = render(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test" >
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
      const item = component.getByTestId("core-context-menu-item");
      item.focus();
      expect(document.activeElement).to.eq(item);
    });
    it("should support changing direction", () => {
      const wrapper = mount<ContextSubMenu>(
        <ContextSubMenu label="test" autoflip={true}>
          <ContextMenuItem>Test</ContextMenuItem>
        </ContextSubMenu>);
      expect(wrapper.state().direction === ContextMenuDirection.Right);
      wrapper.setProps({ direction: ContextMenuDirection.Left });
      expect(wrapper.state().direction === ContextMenuDirection.Left);
      wrapper.unmount();
    });
    it("handles label change correctly", () => {
      const component = render(
        <ContextSubMenu label="Test ~A">
          <ContextMenuItem>Test Item</ContextMenuItem>
        </ContextSubMenu>);
      expect(component.getByText("Test")).to.exist;
      expect(component.getByText("A")).to.exist;
      component.rerender(
        <ContextSubMenu label="Test ~B">
          <ContextMenuItem>Test Item</ContextMenuItem>
        </ContextSubMenu>);
      expect(component.getByText("Test")).to.exist;
      expect(component.getByText("B")).to.exist;
    });

  });

  describe("ContextMenu.autoFlip", () => {
    it("should handle rect overflowing right side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopRight, DOMRect.fromRect({ x: 51, y: 25, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.TopLeft);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Right, DOMRect.fromRect({ x: 51, y: 25, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.Left);
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomRight, DOMRect.fromRect({ x: 51, y: 25, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.BottomLeft);
    });
    it("should handle rect overflowing left side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopLeft, DOMRect.fromRect({ x: -1, y: 25, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.TopRight);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Left, DOMRect.fromRect({ x: -1, y: 25, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.Right);
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomLeft, DOMRect.fromRect({ x: -1, y: 25, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.BottomRight);
    });
    it("should handle rect overflowing bottom side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomLeft, DOMRect.fromRect({ x: 25, y: 51, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.TopLeft);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Bottom, DOMRect.fromRect({ x: 25, y: 51, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.Top);
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomRight, DOMRect.fromRect({ x: 25, y: 51, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.TopRight);
    });
    it("should handle rect overflowing top side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopLeft, DOMRect.fromRect({ x: 25, y: -1, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.BottomLeft);
      expect(ContextMenu.autoFlip(ContextMenuDirection.Top, DOMRect.fromRect({ x: 25, y: -1, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.Bottom);
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopRight, DOMRect.fromRect({ x: 25, y: -1, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.BottomRight);
    });
    it("should handle rect overflowing top left side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopLeft, DOMRect.fromRect({ x: -1, y: -1, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.BottomRight);
    });
    it("should handle rect overflowing top right side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.TopRight, DOMRect.fromRect({ x: 51, y: -1, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.BottomLeft);
    });
    it("should handle rect overflowing bottom left side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomLeft, DOMRect.fromRect({ x: -1, y: 51, height: 50, width: 50 }), 100, 100))
        .to.equal(ContextMenuDirection.TopRight);
    });
    it("should handle rect overflowing bottom right side of window", () => {
      expect(ContextMenu.autoFlip(ContextMenuDirection.BottomRight, DOMRect.fromRect({ x: 51, y: 51, height: 50, width: 50 }), 100, 100))
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
