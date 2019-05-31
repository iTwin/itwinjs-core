/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";

import { flattenChildren } from "../../ui-core/utils/flattenChildren";

describe("flattenChildren", () => {

  const _checkFlattened = (flattened: React.ReactNode) => {
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
    _checkFlattened(flattened);
  });

  it("should return a lone element", () => {
    const element = <div />;
    const flattened = flattenChildren(element);
    _checkFlattened(flattened);
  });

});
