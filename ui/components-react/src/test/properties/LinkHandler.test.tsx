/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import type { LinkElementsInfo } from "@itwin/appui-abstract";
import { fireEvent, render } from "@testing-library/react";
import { LinksRenderer, renderLinks, withLinks } from "../../components-react/properties/LinkHandler";
import TestUtils from "../TestUtils";

describe("LinkHandler", () => {
  const onClickSpy = sinon.spy();
  let links: LinkElementsInfo;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    links = {
      onClick: onClickSpy,
    };
  });

  describe("renderLinks", () => {

    it("calls highlight callback if provided", () => {
      const testString = "Example text";
      const highlightSpy = sinon.spy();

      renderLinks(testString, links, highlightSpy);
      expect(highlightSpy).to.be.calledOnce;
    });

    it("calls highlight callback for matching part", () => {
      links.matcher = () => [{ start: 0, end: 7 }];
      const testString = "Example text";
      let matchedPartHighlighted = false;
      const highlighter = (text: string) => {
        if (text === testString.substr(0, 7))
          matchedPartHighlighted = true;
        return text;
      };

      renderLinks(testString, links, highlighter);

      expect(matchedPartHighlighted).to.be.true;
    });

    it("rendered anchor tag calls appropriate callback on click", () => {
      onClickSpy.resetHistory();

      const anchor = render(<>{renderLinks("Example text", links)}</>);

      expect(onClickSpy).to.have.not.been.called;
      fireEvent.click(anchor.container.getElementsByClassName("core-underlined-button")[0]);
      expect(onClickSpy).to.have.been.calledOnce;
    });

    it("rendered anchor tag container's onClick event will not trigger on anchor click", () => {
      const parentOnClickSpy = sinon.spy();

      const anchor = render(<div onClick={parentOnClickSpy} role="presentation">{renderLinks("Example text", links)}</div>);

      expect(parentOnClickSpy).to.have.not.been.called;
      fireEvent.click(anchor.container.getElementsByClassName("core-underlined-button")[0]);
      expect(parentOnClickSpy).to.have.not.been.called;
    });

    it("returns text split up into anchor tags when text matcher is provided", () => {
      links.matcher = () => [{ start: 0, end: 2 }, { start: 4, end: 6 }, { start: 7, end: 12 }];

      let anchor = render(<>{renderLinks("Example text", links)}</>);

      expect(anchor.container.innerHTML).to.contain(">Ex</");
      expect(anchor.container.innerHTML).to.contain(">am<");
      expect(anchor.container.innerHTML).to.contain(">pl</");
      expect(anchor.container.innerHTML).to.contain(">e<");
      expect(anchor.container.innerHTML).to.contain("> text</");

      links.matcher = () => [{ start: 0, end: 7 }];

      anchor = render(<>{renderLinks("Example text", links)}</>);

      expect(anchor.container.innerHTML).to.contain(">Example</");
      expect(anchor.container.innerHTML).to.contain("> text");
    });

    it("throws when matcher returns overlapping bounds", () => {
      links.matcher = () => [{ start: 3, end: 7 }, { start: 0, end: 6 }];

      expect(() => renderLinks("Example text", links)).to.throw("matcher returned overlapping matches");

      links.matcher = () => [{ start: 3, end: 7 }, { start: 3, end: 7 }];

      expect(() => renderLinks("Example text", links)).to.throw("matcher returned overlapping matches");
    });
  });

  describe("withLinks", () => {
    it("returns unchanged string when record has no links", () => {
      const stringValue = "some pipe...";

      expect(withLinks(stringValue)).to.equal(stringValue);
    });

    it("returns string wrapped in link when record has links", () => {
      const stringValue = "some pipe...";

      expect(typeof withLinks(stringValue, links)).to.equal(typeof {});
    });

    it("calls highlight callback if provided with no links", () => {
      const testString = "Example text";
      const highlightSpy = sinon.spy();

      withLinks(testString, undefined, highlightSpy);
      expect(highlightSpy).to.be.calledOnce;
    });
  });

  describe("<LinksRenderer />", () => {
    it("renders string", () => {
      const value = "some value";
      const { getByText } = render(<LinksRenderer value={value} />);
      getByText(value);
    });
  });
});
