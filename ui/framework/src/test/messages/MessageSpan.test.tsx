/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow } from "enzyme";
import { MessageSpan, MessageDiv } from "../../ui-framework/messages/MessageSpan";
import { UnderlinedButton } from "@bentley/ui-core";

describe("MessageSpan & MessageDiv", () => {

  describe("MessageSpan", () => {
    it("with message text", () => {
      shallow(<MessageSpan message="Test" />).should.matchSnapshot();
    });

    it("with message HTMLElement", () => {
      const newSpan = document.createElement("span");
      const newContent = document.createTextNode("Test");
      newSpan.appendChild(newContent);
      shallow(<MessageSpan message={newSpan} />).should.matchSnapshot();
    });

    it("with React node", () => {
      const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
      const reactMessage = { reactNode };
      shallow(<MessageSpan message={reactMessage} />).should.matchSnapshot();
    });
  });

  describe("MessageDiv", () => {
    it("with message text", () => {
      shallow(<MessageDiv message="Test" />).should.matchSnapshot();
    });

    it("with message HTMLElement", () => {
      const newSpan = document.createElement("span");
      const newContent = document.createTextNode("Test");
      newSpan.appendChild(newContent);
      shallow(<MessageDiv message={newSpan} />).should.matchSnapshot();
    });

    it("with React node", () => {
      const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
      const reactMessage = { reactNode };
      shallow(<MessageDiv message={reactMessage} />).should.matchSnapshot();
    });
  });

});
