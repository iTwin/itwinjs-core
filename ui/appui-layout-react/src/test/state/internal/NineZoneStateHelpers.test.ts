/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import { initSizeProps } from "../../../appui-layout-react/state/internal/NineZoneStateHelpers";

describe("initSizeProps", () => {
  it("should not update", () => {
    const obj = { x: { height: 10, width: 20 }};
    const sut = produce(obj, (draft) => {
      initSizeProps(draft, "x", { height: 10, width: 20});
    });
    sut.should.eq(obj);
  });
});
