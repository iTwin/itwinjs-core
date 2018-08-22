/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ContentLayout, ContentGroup, ContentLayoutDef } from "../../src/index";
import TestUtils from "../TestUtils";

describe("ContentLayout", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const myContentGroup: ContentGroup = new ContentGroup({
    contents: [{ classId: "IModelViewport" }],
  });

  const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
    id: "SingleContent",
    descriptionKey: "UiFramework:tests.singleContent",
    priority: 100,
  });

  describe("<ContentLayout />", () => {
    it("should render", () => {
      mount(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
    });

    it("renders correctly", () => {
      shallow(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />).should.matchSnapshot();
    });
  });
});
