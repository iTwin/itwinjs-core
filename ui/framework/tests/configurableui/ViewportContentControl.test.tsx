/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";

import TestUtils from "../TestUtils";
import {
  ViewportContentControl,
  ConfigurableCreateInfo,
  Frontstage,
  FrontstageManager,
  FrontstageProvider,
  ContentGroup,
  FrontstageProps,
  ContentLayoutDef,
} from "../../src/index";

describe("ViewportContentControl", () => {

  class TestViewportContentControl extends ViewportContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;

      this.viewport = undefined;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("ViewportContentControl used in a Frontstage", () => {

    class Frontstage1 extends FrontstageProvider {

      public get frontstage(): React.ReactElement<FrontstageProps> {
        const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
          {
            id: "SingleContent",
            descriptionKey: "App:ContentLayoutDef.SingleContent",
            priority: 100,
          },
        );

        const myContentGroup: ContentGroup = new ContentGroup(
          {
            contents: [
              {
                classId: TestViewportContentControl,
                applicationData: { label: "Content 1a", bgColor: "black" },
              },
            ],
          },
        );

        return (
          <Frontstage
            id="Test1"
            defaultToolId="Select"
            defaultLayout={contentLayoutDef}
            contentGroup={myContentGroup}
          />
        );
      }
    }

    const spyMethod = sinon.spy();
    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => {
      spyMethod();
    });
    setImmediate(() => {
      spyMethod.calledOnce.should.true;
    });

  });

});
