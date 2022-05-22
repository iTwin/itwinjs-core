/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import { render } from "@testing-library/react";
import {
  ActionItemButton, AnyWidgetProps, CommandItemDef, CoreTools, FrontstageManager, GroupButton, GroupItemDef, ItemList, ToolbarDragInteractionContext,
  ToolButton, ToolWidget, ToolWidgetDef,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

const testCallback = sinon.stub();

const backstageToggleCommand =
  new CommandItemDef({
    commandId: "SampleApp.BackstageToggle",
    iconSpec: "icon-home",
    execute: testCallback,
  });

describe("ToolWidget", () => {

  describe("Not Extension-compatible", () => {
    let horizontalToolbar: React.ReactNode;
    let verticalToolbar: React.ReactNode;

    before(async () => {
      await TestUtils.initializeUiFramework();
      await NoRenderApp.startup();

      // Set in the before() after UiFramework.i18n is initialized
      horizontalToolbar =
        <Toolbar // eslint-disable-line deprecation/deprecation
          expandsTo={Direction.Bottom} // eslint-disable-line deprecation/deprecation
          items={
            <>
              <ActionItemButton actionItem={CoreTools.selectElementCommand} />
              <ToolButton toolId="tool1a" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
              <ToolButton toolId="tool2a" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
              <GroupButton
                iconSpec="icon-placeholder"
                items={[tool1, tool2]}
                direction={Direction.Bottom} // eslint-disable-line deprecation/deprecation
                itemsInColumn={7}
              />
            </>
          }
        />;

      verticalToolbar =
        <Toolbar // eslint-disable-line deprecation/deprecation
          expandsTo={Direction.Right} // eslint-disable-line deprecation/deprecation
          items={
            <>
              <ToolButton toolId="tool1b" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
              <ToolButton toolId="tool2b" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
              <ToolButton toolId="tool1c" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" isEnabled={false} />
              <ToolButton toolId="tool2c" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" isVisible={false} />
              <GroupButton
                iconSpec="icon-placeholder"
                items={[tool1, tool2]}
              />
            </>
          }
        />;

    });

    after(async () => {
      TestUtils.terminateUiFramework();
      await IModelApp.shutdown();
    });

    const tool1 = new CommandItemDef({
      commandId: "cmd:tool1",
      iconSpec: "icon-placeholder",
    });

    const tool2 = new CommandItemDef({
      commandId: "cmd:tool2",
      iconSpec: "icon-placeholder",
      applicationData: { key: "value" },
    });

    const widgetProps: AnyWidgetProps = {
      classId: "ToolWidget",
      defaultState: WidgetState.Open,
      isFreeform: true,
      iconSpec: "icon-home",
      appButton: backstageToggleCommand,
      horizontalDirection: Direction.Top, // eslint-disable-line deprecation/deprecation
      verticalDirection: Direction.Left, // eslint-disable-line deprecation/deprecation
    };

    it("ToolWidgetDef from WidgetProps", () => {

      const widgetDef = new ToolWidgetDef(widgetProps); // eslint-disable-line deprecation/deprecation
      expect(widgetDef).to.be.instanceof(ToolWidgetDef); // eslint-disable-line deprecation/deprecation

      const toolWidgetDef = widgetDef;
      backstageToggleCommand.execute();
      expect(testCallback.calledOnce).to.be.true;

      const reactNode = toolWidgetDef.reactNode;
      expect(reactNode).to.not.be.undefined;

      const cornerNode = toolWidgetDef.renderCornerItem();
      expect(cornerNode).to.not.be.undefined;
    });

    it("ToolWidget should render", () => {
      mount(
        <ToolWidget // eslint-disable-line deprecation/deprecation
          appButton={backstageToggleCommand}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
    });

    it("ToolWidget should render correctly", () => {
      shallow(
        <ToolWidget // eslint-disable-line deprecation/deprecation
          id="toolWidget"
          appButton={backstageToggleCommand}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      ).should.matchSnapshot();
    });

    it("ToolWidget should support update", () => {
      const wrapper = mount(
        <ToolWidget // eslint-disable-line deprecation/deprecation
          button={<button />}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
      expect(wrapper.find(ToolButton).length).to.eq(6);

      wrapper.setProps({ verticalToolbar: undefined });
      wrapper.update();
      expect(wrapper.find(ToolButton).length).to.eq(2);
    });

    it("ToolWidget should tool activated", () => {
      const wrapper = mount(
        <ToolWidget // eslint-disable-line deprecation/deprecation
          button={<button />}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );

      FrontstageManager.onToolActivatedEvent.emit({ toolId: "tool1" });
      wrapper.update();
    });
  });

  describe("Test Extension items", () => {

    before(async () => {
      await TestUtils.initializeUiFramework();
      await NoRenderApp.startup();
    });

    after(async () => {
      TestUtils.terminateUiFramework();
      await IModelApp.shutdown();
    });

    // NOTE: none of the following attempts to get the ToolWidget to size itself is working.
    const parentDivStyle: React.CSSProperties = {
      position: `relative`,
      left: `0`,
      top: `0`,
      width: `100%`,
      height: `100%`,
      overflow: `hidden`,
    };

    const toolWidgetDivStyle: React.CSSProperties = {
      height: `800px`,
      left: `0px`,
      top: `0px`,
      width: `1000px`,
      position: `absolute`,
    };

    it("Render items to Dom", async () => {
      const group1 = new GroupItemDef({
        groupId: "test:GroupByDef",
        label: "Tool Group (from def)",
        iconSpec: "icon-placeholder",
        items: [CoreTools.walkViewCommand, CoreTools.windowAreaCommand],
        itemsInColumn: 4,
      });

      const testH1Def = new CommandItemDef({
        commandId: "test-h1-tool",
        execute: (): void => { },
        iconSpec: "icon-developer",
        label: "test-h1-tool",
      });

      const testV1Def = new CommandItemDef({
        commandId: "test-v1-tool",
        execute: (): void => { },
        iconSpec: "icon-developer",
        label: "test-v1-tool",
      });

      const hItemList = new ItemList([testH1Def]);
      const vItemList = new ItemList([testV1Def, group1]);

      const component = render(
        <div style={parentDivStyle}>
          <div style={toolWidgetDivStyle} className="nz-zones-zone">
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolWidget // eslint-disable-line deprecation/deprecation
                appButton={backstageToggleCommand}
                horizontalItems={hItemList}
                verticalItems={vItemList}
              />
            </ToolbarDragInteractionContext.Provider>
          </div>
        </div>,
      );

      expect(component).not.to.be.null;
    });
  });
});
