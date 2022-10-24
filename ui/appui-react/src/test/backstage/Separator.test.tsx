/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { SeparatorBackstageItem } from "../../appui-react/backstage/Separator";
import { selectorMatches } from "../TestUtils";

describe("Backstage", () => {
  describe("<SeparatorBackstageItem />", () => {
    it("SeparatorBackstageItem renders correctly", () => {
      render(<SeparatorBackstageItem />);

      expect(screen.getByRole("separator")).to.satisfy(selectorMatches(".nz-backstage-separator"));
    });
  });
});
