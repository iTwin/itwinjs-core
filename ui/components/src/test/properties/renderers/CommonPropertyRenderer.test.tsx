/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import React from "react";
import { PropertyRecord } from "@bentley/ui-abstract";
import { Orientation } from "@bentley/ui-core";
import { render } from "@testing-library/react";
import { CommonPropertyRenderer } from "../../../ui-components/properties/renderers/CommonPropertyRenderer";

describe("CommonPropertyRenderer", () => {
  describe("createNewDisplayValue", () => {
    it("should create a value which is highlighted if highlighProps are provided and searchText matches part of propertyRecord", () => {
      const propertyRecord = PropertyRecord.fromString("asdtestasd");
      const highlightProps = {
        searchText: "test",
      };
      const displayValue = CommonPropertyRenderer.createNewDisplayValue(Orientation.Vertical, propertyRecord, 10, undefined, undefined, undefined, undefined, highlightProps);
      const { container } = render(<div>{displayValue}</div>);
      const element = container.querySelector("mark");
      expect(element?.textContent).to.equal("test");
    });

    it("should create a value which is not highlighted if highlighProps are provided but searchText does not match any part of propertyRecord", () => {
      const propertyRecord = PropertyRecord.fromString("asdtestasd");
      const highlightProps = {
        searchText: "gav",
      };
      const displayValue = CommonPropertyRenderer.createNewDisplayValue(Orientation.Vertical, propertyRecord, 10, undefined, undefined, undefined, undefined, highlightProps);
      const { container } = render(<div>{displayValue}</div>);
      const element = container.querySelector("mark");
      expect(element?.textContent).to.be.undefined;
    });

    it("should create a value which is not highlighted if highlighProps are not provided", () => {
      const propertyRecord = PropertyRecord.fromString("asdtestasd");

      const displayValue = CommonPropertyRenderer.createNewDisplayValue(Orientation.Vertical, propertyRecord, 10, undefined);
      const { container } = render(<div>{displayValue}</div>);
      const element = container.querySelector("mark");
      expect(element?.textContent).to.be.undefined;
    });

    it("should create a value which is actively highlighted if highlighProps are provided, searchText matches part of propertyRecord and property name matches highlightProps activeMatch propertyName", () => {
      const propertyRecord = PropertyRecord.fromString("asdtestasd");
      propertyRecord.property.name = "testName";
      const highlightProps = {
        searchText: "test",
        activeMatch: {
          propertyName: "testName",
          matchIndex: 1,
          matchCounts: {
            label: 1,
            value: 1,
          },
        },
      };
      const displayValue = CommonPropertyRenderer.createNewDisplayValue(Orientation.Vertical, propertyRecord, 10, undefined, undefined, undefined, undefined, highlightProps);
      const { container } = render(<div>{displayValue}</div>);
      const element = container.querySelector("mark");
      expect(element?.textContent).to.equal("test");
      expect(element?.classList.contains("components-activehighlight")).to.be.true;
    });

    it("should not create a value which is actively highlighted if highlighProps are provided, searchText matches part of propertyRecord but property name does not match highlightProps activeMatch propertyName", () => {
      const propertyRecord = PropertyRecord.fromString("asdtestasd");
      propertyRecord.property.name = "testName2";
      const highlightProps = {
        searchText: "test",
        activeMatch: {
          propertyName: "testName",
          matchIndex: 1,
          matchCounts: {
            label: 1,
            value: 1,
          },
        },
      };
      const displayValue = CommonPropertyRenderer.createNewDisplayValue(Orientation.Vertical, propertyRecord, 10, undefined, undefined, undefined, undefined, highlightProps);
      const { container } = render(<div>{displayValue}</div>);
      const element = container.querySelector("mark");
      expect(element?.textContent).to.equal("test");
      expect(element?.classList.contains("components-activehighlight")).to.be.false;
    });

    it("should not create a value which is actively highlighted if highlighProps are provided, searchText matches part of propertyRecord property name matches highlightProps activeMatch propertyName but matchIndex is in the label scope", () => {
      const propertyRecord = PropertyRecord.fromString("asdtestasd");
      propertyRecord.property.name = "testName";
      const highlightProps = {
        searchText: "test",
        activeMatch: {
          propertyName: "testName",
          matchIndex: 1,
          matchCounts: {
            label: 2,
            value: 1,
          },
        },
      };
      const displayValue = CommonPropertyRenderer.createNewDisplayValue(Orientation.Vertical, propertyRecord, 10, undefined, undefined, undefined, undefined, highlightProps);
      const { container } = render(<div>{displayValue}</div>);
      const element = container.querySelector("mark");
      expect(element?.textContent).to.equal("test");
      expect(element?.classList.contains("components-activehighlight")).to.be.false;
    });
  });

  describe("getLabelOffset", () => {
    const maxIndent = 17;
    const minIndent = 6;

    function setupStaticIndentationTests(orientation: Orientation) {
      describe("Static indentation", () => {
        it("returns 0 when indentation is undefined or 0", () => {
          expect(CommonPropertyRenderer.getLabelOffset(undefined, orientation)).to.be.eq(0);
          expect(CommonPropertyRenderer.getLabelOffset(0, orientation)).to.be.eq(0);
        });

        it("returns maxIndent when indentation is 1", () => {
          expect(CommonPropertyRenderer.getLabelOffset(1, orientation)).to.be.equal(maxIndent);
        });

        it("returns maxIndent * 2 when indentation is 2", () => {
          expect(CommonPropertyRenderer.getLabelOffset(2, orientation)).to.be.equal(maxIndent * 2);
        });
      });
    }

    describe("Vertical orientation", () => {
      const orientation = Orientation.Vertical;

      setupStaticIndentationTests(orientation);

      it("should not shrink indentation in Vertical mode", () => {
        expect(CommonPropertyRenderer.getLabelOffset(1, orientation, 100, 0.2, 20)).to.be.equal(maxIndent);
      });
    });

    describe("Horizontal orientation", () => {
      const orientation = Orientation.Horizontal;

      setupStaticIndentationTests(orientation);

      describe("Shrinking indentation", () => {
        it("returns 0 when indentation is undefined or 0", () => {
          expect(CommonPropertyRenderer.getLabelOffset(undefined, orientation, 100, 0.2, 20)).to.be.eq(0);
          expect(CommonPropertyRenderer.getLabelOffset(0, orientation, 100, 0.1, 20)).to.be.eq(0);
        });

        it("returns maxIndent when indentation is 1 and current label size is bigger than shrink threshold", () => {
          expect(CommonPropertyRenderer.getLabelOffset(1, orientation, 100, 0.4, 20)).to.be.equal(maxIndent);
        });

        it("returns minIndent when indentation is 1 and current label size is same as minimum label size", () => {
          expect(CommonPropertyRenderer.getLabelOffset(1, orientation, 100, 0.2, 20)).to.be.equal(minIndent);
        });

        it("returns intermediate value between min and max when indentation is 1 and current label size is between threshold and minimum shrink", () => {
          expect(CommonPropertyRenderer.getLabelOffset(1, orientation, 100, 0.3, 20)).to.be.equal(10);
        });

        it("returns maxIndent * 4 when indentation is 4 and current label size is larger than shrink threshold", () => {
          expect(CommonPropertyRenderer.getLabelOffset(4, orientation, 100, 0.9, 20)).to.be.equal(maxIndent * 4);
        });

        it("returns minIndent * 4 when indentation is 4 and current label size is same as minimum label size", () => {
          expect(CommonPropertyRenderer.getLabelOffset(4, orientation, 100, 0.2, 20)).to.be.equal(minIndent * 4);
        });

        it("returns (maxIndent * 3) + intermediate when indentation is 4 and current label size is between indentation 4 min shrink and threshold", () => {
          const intermediateSize = 9;
          const minimumLabelSize = 20;
          const width = 100;
          const currentLabelSizeRatio = (minimumLabelSize + (maxIndent * 3) + intermediateSize) / width;

          expect(CommonPropertyRenderer.getLabelOffset(4, orientation, width, currentLabelSizeRatio, minimumLabelSize)).to.be.equal((maxIndent * 3) + intermediateSize);
        });

        it("returns (maxIndent) + intermediate + (minIndent * 2) when when indentation is 4 and current label size is between indentation 2 threshold and minimum shrink", () => {
          const intermediateSize = 13;
          const minimumLabelSize = 20;
          const width = 100;
          const currentLabelSizeRatio = (minimumLabelSize + maxIndent + intermediateSize) / width;

          expect(CommonPropertyRenderer.getLabelOffset(4, orientation, width, currentLabelSizeRatio, minimumLabelSize)).to.be.equal(maxIndent + intermediateSize + (minIndent * 2));
        });
      });
    });
  });
});
