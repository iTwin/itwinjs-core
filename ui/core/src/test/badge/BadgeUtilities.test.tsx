/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";

import { BadgeUtilities } from "../../ui-core/badge/BadgeUtilities";
import { BadgeType } from "@bentley/ui-abstract";

describe("BadgeUtilities", () => {

  const expectNewBadge = (component: React.ReactNode) => {
    if (component) {
      const wrapper = mount(component as React.ReactElement<any>);
      expect(wrapper.find("div.core-badge").length).to.eq(1);
      expect(wrapper.find("div.core-new-badge").length).to.eq(1);
      wrapper.unmount();
    }
  };

  const expectBetaBadge = (component: React.ReactNode) => {
    if (component) {
      const wrapper = mount(component as React.ReactElement<any>);
      expect(wrapper.find("div.core-badge").length).to.eq(1);
      expect(wrapper.find("div.core-new-badge").length).to.eq(0);
      wrapper.unmount();
    }
  };

  describe("getComponentForBadgeType", () => {
    it("undefined should return undefined", () => {
      const component = BadgeUtilities.getComponentForBadgeType(undefined);
      expect(component).to.be.undefined;
    });

    it("BadgeType.None should return undefined", () => {
      const component = BadgeUtilities.getComponentForBadgeType(BadgeType.None);
      expect(component).to.be.undefined;
    });

    it("BadgeType.New should return NewBadge", () => {
      const component = BadgeUtilities.getComponentForBadgeType(BadgeType.New);
      expect(component).to.not.be.undefined;
      expectNewBadge(component);
    });

    it("BadgeType.TechnicalPreview should return BetaBadge", () => {
      const component = BadgeUtilities.getComponentForBadgeType(BadgeType.TechnicalPreview);
      expect(component).to.not.be.undefined;
      expectBetaBadge(component);
    });

  });

});
