/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";

import {
  ToolButton,
  CommandButton,
  ToolItemDef,
  ToolItemProps,
  ItemList,
  ItemPropsList,
  CommandItemDef,
  GroupItemDef,
} from "../../src/index";
import TestUtils from "../TestUtils";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("ToolButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<ToolButton />", () => {
    it("should render", () => {
      mount(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" />);
    });

    it("renders correctly", () => {
      shallow(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" />).should.matchSnapshot();
    });

    it("should execute a function", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" execute={spyMethod} />);
      wrapper.find(".nz-toolbar-item-item").simulate("click");
      spyMethod.should.have.been.called;
      wrapper.unmount();
    });
  });
});

describe("CommandButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const commandHandler1 = {
    execute: () => {
    },
  };

  describe("<CommandButton />", () => {
    it("should render", () => {
      mount(<CommandButton commandId="command1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" commandHandler={commandHandler1} />);
    });

    it("renders correctly", () => {
      shallow(<CommandButton commandId="command1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" commandHandler={commandHandler1} />).should.matchSnapshot();
    });

    it("should execute a function", () => {
      const spyMethod = sinon.spy();
      commandHandler1.execute = spyMethod;
      const wrapper = mount(<CommandButton commandId="command1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" commandHandler={commandHandler1} />);
      wrapper.find(".nz-toolbar-item-item").simulate("click");
      spyMethod.should.have.been.called;
      wrapper.unmount();
    });

  });

});

describe("ToolItemDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("Defaults", () => {
    const toolItemProps: ToolItemProps = {
      toolId: "ToolTest",
    };
    const toolItemDef = new ToolItemDef(toolItemProps);

    expect(toolItemDef.isVisible).to.be.true;
    expect(toolItemDef.isEnabled).to.be.true;
    expect(toolItemDef.trayId).to.be.undefined;
  });

  it("Optional properties set", () => {
    const toolItemProps: ToolItemProps = {
      toolId: "ToolTest",
      isEnabled: false,
      isVisible: false,
      featureId: "FeatureId",
      itemSyncMsg: "ItemSyncMsg",
      applicationData: "AppData",
    };
    const toolItemDef = new ToolItemDef(toolItemProps);

    expect(toolItemDef.isVisible).to.be.false;
    expect(toolItemDef.isEnabled).to.be.false;
    expect(toolItemDef.featureId).to.eq("FeatureId");
    expect(toolItemDef.itemSyncMsg).to.eq("ItemSyncMsg");
    expect(toolItemDef.applicationData).to.eq("AppData");
  });

});

describe("ItemList & ItemFactory", () => {
  it("ItemList creates ItemDefs correctly", () => {
    const itemsList: ItemPropsList = {
      items: [
        {
          toolId: "tool1",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.tool1",
        },
        {
          groupId: "my-group1",
          labelKey: "SampleApp:buttons.toolGroup",
          iconClass: "icon-placeholder",
          items: ["item1", "item2", "item3", "item4"],
          direction: Direction.Bottom,
          itemsInColumn: 7,
        },
        {
          commandId: "command1",
          commandHandler: { execute: () => { } },
        },
      ],
    };

    const itemList = new ItemList(itemsList);
    expect(itemList.items.length).to.eq(3);
    expect(itemList.items[0]).to.be.instanceof(ToolItemDef);
    expect(itemList.items[1]).to.be.instanceof(GroupItemDef);
    expect(itemList.items[2]).to.be.instanceof(CommandItemDef);
  });

});
