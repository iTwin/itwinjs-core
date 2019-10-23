/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";

import { AbstractToolItemProps, AbstractCommandItemProps, AbstractGroupItemProps, AbstractConditionalItemProps } from "@bentley/ui-abstract";

import TestUtils from "../TestUtils";
import { ItemDefFactory } from "../../ui-framework/shared/ItemDefFactory";
import { GroupItemDef } from "../../ui-framework/toolbar/GroupItem";
import { ToolItemDef } from "../../ui-framework/shared/ToolItemDef";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";
import { ConditionalItemDef } from "../../ui-framework/shared/ConditionalItemDef";

describe("ItemDefFactory", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("createForGroupItem", () => {

    it("should return ToolItemDef if passed AbstractToolItemProps", () => {
      const toolItemProps: AbstractToolItemProps = {
        toolId: "test",
      };
      const itemDef = ItemDefFactory.createForGroupItem(toolItemProps);
      expect(itemDef).to.be.instanceOf(ToolItemDef);
    });

    it("should return CommandItemDef if passed AbstractCommandItemProps", () => {
      const commandItemProps: AbstractCommandItemProps = {
        commandId: "test",
      };
      const itemDef = ItemDefFactory.createForGroupItem(commandItemProps);
      expect(itemDef).to.be.instanceOf(CommandItemDef);
    });

    it("should return GroupItemDef if passed GroupItemProps", () => {
      const toolItemProps: AbstractToolItemProps = {
        toolId: "test",
      };
      const groupItemProps: AbstractGroupItemProps = {
        groupId: "test",
        items: [toolItemProps],
      };
      const itemDef = ItemDefFactory.createForGroupItem(groupItemProps);
      expect(itemDef).to.be.instanceOf(GroupItemDef);
    });

  });

  describe("createForToolbar", () => {

    it("should return ToolItemDef if passed AbstractToolItemProps", () => {
      const toolItemProps: AbstractToolItemProps = {
        toolId: "test",
      };
      const itemDef = ItemDefFactory.createForToolbar(toolItemProps);
      expect(itemDef).to.be.instanceOf(ToolItemDef);
    });

    it("should return ConditionalItemDef if passed ConditionalItemProps", () => {
      const toolItemProps: AbstractToolItemProps = {
        toolId: "test",
      };
      const conditionalItemProps: AbstractConditionalItemProps = {
        conditionalId: "test",
        items: [toolItemProps],
      };
      const itemDef = ItemDefFactory.createForToolbar(conditionalItemProps);
      expect(itemDef).to.be.instanceOf(ConditionalItemDef);
    });

  });

});
