/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";
import { ToolItemDef } from "../../ui-framework/shared/ToolItemDef";
import { ActionButtonItemDef } from "../../ui-framework/shared/ActionButtonItemDef";
import { ItemProps } from "../../ui-framework/shared/ItemProps";
import { Orientation } from "@bentley/ui-core";
import { Size } from "@bentley/ui-ninezone";

describe("Item", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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
      iconSpec: "icon-placeholder",
      isVisible: true,
    });
    expect(commandItem.toolbarReactNode()).to.not.be.null;
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
    expect(numericKey).to.be.greaterThan(1000);
  });

  it("ActionButtonItemDef with no id but index gets index", () => {
    const testItem = new TestItemDef({
      iconSpec: "icon-placeholder",
    });
    const key = testItem.getKey(100);
    const numericKey = parseInt(key, 10);
    expect(numericKey).to.eq(100);
  });

  it("ActionButtonItemDef with no size returns dimension of 0", () => {
    const testItem = new TestItemDef({
      iconSpec: "icon-placeholder",
    });
    expect(testItem.getDimension(Orientation.Horizontal)).to.eq(0);
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
