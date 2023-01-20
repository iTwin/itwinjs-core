/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { ActiveContentChangedEventArgs, UiFramework, useActiveViewport } from "../../appui-react";
import { renderHook } from "@testing-library/react-hooks";

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

  it("should update active viewport", () => {
    const {result}= renderHook(() => useActiveViewport());

    expect(result.current).to.eq(selectedViewMock.object);

    // update to return a different object so re-render occurs
    (IModelApp as any)._viewManager = {
      selectedView: () => {
        return selectedViewMock2.object;
      },
    };

    UiFramework.content.onActiveContentChangedEvent.emit({} as ActiveContentChangedEventArgs);
    expect(result.current).to.eq(selectedViewMock2.object);
  });
});
