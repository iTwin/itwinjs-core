/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { ActiveContentChangedEventArgs, ContentViewManager, useActiveViewport } from "../../appui-react";
import { mount } from "../TestUtils";

// eslint-disable-next-line @typescript-eslint/naming-convention
const ActiveViewport = (props: { children?: () => React.ReactNode }) => {
  const activeViewport = useActiveViewport();
  return (
    <>
      {props.children && activeViewport && props.children()}
    </>
  );
};

describe("useActiveViewport", () => {
  // const viewManagerMock = moq.Mock.ofType<ViewManager>();
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  const selectedViewMock2 = moq.Mock.ofType<ScreenViewport>();

  beforeEach(() => {
    selectedViewMock.reset();
    selectedViewMock2.reset();

    // hacks to avoid instantiating the whole core..
    (IModelApp as any)._viewManager = {
      selectedView: () => {
        return selectedViewMock.object;
      },
    };
  });

  afterEach(() => {
    (IModelApp as any)._viewManager = undefined;
  });

  it("should add onSelectedViewportChanged listener", () => {
    const spy = sinon.spy(ContentViewManager.onActiveContentChangedEvent, "addListener");
    mount(<ActiveViewport />);

    expect(spy.calledOnce).to.be.true;
  });

  it("should remove onSelectedViewportChanged listener", () => {
    const spy = sinon.spy(ContentViewManager.onActiveContentChangedEvent, "removeListener");
    const sut = mount(<ActiveViewport />);
    sut.unmount();
    expect(spy.calledOnce).to.be.true;
  });

  it("should add event listeners once", () => {
    const spy = sinon.spy(ContentViewManager.onActiveContentChangedEvent, "addListener");
    const sut = mount(<ActiveViewport />);
    sut.setProps({});
    expect(spy.calledOnce).to.be.true;
  });

  it("should update active viewport", () => {
    let renderedCount = 0;
    const childFunc = () => {
      renderedCount = renderedCount + 1;
      return renderedCount;
    };

    mount(<ActiveViewport children={childFunc} />); // eslint-disable-line react/no-children-prop
    expect(renderedCount).to.be.eql(1);

    // update to return a different object so re-render occurs
    (IModelApp as any)._viewManager = {
      selectedView: () => {
        return selectedViewMock2.object;
      },
    };

    ContentViewManager.onActiveContentChangedEvent.emit({} as ActiveContentChangedEventArgs);
    expect(renderedCount).to.be.eql(2);
  });
});
