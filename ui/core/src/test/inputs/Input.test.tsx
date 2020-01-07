/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { expect } from "chai";

import { Input } from "../../ui-core";

describe("<Input />", () => {
  it("renders", () => {
    const input = render(<Input />);

    expect(input.container.querySelector("input[type='text']")).not.to.be.null;
  });

  it("focus into input with setFocus prop", () => {
    const component = render(<Input setFocus={true} />);
    const input = component.container.querySelector("input[type='text']");

    const element = document.activeElement as HTMLElement;
    expect(element && element === input).to.be.true;
  });

});
