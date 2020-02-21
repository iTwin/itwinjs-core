/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";
import { render, cleanup } from "@testing-library/react";

import {
  WidgetState,
} from "@bentley/ui-abstract";

import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  ToolWidgetDef,
  ToolButton,
  GroupButton,
  ToolWidget,
  CommandItemDef,
  ActionItemButton,
  CoreTools,
  ItemList,
  FrontstageManager,
  GroupItemDef,
  ToolbarDragInteractionContext,
} from "../../ui-framework";
import { Toolbar, Direction } from "@bentley/ui-ninezone";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";

const testCallback = sinon.stub();

const backstageToggleCommand =
  new CommandItemDef({
    commandId: "SampleApp.BackstageToggle",
    iconSpec: "icon-home",
    execute: testCallback,
  });

describe("ToolWidget", () => {

  describe("Not Plugin-compatible", () => {
    let horizontalToolbar: React.ReactNode;
    let verticalToolbar: React.ReactNode;

    before(async () => {
      await TestUtils.initializeUiFramework();
      NoRenderApp.startup();

      // Set in the before() after UiFramework.i18n is initialized
      horizontalToolbar =
        <Toolbar
          expandsTo={Direction.Bottom}
          items={
            <>
              <ActionItemButton actionItem={CoreTools.selectElementCommand} />
              <ToolButton toolId="tool1a" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
              <ToolButton toolId="tool2a" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
              <GroupButton
                iconSpec="icon-placeholder"
                items={[tool1, tool2]}
                direction={Direction.Bottom}
                itemsInColumn={7}
              />
            </>
          }
        />;

      verticalToolbar =
        <Toolbar
          expandsTo={Direction.Right}
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
      IModelApp.shutdown();
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
      horizontalDirection: Direction.Top,
      verticalDirection: Direction.Left,
    };

    it("ToolWidgetDef from WidgetProps", () => {

      const widgetDef = new ToolWidgetDef(widgetProps); // tslint:disable-line:deprecation
      expect(widgetDef).to.be.instanceof(ToolWidgetDef); // tslint:disable-line:deprecation

      const toolWidgetDef = widgetDef as ToolWidgetDef; // tslint:disable-line:deprecation
      backstageToggleCommand.execute();
      expect(testCallback.calledOnce).to.be.true;

      const reactElement = toolWidgetDef.reactElement;
      expect(reactElement).to.not.be.undefined;

      const reactNode = toolWidgetDef.renderCornerItem();
      expect(reactNode).to.not.be.undefined;
    });

    it("ToolWidget should render", () => {
      const wrapper = mount(
        <ToolWidget // tslint:disable-line:deprecation
          appButton={backstageToggleCommand}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
      wrapper.unmount();
    });

    it("ToolWidget should render correctly", () => {
      shallow(
        <ToolWidget // tslint:disable-line:deprecation
          id="toolWidget"
          appButton={backstageToggleCommand}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      ).should.matchSnapshot();
    });

    it("ToolWidget should support update", () => {
      const wrapper = mount(
        <ToolWidget // tslint:disable-line:deprecation
          button={<button />}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
      expect(wrapper.find(ToolButton).length).to.eq(6);

      wrapper.setProps({ verticalToolbar: undefined });
      wrapper.update();
      expect(wrapper.find(ToolButton).length).to.eq(2);

      wrapper.unmount();
    });

    it("ToolWidget should tool activated", () => {
      const wrapper = mount(
        <ToolWidget // tslint:disable-line:deprecation
          button={<button />}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );

      FrontstageManager.onToolActivatedEvent.emit({ toolId: "tool1" });
      wrapper.update();

      wrapper.unmount();
    });
  });

  describe("Test Plugin items", () => {

    before(async () => {
      await TestUtils.initializeUiFramework();
      NoRenderApp.startup();
    });

    after(() => {
      TestUtils.terminateUiFramework();
      IModelApp.shutdown();
    });

    afterEach(cleanup);

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
              <ToolWidget // tslint:disable-line:deprecation
                appButton={backstageToggleCommand}
                horizontalItems={hItemList}
                verticalItems={vItemList}
              />
            </ToolbarDragInteractionContext.Provider>
          </div>
        </div>,
      );

      expect(component).not.to.be.null;
      // tslint:disable-next-line: no-console
    });
  });
});
