/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { getDisplayName } from "../../ui-core";

describe("getDisplayName", () => {
  class DisplayNameComponentDisplayName extends React.Component {
    public static displayName = "CustomDisplayName";
    public render(): React.ReactNode {
      return "displayName test";
    }
  }
  class NameComponentDisplayName extends React.Component {
    public render(): React.ReactNode {
      return "displayName test";
    }
  }
  it("should use displayName if specified", () => {
    expect(getDisplayName(DisplayNameComponentDisplayName)).to.eq("CustomDisplayName");
  });
  it("should use name if no custom displayName is specified", () => {
    expect(getDisplayName(NameComponentDisplayName)).to.eq("NameComponentDisplayName");
  });
  it("should default to Component for components with no defined name", () => {
    expect(getDisplayName(("default" as any) as React.SFC)).to.eq("Component");
  });
});
