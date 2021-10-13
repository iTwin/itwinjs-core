/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ViewToolWidgetComposer } from "../../appui-react/widgets/ViewToolWidgetComposer";

describe("ViewToolWidgetComposer", () => {

  it("ViewToolWidgetComposer should render correctly", () => {
    shallow(<ViewToolWidgetComposer />).should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
  });

  it("ViewToolWidgetComposer with no navigation aid should render correctly", () => {
    shallow(<ViewToolWidgetComposer hideNavigationAid />).should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
  });
});
