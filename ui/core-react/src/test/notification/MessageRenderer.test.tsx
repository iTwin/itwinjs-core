/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { MessageRenderer } from "../../core-react/notification/MessageRenderer";
import { UnderlinedButton } from "../../core-react/button/UnderlinedButton";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";

describe("MessageRenderer", () => {

  describe("Span", () => {
    it("with message text", () => {
      render(<MessageRenderer message="Test" useSpan />);

      expect(screen.getByText("Test", {selector: "span"})).to.exist;
    });

    it("with message HTMLElement", () => {
      const newSpan = document.createElement("span");
      const newContent = document.createTextNode("Test");
      newSpan.appendChild(newContent);
      render(<MessageRenderer message={newSpan} useSpan />);

      expect(screen.getByText("Test", {selector: "span > span"})).to.exist;
    });

    it("with React node", () => {
      const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
      const reactMessage = { reactNode };
      render(<MessageRenderer message={reactMessage} useSpan />);

      expect(screen.getByText(/For more details,.*/, {selector: "span > span"})).to.exist;
    });
  });

  describe("Div", () => {
    it("with message text", () => {
      render(<MessageRenderer message="Test" />);

      expect(screen.getByText("Test", {selector: "div"})).to.exist;
    });

    it("with message HTMLElement", () => {
      const newSpan = document.createElement("span");
      const newContent = document.createTextNode("Test");
      newSpan.appendChild(newContent);
      render(<MessageRenderer message={newSpan} />);

      expect(screen.getByText("Test", {selector: "div > span"})).to.exist;
    });

    it("with React node", () => {
      const reactNode = (<span>For more details, <UnderlinedButton>click here</UnderlinedButton>.</span>);
      const reactMessage = { reactNode };
      render(<MessageRenderer message={reactMessage} />);

      expect(screen.getByText(/For more details,.*/, {selector: "div > span"})).to.exist;
    });
  });

  describe("Anchor", () => {
    it("allows target _blank if it has a noopener rel", () => {
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.text = "Test";
      render(<MessageRenderer message={anchor} />);

      expect(screen.getByText("Test", {selector: "a[target=_blank]"})).to.exist;
    });

    it("allows target _blank if it has a noreferrer rel", () => {
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.text = "Test";
      render(<MessageRenderer message={anchor} />);

      expect(screen.getByText("Test", {selector: "a[target=_blank]"})).to.exist;
    });

    it("does not allow target _blank if it does have proper relationships", () => {
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.text = "Test";
      render(<MessageRenderer message={anchor} />);

      expect(screen.getByText("Test", {selector: "a:not([target=_blank])"})).to.exist;
    });

    it("allows target _blank in child nodes if they proper relationships", () => {
      const outerContainer = document.createElement("div");
      const innerContainer = document.createElement("div");
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.text = "Test";
      innerContainer.appendChild(anchor);
      outerContainer.appendChild(innerContainer);
      render(<MessageRenderer message={outerContainer} />);

      expect(screen.getByText("Test", {selector: "div > div > div > a[target=_blank]"})).to.exist;
    });

    it("does not allow target _blank in child nodes if they do not have proper relationships", () => {
      const outerContainer = document.createElement("div");
      const innerContainer = document.createElement("div");
      const anchor = document.createElement("a");
      anchor.href = "https://itwinjs.org";
      anchor.target = "_blank";
      anchor.text = "Test";
      innerContainer.appendChild(anchor);
      outerContainer.appendChild(innerContainer);
      render(<MessageRenderer message={outerContainer} />);

      expect(screen.getByText("Test", { selector: "div > div > div > a:not([target=_blank])"})).to.exist;
    });
  });
});
