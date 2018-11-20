/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { expect } from "chai";

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
  ConfigurableUiControlType,
} from "../..//index";
import { ScreenViewport, ViewState3d } from "@bentley/imodeljs-frontend";

describe("ViewportContentControl", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();

  class TestViewportContentControl extends ViewportContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;

      this.viewport = viewportMock.object;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  beforeEach(() => {
    viewMock.reset();
    viewMock.setup((view) => view.classFullName).returns(() => "SheetViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
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
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      spyMethod();
    });
    setImmediate(() => {
      spyMethod.calledOnce.should.true;

      if (frontstageProvider.frontstageDef) {
        const contentGroup = frontstageProvider.frontstageDef.contentGroup;
        expect(contentGroup).to.not.be.undefined;

        if (contentGroup) {
          const contentSet = contentGroup.getContentNodes();
          expect(contentSet.length).to.eq(1);

          const contentControl = contentGroup.getControlFromElement(contentSet[0]);
          expect(contentControl).to.not.be.undefined;

          if (contentControl) {
            expect(contentControl.isViewport).to.be.true;
            expect(contentControl.viewport).to.not.be.undefined;
            expect(contentControl.getType()).to.eq(ConfigurableUiControlType.Viewport);

            expect(contentControl.navigationAidControl).to.eq("SheetNavigationAid");

            viewMock.reset();
            viewMock.setup((view) => view.classFullName).returns(() => "DrawingViewDefinition");
            expect(contentControl.navigationAidControl).to.eq("DrawingNavigationAid");

            viewMock.reset();
            viewMock.setup((view) => view.classFullName).returns(() => "SpatialViewDefinition");
            expect(contentControl.navigationAidControl).to.eq("CubeNavigationAid");

            viewMock.reset();
            viewMock.setup((view) => view.classFullName).returns(() => "OrthographicViewDefinition");
            expect(contentControl.navigationAidControl).to.eq("CubeNavigationAid");
          }
        }
      }

    });

  });

});
