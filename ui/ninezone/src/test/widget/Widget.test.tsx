/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { Widget } from "../../ui-ninezone";
import { PaneContextProvider } from "../Providers";

describe("Widget", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(
      <Widget />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render minimized", () => {
    const { container } = render(<PaneContextProvider
      minimized
    >
      <Widget />
    </PaneContextProvider>);
    container.firstChild!.should.matchSnapshot();
  });

  it("should render horizontal", () => {
    const { container } = render(<PaneContextProvider
      horizontal
    >
      <Widget />
    </PaneContextProvider>);
    container.firstChild!.should.matchSnapshot();
  });

  it("should render tabs", () => {
    const { container } = render(
      <Widget tabs={[
        <div key={0} />,
        <span key={1} />,
      ]} />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should flatten tabs", () => {
    const { container } = render(
      <Widget tabs={
        <>
          <div />
          <span />
        </>
      } />,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
