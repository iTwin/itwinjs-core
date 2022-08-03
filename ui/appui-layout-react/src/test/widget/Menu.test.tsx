/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { WidgetMenu } from "../../appui-layout-react";

describe("WidgetMenu ", () => {
  it("should render", async () => {
    const { findByText } = render(
      <WidgetMenu
        open
      >
        <div>A</div>
        <div>B</div>
      </WidgetMenu>,
    );
    await findByText("A");
    await findByText("B");
  });
});
