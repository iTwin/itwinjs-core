/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import { getClassName } from "@bentley/ui-abstract";

describe("getClassName", () => {
  class NamedComponent extends React.Component {
    public render(): React.ReactNode {
      expect(getClassName(this)).to.eq("NamedComponent");
      return null;
    }
  }

  it("should be the name of the React component class", () => {
    mount(<NamedComponent />);
  });

});
