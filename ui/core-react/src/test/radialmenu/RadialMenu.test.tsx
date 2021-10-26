/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { RadialButton, RadialMenu } from "../../core-react";
import { TestUtils } from "../TestUtils";

describe("RadialMenu", () => {

  let radialMenu1: React.ReactElement<any>;

  const createBubbledEvent = (type: string, props = {}) => {
    return TestUtils.createBubbledEvent(type, props);
  };

  beforeEach(() => {
    radialMenu1 = <RadialMenu
      opened={true}
      left={100}
      top={100}
      innerRadius={10}
      outerRadius={100}
    />;
  });

  describe("<RadialMenu />", () => {
    it("should render", () => {
      const wrapper = mount(radialMenu1);

      const div = wrapper.find(".core-radial-menu");
      const containerStyle = div.get(0).props.style;
      expect(containerStyle).to.have.property("left", 100);
      expect(containerStyle).to.have.property("top", 100);

      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(radialMenu1).should.matchSnapshot();
    });

    it("should handle props changes", () => {
      const wrapper = mount(radialMenu1);
      expect(wrapper.prop("innerRadius")).to.eq(10);
      expect(wrapper.prop("outerRadius")).to.eq(100);

      wrapper.setProps({ innerRadius: 20, outerRadius: 120 });
      wrapper.update();
      expect(wrapper.prop("innerRadius")).to.eq(20);
      expect(wrapper.prop("outerRadius")).to.eq(120);
      wrapper.unmount();
    });

    it("should fix x and y if too low", () => {
      const wrapper = mount(<RadialMenu opened={true} left={-1} top={-1} innerRadius={10} outerRadius={100} />);
      const div = wrapper.find(".core-radial-menu");
      const containerStyle = div.get(0).props.style;
      expect(containerStyle).to.have.property("left", 0);
      expect(containerStyle).to.have.property("top", 0);
      wrapper.unmount();
    });

    it("should fix x and y if too height", () => {
      const value = 10000;
      const wrapper = mount(<RadialMenu opened={true} left={value} top={value} innerRadius={10} outerRadius={100} />);
      const div = wrapper.find(".core-radial-menu");
      const containerStyle = div.get(0).props.style;
      expect(containerStyle.left).to.be.lessThan(window.innerWidth);
      expect(containerStyle.top).to.be.lessThan(window.innerWidth);
      wrapper.unmount();
    });

    it("should call onEsc", async () => {
      const spyMethod = sinon.fake();
      const component = render(<RadialMenu opened={true} left={100} top={100} innerRadius={10} outerRadius={100} onEsc={spyMethod} />);
      await TestUtils.flushAsyncOperations();

      const item = component.getByTestId("core-radial-menu");
      item.dispatchEvent(createBubbledEvent("keyup", { key: "Escape" }));
      spyMethod.should.have.been.called;
    });

    it("should call onBlur on window mouseup", async () => {
      const spyMethod = sinon.fake();
      render(<RadialMenu opened={true} left={100} top={100} innerRadius={10} outerRadius={100} onBlur={spyMethod} />);
      await TestUtils.flushAsyncOperations();

      const mouseUp = new MouseEvent("mouseup");
      sinon.stub(mouseUp, "target").get(() => document.createElement("div"));
      window.dispatchEvent(mouseUp);

      spyMethod.should.have.been.called;
    });

  });

  describe("<RadialButton />", () => {

    const data = [
      { label: "Browse", icon: "icon-browse-2" },
      { label: "Properties", icon: "icon-properties-list" },
      { label: "Status", icon: "icon-status-update" },
      { label: "App 2", icon: "icon-fill" },
      { label: "App 1", icon: "icon-process" },
      { label: "Tools", icon: "icon-tools" },
      { label: "Settings", icon: "icon-settings" },
      { label: "Navigation", icon: "icon-view-navigation" },
    ];

    let radialMenu2: React.ReactElement<any>;

    beforeEach(() => {
      radialMenu2 = <RadialMenu
        opened={true}
        innerRadius={10}
        outerRadius={100}
      >
        {data.map((obj: any, index: any) => {
          return (
            <RadialButton
              key={index}
              icon={obj.icon}
              labelRotate={true}
            >{obj.label}
            </RadialButton>
          );
        })}
      </RadialMenu>;
    });

    it("should render", () => {
      const wrapper = mount(radialMenu2);
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(radialMenu2).should.matchSnapshot();
    });

    it("should call onSelect", () => {
      const spyMethod = sinon.fake();
      const wrapper = mount(<RadialMenu opened={true} innerRadius={10} outerRadius={100}>
        <RadialButton key="0" icon="icon-placeholder" onSelect={spyMethod}> Test </RadialButton>
      </RadialMenu >);
      const button = wrapper.find(RadialButton);
      const gEl = button.find("g");
      gEl.simulate("click");
      spyMethod.should.have.been.called;
      wrapper.unmount();
    });

    it("should call onSelect when button select API called", () => {
      const spyMethod = sinon.fake();
      const wrapper = mount(<RadialMenu opened={true} innerRadius={10} outerRadius={100}>
        <RadialButton key="0" icon="icon-placeholder" onSelect={spyMethod}> Test </RadialButton>
      </RadialMenu >);

      const button = wrapper.find(RadialButton);
      (button.instance() as RadialButton).select();
      spyMethod.should.have.been.called;

      wrapper.unmount();
    });

    it("should call onSelect when menu select API called", () => {
      const spyMethod = sinon.fake();
      const wrapper = mount(<RadialMenu opened={true} innerRadius={10} outerRadius={100} selected={0}>
        <RadialButton key="0" icon="icon-placeholder" onSelect={spyMethod}> Test </RadialButton>
      </RadialMenu >);

      const menu = wrapper.find(RadialMenu);
      (menu.instance() as RadialMenu).select();
      spyMethod.should.have.been.called;

      wrapper.unmount();
    });

    it("should handle hover state", () => {
      const wrapper = mount(<RadialMenu opened={true} innerRadius={10} outerRadius={100}>
        <RadialButton key="0" icon="icon-placeholder" labelRotate={true} > Test </RadialButton>
      </RadialMenu >);
      const button = wrapper.find(RadialButton);
      const gEl = button.find("g");
      gEl.simulate("mouseover");
      expect(button.state("hover")).to.be.true;
      gEl.simulate("mouseout");
      expect(button.state("hover")).to.be.false;
      wrapper.unmount();
    });

  });
});
