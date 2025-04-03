/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { DrawingProps } from "@itwin/core-common";
import { Drawing } from "../../Element";
import { DocumentListModel } from "../../Model";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("Drawing", () => {
  let imodel: SnapshotDb;
  let documentListModelId: string;

  before(() => {
    const iModelPath = IModelTestUtils.prepareOutputFile("Drawing", "Drawing.bim");
    imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "DrawingTest" } });
    documentListModelId = DocumentListModel.insert(imodel, SnapshotDb.rootSubjectId, "DocumentList");
  });

  after(() => {
    imodel.close();
  });
  
  class TestDrawing extends Drawing {
    public constructor(props: DrawingProps) {
      super(props, imodel);
    }
  }

  describe("scaleFactor", () => {
    function makeDrawingProps(scaleFactor: any): DrawingProps {
      const props: DrawingProps = {
        classFullName: Drawing.classFullName,
        model: documentListModelId,
        code: Drawing.createCode(imodel, documentListModelId, Guid.createValue()),
      };

      if (undefined !== scaleFactor) {
        props.scaleFactor = scaleFactor;
      }
      
      return props;
    }

    function makeDrawing(scaleFactor: any): Drawing {
      return new TestDrawing(makeDrawingProps(scaleFactor));
    }

    function expectScaleFactor(scaleFactor: any, expected: number): void {
      const drawing = makeDrawing(scaleFactor);
      expect(drawing.scaleFactor).to.equal(expected);
    }

    it("defaults to 1", () => {
      expectScaleFactor(undefined, 1);
      expectScaleFactor(null, 1);
      expectScaleFactor(0, 1);
      expectScaleFactor(-123, 1);
      expectScaleFactor(false, 1);
      expectScaleFactor(true, 1);
      expectScaleFactor("", 1);
      expectScaleFactor("abcdef", 1);
    });

    it("throws when attempting to set to zero or negative value", () => {
      const drawing = makeDrawing(undefined);
      expect(drawing.scaleFactor).to.equal(1);
      expect(() => drawing.scaleFactor = 0).to.throw("Drawing.scaleFactor must be greater than zero");
      expect(drawing.scaleFactor).to.equal(1);
      expect(() => drawing.scaleFactor = -123).to.throw("Drawing.scaleFactor must be greater than zero");
      expect(drawing.scaleFactor).to.equal(1);
    });

    it("is included in JSON IFF not equal to 1", () => {
      function expectFactor(scaleFactor: any, expected: number | undefined): void {
        const drawing = makeDrawing(scaleFactor);
        expect(drawing.scaleFactor === 1).to.equal(expected === undefined);
        const props = drawing.toJSON();
        expect(props.scaleFactor).to.equal(expected);
      }

      expectFactor(undefined, undefined);
      expectFactor(null, undefined);
      expectFactor(0, undefined);
      expectFactor(1, undefined);
      expectFactor(-123, undefined);
      expectFactor(false, undefined);
      expectFactor(true, undefined);
      expectFactor("", undefined);
      expectFactor("abcdef", undefined);

      expectFactor(2, 2);
      expectFactor(123, 123);
      expectFactor(0.05, 0.05);
    });

    it("is preserved when round-tripped through persistence layer", () => {
      function test(scaleFactor: number | undefined): void {
        const insertProps = makeDrawingProps(scaleFactor);
        expect(insertProps.scaleFactor).to.equal(scaleFactor);
        const elemId = imodel.elements.insertElement(insertProps);
        const readProps = imodel.elements.getElementProps<DrawingProps>(elemId);
        expect(readProps.scaleFactor).to.equal(scaleFactor);
      }

      test(undefined);
      test(1);
      test(2);
      test(123);
      test(0.05);
      test(0);
      test(-123);
    });
  });

  describe("insert", () => {
    function insertDrawing(scaleFactor: number | undefined): Drawing {
      const drawingId = Drawing.insert(imodel, documentListModelId, Guid.createValue(), scaleFactor);
      return imodel.elements.getElement<Drawing>(drawingId);
    }

    it("throws if scaleFactor is not positive", () => {
      expect(() => insertDrawing(0)).to.throw("Drawing.scaleFactor must be greater than zero");
      expect(() => insertDrawing(-123)).to.throw("Drawing.scaleFactor must be greater than zero");
    });

    it("defaults scaleFactor to 1", () => {
      expect(insertDrawing(undefined).scaleFactor).to.equal(1);
    });

    it("preserves scaleFactor", () => {
      expect(insertDrawing(2).scaleFactor).to.equal(2);
      expect(insertDrawing(123).scaleFactor).to.equal(123);
      expect(insertDrawing(0.05).scaleFactor).to.equal(0.05);
    });
  });
});
