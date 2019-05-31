/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { ItemMap, ItemList } from "../../ui-framework/shared/ItemMap";
import { CoreTools } from "../../ui-framework/CoreToolDefinitions";

describe("ItemMap & ItemList", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("ItemMap", () => {

    it("constructor should add an item correctly", () => {
      const selectItem = CoreTools.selectElementCommand;
      const itemMap = new ItemMap([selectItem]);
      expect(itemMap.get(CoreTools.selectElementCommand.id)).to.eq(selectItem);
    });

    it("addItem should add an item correctly", () => {
      const itemMap = new ItemMap();
      const selectItem = CoreTools.selectElementCommand;
      itemMap.addItem(selectItem);
      expect(itemMap.get(CoreTools.selectElementCommand.id)).to.eq(selectItem);
    });

  });

  describe("ItemList", () => {

    it("constructor should add an item correctly", () => {
      const selectItem = CoreTools.selectElementCommand;
      const itemList = new ItemList([selectItem]);
      expect(itemList[0]).to.eq(selectItem);
    });

  });

});
