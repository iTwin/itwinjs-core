/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CoreTools } from "../../appui-react/tools/CoreToolDefinitions";
import { ItemList, ItemMap } from "../../appui-react/shared/ItemMap";
import TestUtils from "../TestUtils";

describe("ItemMap & ItemList", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
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
