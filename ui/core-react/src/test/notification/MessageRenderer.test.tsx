/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageRenderer } from "../../core-react/notification/MessageRenderer";
import { UnderlinedButton } from "../../core-react/button/UnderlinedButton";

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

  describe("Anchor", () => {
    it("allows target _blank if it has a noopener rel", () => {
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.rel = "noopener";
      shallow(<MessageRenderer message={anchor} />).should.matchSnapshot();
    });

    it("allows target _blank if it has a noreferrer rel", () => {
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      shallow(<MessageRenderer message={anchor} />).should.matchSnapshot();
    });

    it("does not allow target _blank if it does have proper relationships", () => {
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      shallow(<MessageRenderer message={anchor} />).should.matchSnapshot();
    });

    it("allows target _blank in child nodes if they proper relationships", () => {
      const outerContainer = document.createElement("div");
      const innerContainer = document.createElement("div");
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      innerContainer.appendChild(anchor);
      outerContainer.appendChild(innerContainer);
      shallow(<MessageRenderer message={outerContainer} />).should.matchSnapshot();
    });

    it("does not allow target _blank in child nodes if they do not have proper relationships", () => {
      const outerContainer = document.createElement("div");
      const innerContainer = document.createElement("div");
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      innerContainer.appendChild(anchor);
      outerContainer.appendChild(innerContainer);
      shallow(<MessageRenderer message={outerContainer} />).should.matchSnapshot();
    });
  });
});
