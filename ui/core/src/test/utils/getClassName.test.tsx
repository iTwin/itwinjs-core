/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import enzyme from "enzyme"; const { mount } = enzyme;
import * as React from "react";
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
