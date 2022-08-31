/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "chai";
import * as React from "react";
import { useTargeted } from "../../../core-react/utils/hooks/useTargeted";

// eslint-disable-next-line @typescript-eslint/naming-convention
const Targeted = () => {
  const ref = React.useRef<HTMLButtonElement>(null);
  const targeted = useTargeted(ref);
  return (
    <button ref={ref} >
      Targeted: {`${targeted}`}
    </button>
  );
};

describe("useTargeted", () => {
  it("should update targeted value", async () => {
    const theUserTo = userEvent.setup();
    render(<Targeted />);
    expect(screen.getByText("Targeted: false")).to.exist;

    await theUserTo.hover(screen.getByRole("button"));
    expect(screen.getByText("Targeted: true")).to.exist;

    await theUserTo.unhover(screen.getByRole("button"));
    expect(screen.getByText("Targeted: false")).to.exist;
  });
});
