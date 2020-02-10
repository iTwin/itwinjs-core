/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { Pane } from "../../ui-ninezone";

describe("Pane", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(<Pane size={20} />);
    container.firstChild!.should.matchSnapshot();
  });
});
