/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { RadialMenu, RadialButton } from "../../src/index";

describe("RadialMenu", () => {

  let radialMenu1: React.ReactElement<any>;

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
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(radialMenu1).should.matchSnapshot();
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
            >{obj.label}
            </RadialButton>
          );
        })}
      </RadialMenu>;
    });

    it("RadialButton should render", () => {
      const wrapper = mount(radialMenu2);
      wrapper.unmount();
    });

    it("RadialButton renders correctly", () => {
      shallow(radialMenu2).should.matchSnapshot();
    });
  });
});
