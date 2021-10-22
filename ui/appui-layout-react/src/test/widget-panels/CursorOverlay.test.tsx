/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { renderHook } from "@testing-library/react-hooks";
import { CursorTypeContext, useCursor } from "../../appui-layout-react";

describe("useCursor", () => {
  const wrapper = (props: {}) => <CursorTypeContext.Provider value="grabbing" {...props} />;

  it("should add class name to body", () => {
    renderHook(() => useCursor(), { wrapper });
    document.body.classList.contains("nz-grabbing").should.true;
  });

  it("should remove class name to body", () => {
    const { unmount } = renderHook(() => useCursor(), { wrapper });
    unmount();
    document.body.classList.contains("nz-grabbing").should.false;
  });
});
