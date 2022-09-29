/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { LEVEL_OFFSET } from "../../core-react/tree/Node";
import { TreeNodePlaceholder } from "../../core-react";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";

describe("<Placeholder />", () => {

  it("should set left padding based on level", () => {
    render(<TreeNodePlaceholder level={9} data-testid="test" />);
    const expectedOffset = `${9*LEVEL_OFFSET}px`;

    expect(screen.getByTestId("test").style).to.include({paddingLeft: expectedOffset});
  });

  it("should set width between minWidth and maxWidth", () => {
    let repeats = 100;
    const {rerender} = render(<TreeNodePlaceholder data-testid="ph" level={0} minWidth={10} maxWidth={100} />);
    while (repeats--) {
      const testId = `ph${repeats}`;
      rerender(<TreeNodePlaceholder data-testid={testId} level={0} minWidth={10} maxWidth={100} />);
      const width = (screen.getByTestId(testId).firstElementChild as HTMLElement).style.width;

      expect(Number.parseInt(width, 10)).to.be.gte(10).and.lte(100);
    }
  });

});
