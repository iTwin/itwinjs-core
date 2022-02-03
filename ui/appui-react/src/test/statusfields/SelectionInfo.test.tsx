/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
// import * as sinon from "sinon";
import { Provider } from "react-redux";
import { WidgetState } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import type {
  ConfigurableCreateInfo,
  StatusBarWidgetControlArgs} from "../../appui-react";
import { ConfigurableUiControlType, SelectionInfoField, SessionStateActionId, StatusBar, StatusBarWidgetControl, UiFramework, WidgetDef,
} from "../../appui-react";
import TestUtils from "../TestUtils";

describe("SelectionInfoField", () => {
  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
      if (openWidget) { }
      return (
        <>
          <SelectionInfoField isInFooterMode={isInFooterMode} openWidget={null} onOpenWidget={() => { }} />
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("SelectionInfoField should render with 0", () => {
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    const foundText = component.getAllByText("0");
    expect(foundText).not.to.be.undefined;
  });

  it("SelectionInfoField should render with 1", () => {
    UiFramework.frameworkState!.sessionState.numItemsSelected = 1;
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    const foundText = component.getAllByText("1");
    expect(foundText).not.to.be.undefined;
  });

  it("SelectionInfoField should update after Redux action", () => {
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    UiFramework.dispatchActionToStore(SessionStateActionId.SetNumItemsSelected, 99);
    const foundText = component.getAllByText("99");
    expect(foundText).not.to.be.undefined;
  });
});
