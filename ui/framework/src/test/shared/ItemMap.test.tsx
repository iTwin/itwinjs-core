/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { ItemMap } from "../../ui-framework/shared/ItemMap";
import { CoreTools } from "../../ui-framework/CoreToolDefinitions";

describe("ItemMap", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("addItem should add an item correctly", () => {
    const itemMap = new ItemMap();
    const selectItem = CoreTools.selectElementCommand;
    itemMap.addItem(selectItem);
    expect(itemMap.get(CoreTools.selectElementCommand.id)).to.eq(selectItem);
  });

});
