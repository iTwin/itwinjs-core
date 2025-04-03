/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { RelatedElement, DrawingProps } from "@itwin/core-common";
import { Drawing } from "../../Element";
import { DocumentListModel, DrawingModel } from "../../Model";
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
    function makeProps(scaleFactor: any): DrawingProps {
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
      return new TestDrawing(makeProps(scaleFactor));
    }

    function expectScaleFactor(scaleFactor: any, expected: number): void {
      const drawing = makeDrawing(scaleFactor);
      expect(drawing.scaleFactor).to.equal(expected);
    }

    it("defaults to 1", () => {
      expectScaleFactor(undefined, 1);
      expectScaleFactor(null, 1);
      expectScaleFactor(0, 1);
      expectScaleFactor(false, 1);
      expectScaleFactor(true, 1);
      expectScaleFactor("", 1);
      expectScaleFactor("abcdef", 1);
    });

    it("throws when attempting to set to zero", () => {
      const drawing = makeDrawing(undefined);
      expect(drawing.scaleFactor).to.equal(1);
      expect(() => drawing.scaleFactor = 0).to.throw("Drawing.scaleFactor cannot be zero");
      expect(drawing.scaleFactor).to.equal(1);
    });

    it("is included in JSON IFF not equal to 1", () => {
      
    });

    it("is preserved when round-tripped through persistence layer", () => {
      
    });
  });

  describe("insert", () => {
    it("throws if scaleFactor is zero", () => {
      
    });

    it("defaults scaleFactor to 1", () => {
      
    });

    it("preserves scaleFactor", () => {
      
    });
  });
});
