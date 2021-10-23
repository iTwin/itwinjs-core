/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { ConditionalBooleanValue, StatusBarSection } from "@itwin/appui-abstract";
import { StatusBarItemUtilities } from "../../appui-react";

describe("StatusBarItemUtilities", () => {

  describe("createStatusBarItem", () => {

    it("should support itemProps", () => {
      const newId = "new-id";
      const item = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />, { id: newId });
      expect(item.id).to.eq(newId);
    });

    it("should support isVisible", () => {
      const item1 = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />);
      expect(ConditionalBooleanValue.getValue(item1.isHidden)).to.be.false;
      const item2 = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />, { isHidden: true });
      expect(ConditionalBooleanValue.getValue(item2.isHidden)).to.be.true;
    });

  });

});
