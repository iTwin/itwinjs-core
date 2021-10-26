/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PointProps } from "@itwin/appui-abstract";
import { DraggedWidgetManager, DraggedWidgetManagerProps } from "../../../appui-layout-react";

const props: DraggedWidgetManagerProps = {
  id: 6,
  isUnmerge: true,
  lastPosition: {
    x: 10,
    y: 20,
  },
  tabIndex: 5,
};

describe("DraggedWidgetManager", () => {
  describe("setLastPosition", () => {
    it("should update last position", () => {
      const sut = new DraggedWidgetManager();
      const lastPosition: PointProps = { x: 40, y: 140 };
      const newProps = sut.setLastPosition(lastPosition, props);

      newProps.should.not.eq(props);
      newProps.lastPosition.should.eq(lastPosition);
    });

    it("should not modify props", () => {
      const sut = new DraggedWidgetManager();
      const lastPosition: PointProps = { x: 10, y: 20 };
      const newProps = sut.setLastPosition(lastPosition, props);

      newProps.should.eq(props);
    });
  });
});
