/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EmptyLocalization } from "@itwin/core-common";
import { MockRender } from "@itwin/core-frontend";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { StandardRotationNavigationAid } from "../../appui-react";
import TestUtils, { childStructure, userEvent } from "../TestUtils";

describe("StandardRotationNavigationAid", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup({ localization: new EmptyLocalization() });
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  describe("<StandardRotationNavigationAid />", () => {

    it("should expand on click and change on item click", async () => {
      render(<StandardRotationNavigationAid />);

      const aid = screen.getByRole("button");
      expect(aid).to.satisfy(childStructure("span.icon-cube-faces-top"));
      await theUserTo.click(aid);

      expect(screen.getAllByText(/rotations/)).to.have.lengthOf(8);

      await theUserTo.click(screen.getByText("rotations.bottom"));
      expect(screen.getByRole("button")).to.satisfy(childStructure("span.icon-cube-faces-bottom"))
        .and.to.not.satisfy(childStructure("span.icon-cube-faces-top"));
    });
  });
});
