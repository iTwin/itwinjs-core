/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { HorizontalAnchor, WidgetContent } from "../../../ui-ninezone";

describe("<WidgetContent />", () => {
  it("should render", () => {
    mount(<WidgetContent anchor={HorizontalAnchor.Right} />);
  });

  it("renders correctly", () => {
    shallow(<WidgetContent anchor={HorizontalAnchor.Right} />).should.matchSnapshot();
  });
});
