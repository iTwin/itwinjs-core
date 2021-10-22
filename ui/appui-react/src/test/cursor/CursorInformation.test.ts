/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { RelativePosition } from "@itwin/appui-abstract";
import { Point } from "@itwin/core-react";
import { CursorDirection, CursorInformation } from "../../appui-react/cursor/CursorInformation";

describe("CursorInformation", () => {

  describe("getRelativePositionFromCursorDirection", () => {
    it("should return correct RelativePosition", () => {
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.Top)).to.eq(RelativePosition.Top);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.Left)).to.eq(RelativePosition.Left);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.Right)).to.eq(RelativePosition.Right);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.Bottom)).to.eq(RelativePosition.Bottom);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.TopLeft)).to.eq(RelativePosition.TopLeft);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.TopRight)).to.eq(RelativePosition.TopRight);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.BottomLeft)).to.eq(RelativePosition.BottomLeft);
      expect(CursorInformation.getRelativePositionFromCursorDirection(CursorDirection.BottomRight)).to.eq(RelativePosition.BottomRight);
    });
  });

  describe("handleMouseMove", () => {

    beforeEach(() => {
      CursorInformation.clearCursorDirections();
    });

    it("should detect Left CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(1, 2));
      CursorInformation.handleMouseMove(new Point(0, 2));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.Left);
    });

    it("should detect TopLeft CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(1, 1));
      CursorInformation.handleMouseMove(new Point(0, 0));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.TopLeft);
    });

    it("should detect Top CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(2, 1));
      CursorInformation.handleMouseMove(new Point(2, 0));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.Top);
    });

    it("should detect TopRight CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(3, 1));
      CursorInformation.handleMouseMove(new Point(4, 0));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.TopRight);
    });

    it("should detect Right CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(3, 2));
      CursorInformation.handleMouseMove(new Point(4, 2));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.Right);
    });

    it("should detect BottomRight CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(3, 3));
      CursorInformation.handleMouseMove(new Point(4, 4));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.BottomRight);
    });

    it("should detect Bottom CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(2, 3));
      CursorInformation.handleMouseMove(new Point(2, 4));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.Bottom);
    });

    it("should detect BottomLeft CursorDirection", () => {
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(1, 3));
      CursorInformation.handleMouseMove(new Point(0, 4));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.BottomLeft);
    });

    it("should detect correct CursorDirection with more than 10 events", () => {
      CursorInformation.handleMouseMove(new Point(4, 4));
      CursorInformation.handleMouseMove(new Point(3, 3));
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(1, 1));
      CursorInformation.handleMouseMove(new Point(0, 0));
      CursorInformation.handleMouseMove(new Point(1, 1));
      CursorInformation.handleMouseMove(new Point(2, 2));
      CursorInformation.handleMouseMove(new Point(3, 3));
      CursorInformation.handleMouseMove(new Point(4, 4));
      CursorInformation.handleMouseMove(new Point(5, 5));
      CursorInformation.handleMouseMove(new Point(6, 6));
      expect(CursorInformation.cursorDirection).to.eq(CursorDirection.BottomRight);
    });

  });

});
