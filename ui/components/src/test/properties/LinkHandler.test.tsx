/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { LinkElementsInfo, PropertyRecord } from "@bentley/ui-abstract";
import { fireEvent, render } from "@testing-library/react";
import { hasLinks, LinksRenderer, renderLinks, withLinks } from "../../ui-components/properties/LinkHandler";
import TestUtils from "../TestUtils";
import { getFullLink } from "../../ui-components/properties/renderers/value/URIPropertyValueRenderer";

describe("LinkHandler", () => {
  let record: PropertyRecord;
  const onClickSpy = sinon.spy();
  let links: LinkElementsInfo;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    record = TestUtils.createPrimitiveStringProperty("label", "Test record");
    links = {
      onClick: onClickSpy,
      matcher: getFullLink,
    };
  });

  describe("hasLinks", () => {
    it("returns true when property record has anchor properties", () => {
      record.links = links;
      expect(hasLinks(record)).to.be.true;
    });

    it("returns false when property record does not have anchor properties", () => {
      expect(hasLinks(record)).to.be.false;
    });
  });

  describe("renderLinks", () => {
    beforeEach(() => {
      record.links = links;
    });

    it("calls highlight callback if provided", () => {
      const testString = "Example text";
      const highlightSpy = sinon.spy();

      renderLinks(testString, record.links!, highlightSpy);
      expect(highlightSpy).to.be.calledOnce;
    });

    it("calls highlight callback for matching part", () => {
      record.links!.matcher = () => [{ start: 0, end: 7 }];
      const testString = "Example text";
      let matchedPartHighlighted = false;
      const highlighter = (text: string) => {
        if (text === testString.substr(0, 7))
          matchedPartHighlighted = true;
        return text;
      };

      renderLinks(testString, record.links!, highlighter);

      expect(matchedPartHighlighted).to.be.true;
    });

    it("rendered anchor tag calls appropriate callback on click", () => {
      onClickSpy.resetHistory();

      const anchor = render(<>{renderLinks("Example text", record.links!)}</>);

      expect(onClickSpy).to.have.not.been.called;
      fireEvent.click(anchor.container.getElementsByClassName("core-underlined-button")[0]);
      expect(onClickSpy).to.have.been.calledOnce;
    });

    it("rendered anchor tag container's onClick event will not trigger on anchor click", () => {
      const parentOnClickSpy = sinon.spy();

      const anchor = render(<div onClick={parentOnClickSpy} role="presentation">{renderLinks("Example text", record.links!)}</div>);

      expect(parentOnClickSpy).to.have.not.been.called;
      fireEvent.click(anchor.container.getElementsByClassName("core-underlined-button")[0]);
      expect(parentOnClickSpy).to.have.not.been.called;
    });

    it("returns text split up into anchor tags when text matcher is provided", () => {
      record.links!.matcher = () => [{ start: 0, end: 2 }, { start: 4, end: 6 }, { start: 7, end: 12 }];

      let anchor = render(<>{renderLinks("Example text", record.links!)}</>);

      expect(anchor.container.innerHTML).to.contain(">Ex</");
      expect(anchor.container.innerHTML).to.contain(">am<");
      expect(anchor.container.innerHTML).to.contain(">pl</");
      expect(anchor.container.innerHTML).to.contain(">e<");
      expect(anchor.container.innerHTML).to.contain("> text</");

      record.links!.matcher = () => [{ start: 0, end: 7 }];

      anchor = render(<>{renderLinks("Example text", record.links!)}</>);

      expect(anchor.container.innerHTML).to.contain(">Example</");
      expect(anchor.container.innerHTML).to.contain("> text");
    });

    it("throws when matcher returns overlapping bounds", () => {
      record.links!.matcher = () => [{ start: 3, end: 7 }, { start: 0, end: 6 }];

      expect(() => renderLinks("Example text", record.links!)).to.throw("matcher returned overlapping matches");

      record.links!.matcher = () => [{ start: 3, end: 7 }, { start: 3, end: 7 }];

      expect(() => renderLinks("Example text", record.links!)).to.throw("matcher returned overlapping matches");
    });
  });

  describe("withLinks", () => {
    it("returns unchanged string when record has no links", () => {
      const stringValue = "some pipe...";

      expect(withLinks(record.links!, stringValue)).to.equal(stringValue);
    });

    it("returns string wrapped in link when record has links", () => {
      const stringValue = "some pipe...";
      record.links = links;

      expect(typeof withLinks(record.links, stringValue)).to.equal(typeof {});
    });
  });

  describe("<LinksRenderer />", () => {

    it("renders string", () => {
      const value = "some value";
      const propertyRecord = TestUtils.createPrimitiveStringProperty("link_property", value);
      const { getByText } = render(<LinksRenderer value={value} links={propertyRecord.links!} />);
      getByText(value);
    });

  });
});
