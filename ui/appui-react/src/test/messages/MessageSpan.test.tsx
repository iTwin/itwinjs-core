/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { UnderlinedButton } from "@itwin/core-react";
import { MessageDiv, MessageSpan } from "../../appui-react/messages/MessageSpan";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import { selectorMatches } from "../TestUtils";

describe("MessageSpan & MessageDiv", () => {

  ([["span", MessageSpan],
    ["div", MessageDiv]] as [string, typeof MessageSpan][])
    .map(([selector, Component]) => {
      describe(Component.name ?? selector, () => {
        it("with message text", () => {
          render(<Component message="Test" />);

          expect(screen.getByText("Test")).to.satisfy(selectorMatches(selector));
        });

        it("with message HTMLElement", () => {
          const newSpan = document.createElement("span");
          const newContent = document.createTextNode("Test");
          newSpan.appendChild(newContent);
          render(<Component message={newSpan} />);

          expect(screen.getByText("Test")).to.satisfy(selectorMatches(`${selector} span`));
        });

        it("with React node", () => {
          const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
          const reactMessage = { reactNode };
          render(<Component message={reactMessage} />);

          expect(screen.getByText(/For more details/)).to.satisfy(selectorMatches(`${selector} span`));
        });
      });
    });
});
