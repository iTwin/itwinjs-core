/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
// import * as sinon from "sinon";
import { Provider } from "react-redux";
import { render, cleanup } from "react-testing-library";

import TestUtils from "../TestUtils";
import {
  StatusBar,
  StatusBarFieldId,
  IStatusBar,
  SelectionInfoField,
  StatusBarWidgetControl,
  WidgetState,
  ConfigurableCreateInfo,
  ConfigurableUiControlType,
  WidgetDef,
  UiFramework,
  AppStateActionId,
} from "../../ui-framework";

describe("SelectionInfoField", () => {

  afterEach(cleanup);

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
      if (statusBar && openWidget) { }
      return (
        <>
          <SelectionInfoField isInFooterMode={isInFooterMode} />
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

  it("SelectionInfoField should render with 0", () => {
    const component = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    expect(component).not.to.be.undefined;
    const foundText = component.getAllByText("0");
    expect(foundText).not.to.be.undefined;
  });

  it("SelectionInfoField should render with 1", () => {
    UiFramework.frameworkState!.appState.numItemsSelected = 1;
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
    UiFramework.dispatchActionToStore(AppStateActionId.SetNumItemsSelected, 99);
    const foundText = component.getAllByText("99");
    expect(foundText).not.to.be.undefined;
  });
});
