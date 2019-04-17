/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";
import { ToolItemDef } from "../../ui-framework/shared/ToolItemDef";

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

});
