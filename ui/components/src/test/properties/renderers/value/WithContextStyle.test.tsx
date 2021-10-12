/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { withContextStyle } from "../../../../components-react/properties/renderers/value/WithContextStyle";

describe("withContextStyle", () => {

  it("returns given node when context is not provided", () => {
    const reactNode: React.ReactNode = <>test</>;
    const result = withContextStyle(reactNode, undefined);
    expect(result).to.eq(reactNode);
  });

  it("returns given node when context.style is not set", () => {
    const reactNode: React.ReactNode = <>test</>;
    const result = withContextStyle(reactNode, { style: undefined });
    expect(result).to.eq(reactNode);
  });

  it("returns given node when context.style is not set", () => {
    const reactNode: React.ReactNode = <>test</>;
    const style: React.CSSProperties = {
      fontSize: 123,
    };
    const result = withContextStyle(reactNode, { style });
    expect(result).to.not.eq(reactNode);

    const resultMount = mount(<div>{result}</div>);
    expect(resultMount.children.length).to.eq(1);
    expect(resultMount.childAt(0).type()).to.eq("span");
    expect(resultMount.childAt(0).prop("style")).to.deep.eq(style);
    expect(resultMount.childAt(0).text()).to.eq("test");
  });

});
