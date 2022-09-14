/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Icon } from "../../core-react/icons/IconComponent";
import { render } from "@testing-library/react";

describe("IconComponent", () => {

  it("Should return null from undefined iconSpec", () => {
    const { container } = render(<Icon />);
    expect(container.firstChild).to.be.null;
  });
  it("should render with ReactNode", () => {
    const { container } = render(<Icon iconSpec={<span>Test</span>} />);
    const span = container.querySelector("span");
    expect(span).not.to.be.null;
  });

  it("should render correctly with icon svg string", () => {
    const { container } = render(<Icon iconSpec="svg:test.svg" />);
    const svgIconClassName = container.querySelector(".core-icons-svgSprite");
    expect(svgIconClassName).not.to.be.null;
  });

  it("should render correctly with icon class string", () => {
    const { container } = render(<Icon iconSpec="icon-developer" />);
    const iconClassName = container.querySelector(".icon-developer");
    expect(iconClassName).not.to.be.null;
  });

  it("should render correctly with no web svg iconSpec", () => {
    const { container } = render(<Icon iconSpec="webSvg:test.svg" />);
    const webComponent = container.querySelector("svg-loader");
    expect(webComponent).not.to.be.null;
    expect(webComponent!.getAttribute("src")).to.be.eq("test.svg");
  });

  it("should render base64 data uri web svg iconSpec", () => {
    // eslint-disable-next-line deprecation/deprecation
    const dataUri = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7,1v6H1v2h6v6h2V9h6V7H9V1H7z"/></svg>`)}`;
    const { container } = render(<Icon iconSpec={`webSvg:${dataUri}`} />);
    const webComponent = container.querySelector("svg-loader");
    expect(webComponent).to.not.be.null;
    expect(webComponent!.getAttribute("src")).to.be.eq(dataUri);
  });

  it("should not render base64 data uri which does not translate to svg", () => {
    // eslint-disable-next-line deprecation/deprecation
    const dataUri = `data:image/svg+xml;base64,${btoa("<div></div>")}`;
    const { container } = render(<Icon iconSpec={`webSvg:${dataUri}`} />);
    const webComponent = container.querySelector("svg-loader");
    expect(webComponent).to.not.be.null;
    expect(webComponent!.getAttribute("src")).to.be.null;
  });
});
