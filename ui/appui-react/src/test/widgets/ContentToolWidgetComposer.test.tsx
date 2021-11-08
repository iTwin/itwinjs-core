/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { BackstageAppButton } from "../../appui-react";
import { ContentToolWidgetComposer } from "../../appui-react/widgets/ContentToolWidgetComposer";
import TestUtils from "../TestUtils";

describe("ContentToolWidgetComposer", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("ContentToolWidgetComposer should render", () => {
    shallow(<ContentToolWidgetComposer />).should.matchSnapshot();
  });

  it("ContentToolWidgetComposer with backstage button should render", () => {
    const cornerButton = <BackstageAppButton icon={"icon-bentley-systems"} />;
    shallow(<ContentToolWidgetComposer cornerButton={cornerButton} />).should.matchSnapshot();
  });
});

