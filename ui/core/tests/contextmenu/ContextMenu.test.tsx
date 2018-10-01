/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ContextMenu, GlobalContextMenu, ContextMenuItem, ContextSubMenu, ContextMenuDivider } from "../../src/index";

describe("ContextMenu", () => {
  describe("<ContextMenu />", () => {
    it("should render", () => {
      mount(<ContextMenu opened={true} />);
    });

    it("renders open correctly", () => {
      shallow(<ContextMenu opened={true} />).should.matchSnapshot();
    });
    it("renders close correctly", () => {
      shallow(<ContextMenu opened={false} />).should.matchSnapshot();
    });
    it("renders with ContextMenuItem correctly", () => {
      shallow(
        <ContextMenu opened={true}>
          <ContextMenuItem> Test </ContextMenuItem>
        </ContextMenu>).should.matchSnapshot();
    });
  });
  describe("<GlobalContextMenu />", () => {
    it("should render", () => {
      mount(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
    });
    it("renders correctly", () => {
      shallow(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />).should.matchSnapshot();
    });
    it("mounts and unmounts correctly", () => {
      const wrapper = mount(<GlobalContextMenu opened={true} identifier="test" x="0" y="0" />);
      wrapper.unmount();
    });
  });
  describe("<ContextMenuDivider />", () => {
    it("should render", () => {
      mount(<ContextMenuDivider />);
    });

    it("renders correctly", () => {
      shallow(<ContextMenuDivider />).should.matchSnapshot();
    });
  });
  describe("<ContextMenuItem />", () => {
    it("should render", () => {
      mount(<ContextMenuItem>Test</ContextMenuItem>);
    });

    it("renders correctly", () => {
      shallow(<ContextMenuItem>Test</ContextMenuItem>).should.matchSnapshot();
    });

    it("focuses correctly", () => {
      const wrapper = mount(<ContextMenuItem>Test</ContextMenuItem>);
      wrapper.find("div").at(0).simulate("focus");
    });

    it("onClick handled correctly", () => {
      const handleClick = sinon.fake();
      const wrapper = mount(<ContextMenuItem onClick={handleClick}>Test</ContextMenuItem>);
      wrapper.find("div").at(0).simulate("click");
      handleClick.should.have.been.calledOnce;
    });
    it("onSelect handled correctly", () => {
      const handleSelect = sinon.fake();
      const wrapper = mount(<ContextMenuItem onSelect={handleSelect}>Test</ContextMenuItem>);
      wrapper.find("div").at(0).simulate("click");
      handleSelect.should.have.been.calledOnce;
    });
  });
  describe("<ContextSubMenu />", () => {
    it("should render", () => {
      mount(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test">
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>);
    });

    it("renders correctly", () => {
      shallow(
        <ContextMenu opened={true}>
          <ContextSubMenu label="test">
            <ContextMenuItem> Test </ContextMenuItem>
          </ContextSubMenu>
        </ContextMenu>).should.matchSnapshot();
    });
  });
});
