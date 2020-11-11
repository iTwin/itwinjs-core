/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MockRender } from "@bentley/imodeljs-frontend";
import { ContentLayoutDef, CoreTools, Frontstage, FrontstageDef, FrontstageManager, FrontstageProps, FrontstageProvider } from "../../ui-framework";
import TestUtils from "../TestUtils";

describe("FrontstageDef", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  class BadLayoutFrontstage extends FrontstageProvider {

    public get frontstage(): React.ReactElement<FrontstageProps> {

      return (
        <Frontstage
          id="BadLayout"
          defaultTool={CoreTools.selectElementCommand}
          defaultLayout="abc"
          contentGroup="def"
        />
      );
    }
  }

  class BadGroupFrontstage extends FrontstageProvider {
    public get frontstage(): React.ReactElement<FrontstageProps> {

      const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
        {
          id: "SingleContent",
          descriptionKey: "App:ContentLayoutDef.SingleContent",
          priority: 100,
        },
      );

      return (
        <Frontstage
          id="BadGroup"
          defaultTool={CoreTools.selectElementCommand}
          defaultLayout={contentLayoutDef}
          contentGroup="def"
        />
      );
    }
  }

  it("setActiveFrontstage should throw Error on invalid content layout", () => {
    const frontstageProvider = new BadLayoutFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    expect(FrontstageManager.setActiveFrontstage("BadLayout")).to.be.rejectedWith(Error); // eslint-disable-line @typescript-eslint/no-floating-promises
  });

  it("setActiveFrontstage should throw Error on invalid content group", () => {
    const frontstageProvider = new BadGroupFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    expect(FrontstageManager.setActiveFrontstage("BadGroup")).to.be.rejectedWith(Error); // eslint-disable-line @typescript-eslint/no-floating-promises
  });

  describe("restoreLayout", () => {
    it("should emit onFrontstageRestoreLayoutEvent", () => {
      const spy = sinon.spy(FrontstageManager.onFrontstageRestoreLayoutEvent, "emit");
      const frontstageDef = new FrontstageDef();
      frontstageDef.restoreLayout();
      spy.calledOnceWithExactly(sinon.match({
        frontstageDef,
      })).should.true;
    });
  });

});
