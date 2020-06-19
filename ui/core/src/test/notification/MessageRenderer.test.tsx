/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageRenderer } from "../../ui-core/notification/MessageRenderer";
import { UnderlinedButton } from "../../ui-core/button/UnderlinedButton";

describe("MessageRenderer", () => {

  describe("Span", () => {
    it("with message text", () => {
      shallow(<MessageRenderer message="Test" useSpan />).should.matchSnapshot();
    });

    it("with message HTMLElement", () => {
      const newSpan = document.createElement("span");
      const newContent = document.createTextNode("Test");
      newSpan.appendChild(newContent);
      shallow(<MessageRenderer message={newSpan} useSpan />).should.matchSnapshot();
    });

    it("with React node", () => {
      const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
      const reactMessage = { reactNode };
      shallow(<MessageRenderer message={reactMessage} useSpan />).should.matchSnapshot();
    });
  });

  describe("Div", () => {
    it("with message text", () => {
      shallow(<MessageRenderer message="Test" />).should.matchSnapshot();
    });

    it("with message HTMLElement", () => {
      const newSpan = document.createElement("span");
      const newContent = document.createTextNode("Test");
      newSpan.appendChild(newContent);
      shallow(<MessageRenderer message={newSpan} />).should.matchSnapshot();
    });

    it("with React node", () => {
      const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
      const reactMessage = { reactNode };
      shallow(<MessageRenderer message={reactMessage} />).should.matchSnapshot();
    });
  });

});
