/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";

import { StatusBarSection } from "@bentley/ui-abstract";
import { StatusBarItemUtilities } from "../../ui-framework";

describe("StatusBarItemUtilities", () => {

  describe("createStatusBarItem", () => {

    it("should support itemProps", () => {
      const newId = "new-id";
      const item = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />, { id: newId });
      expect(item.id).to.eq(newId);
    });

    it("should support isVisible", () => {
      const item1 = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />);
      expect(item1.isVisible).to.be.true;

      const item2 = StatusBarItemUtilities.createStatusBarItem("test1", StatusBarSection.Left, 1, <div />, { isVisible: false });
      expect(item2.isVisible).to.be.false;
    });

  });

});
