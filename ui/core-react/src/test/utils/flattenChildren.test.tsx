/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { flattenChildren } from "../../core-react/utils/flattenChildren";

describe("flattenChildren", () => {

  const checkFlattened = (flattened: React.ReactNode) => {
    const a = flattened as [1];
    expect(a.length).to.eq(1);
    const o = a[0] as any;
    expect(o.type).to.eq("div");
  };

  it("should flatten a fragment", () => {
    const fragment = (
      <>
        <div />
      </>
    );
    const flattened = flattenChildren(fragment);
    checkFlattened(flattened);
  });

  it("should return a lone element", () => {
    const element = <div />;
    const flattened = flattenChildren(element);
    checkFlattened(flattened);
  });

});
