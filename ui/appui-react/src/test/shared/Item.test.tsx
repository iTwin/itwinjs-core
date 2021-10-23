/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { IModelApp, SelectionTool } from "@itwin/core-frontend";
import { ConditionalStringValue } from "@itwin/appui-abstract";
import { Orientation, Size } from "@itwin/core-react";
import { ActionButtonItemDef, CommandItemDef, ItemProps, ToolItemDef } from "../../appui-react";
import TestUtils from "../TestUtils";
import { Tool1 } from "../tools/Tool1";

describe("Item", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("CommandItemDef with no commandId should get generated id", () => {
    const commandItem = new CommandItemDef({
      iconSpec: "icon-placeholder",
    });
    expect(commandItem.id.substr(0, CommandItemDef.commandIdPrefix.length)).to.eq(CommandItemDef.commandIdPrefix);
    commandItem.execute();  // Just for 'else' coverage
  });

  it("CommandItemDef that isn't visible should not render", () => {
    const commandItem = new CommandItemDef({
      iconSpec: "icon-placeholder",
      isVisible: false,
    });
    expect(commandItem.toolbarReactNode()).to.be.null;
  });

  it("CommandItemDef that is visible should render", () => {
    const commandItem = new CommandItemDef({
      iconSpec: new ConditionalStringValue(() => "icon-placeholder", ["dummy"]),
      label: new ConditionalStringValue(() => "test-command", ["dummy"]),
      isVisible: true,
    });
    expect(commandItem.toolbarReactNode()).to.not.be.null;
  });

  it("CommandItemDef should set and get description", () => {
    const commandItem = new CommandItemDef({
      iconSpec: "icon-placeholder",
      isVisible: true,
    });
    commandItem.setDescription("Hello");
    expect(commandItem.description).to.eq("Hello");
    commandItem.setDescription(() => "World");
    expect(commandItem.description).to.eq("World");
  });

  it("CommandItemDef with getCommandArgs should call it on execute", () => {
    const spyMethod = sinon.spy();
    const commandItem = new CommandItemDef({
      iconSpec: "icon-placeholder",
      execute: () => { },
      getCommandArgs: () => spyMethod(),
    });
    commandItem.execute();
    expect(spyMethod).to.be.calledOnce;
  });

  it("CommandItemDef with onItemExecuted should call it on execute", () => {
    const spyMethod = sinon.spy();
    const commandItem = new CommandItemDef({
      iconSpec: "icon-placeholder",
      execute: () => { },
    }, spyMethod);
    commandItem.execute();
    expect(spyMethod).to.be.calledOnce;
  });

  it("ToolItemDef with no execute has no commandHandler", () => {
    const toolItem = new ToolItemDef({
      toolId: "test",
      iconSpec: "icon-placeholder",
    });
    toolItem.execute();  // Does nothing
  });

  it("ToolItemDef with isPressed and isActive", () => {
    const toolItem = new ToolItemDef({
      toolId: "test",
      iconSpec: "icon-placeholder",
      isPressed: true,
      isActive: true,
    });
    expect(toolItem.isPressed).to.be.true;
    expect(toolItem.isActive).to.be.true;
  });

  it("ToolItemDef helper function", () => {
    const toolItem = ToolItemDef.getItemDefForTool(SelectionTool, "icon-override", ["args1", "args2"]);
    expect(toolItem.iconSpec).to.be.eq("icon-override");
    expect(toolItem.label).not.to.be.undefined;
    expect(toolItem.tooltip).not.to.be.undefined;
    expect(toolItem.execute).not.to.be.undefined;
    expect(toolItem.description).not.to.be.undefined;
  });

  it("ToolItemDef helper function with default args", () => {
    const toolItem = ToolItemDef.getItemDefForTool(Tool1);
    expect(toolItem.iconSpec).to.be.eq(undefined);

    const spyMethod = sinon.spy(IModelApp.tools, "run");
    toolItem.execute();
    spyMethod.calledOnce.should.true;
  });

  class TestItemDef extends ActionButtonItemDef {
    public toolId: string = "";

    constructor(itemProps: ItemProps) {
      super(itemProps);
    }

    public get id(): string {
      return "";
    }
  }

  it("ActionButtonItemDef with no id or index gets random key", () => {
    const testItem = new TestItemDef({
      iconSpec: "icon-placeholder",
    });
    const key = testItem.getKey();
    const numericKey = parseInt(key, 10);
    expect(numericKey).to.be.at.least(1000);
  });

  it("ActionButtonItemDef with no id but index gets index", () => {
    const testItem = new TestItemDef({
      iconSpec: "icon-placeholder",
    });
    const key = testItem.getKey(100);
    const numericKey = parseInt(key, 10);
    expect(numericKey).to.eq(100);
  });

  it("ActionButtonItemDef with no size returns default dimension of 42", () => {
    const testItem = new TestItemDef({
      iconSpec: "icon-placeholder",
    });
    expect(testItem.getDimension(Orientation.Horizontal)).to.eq(ActionButtonItemDef.defaultButtonSize);
  });

  it("ActionButtonItemDef with size returns correct dimension", () => {
    const testItem = new TestItemDef({
      iconSpec: "icon-placeholder",
    });
    testItem.handleSizeKnown(new Size(200, 100));
    expect(testItem.getDimension(Orientation.Horizontal)).to.eq(200);
    expect(testItem.getDimension(Orientation.Vertical)).to.eq(100);
  });

});
