/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { renderHook } from "@testing-library/react-hooks";
import { CursorTypeContext, useCursor } from "../../ui-ninezone";

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
