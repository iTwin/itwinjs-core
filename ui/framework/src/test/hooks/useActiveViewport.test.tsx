/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";
import { IModelApp, NoRenderApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { useActiveViewport } from "../../ui-framework/hooks/useActiveViewport";
import { SinonSpy } from "../TestUtils";

// tslint:disable-next-line: variable-name
const ActiveViewport = (props: { children?: (activeViewport: ReturnType<typeof useActiveViewport>) => React.ReactNode }) => {
  const activeViewport = useActiveViewport();
  return (
    <>
      {props.children && props.children(activeViewport)}
    </>
  );
};

describe("useActiveViewport", () => {
  const sandbox = sinon.createSandbox();

  before(() => {
    (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    NoRenderApp.startup();
  });

  after(() => {
    IModelApp.shutdown();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should add onSelectedViewportChanged listener", () => {
    const spy = sandbox.spy(IModelApp.viewManager.onSelectedViewportChanged, "addListener");
    mount(<ActiveViewport />);

    expect(spy.calledOnce).to.be.true;
  });

  it("should remove onSelectedViewportChanged listener", () => {
    const spy = sandbox.spy(IModelApp.viewManager.onSelectedViewportChanged, "removeListener");
    const sut = mount(<ActiveViewport />);
    sut.unmount();
    expect(spy.calledOnce).to.be.true;
  });

  it("should add event listeners once", () => {
    const spy = sandbox.spy(IModelApp.viewManager.onSelectedViewportChanged, "addListener");
    const sut = mount(<ActiveViewport />);
    sut.setProps({});

    expect(spy.calledOnce).to.be.true;
  });

  it("should update active viewport", () => {
    const spy = sandbox.spy() as SinonSpy<NonNullable<Parameters<typeof ActiveViewport>[0]["children"]>>;
    mount(<ActiveViewport children={spy} />);
    spy.resetHistory();

    const newViewport: ScreenViewport = {} as any;
    IModelApp.viewManager.onSelectedViewportChanged.emit({ current: newViewport });
    expect(spy.calledOnceWithExactly(newViewport)).to.be.true;
  });
});
