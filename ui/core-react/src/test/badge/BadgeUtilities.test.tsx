/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { BadgeType } from "@itwin/appui-abstract";
import { BadgeUtilities } from "../../core-react/badge/BadgeUtilities";
import { render } from "@testing-library/react";

describe("BadgeUtilities", () => {
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
      const component = BadgeUtilities.getComponentForBadgeType(BadgeType.New) as React.ReactElement;
      const {container} = render(component);
      expect(container.getElementsByClassName("core-new-badge")).to.have.lengthOf(1);
    });

    it("BadgeType.TechnicalPreview should return BetaBadge", () => {
      const component = BadgeUtilities.getComponentForBadgeType(BadgeType.TechnicalPreview) as React.ReactElement;
      const {container} = render(component);

      expect(container.getElementsByClassName("core-badge-betaBadge")).to.have.lengthOf(1);
    });
  });
});
