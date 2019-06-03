/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { FrontstageProvider, Frontstage, FrontstageManager, ContentLayoutDef, FrontstageProps, CoreTools } from "../../ui-framework";
import { MockRender } from "@bentley/imodeljs-frontend";

describe("FrontstageDef", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
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
    expect(FrontstageManager.setActiveFrontstage("BadLayout")).to.be.rejectedWith(Error);
  });

  it("setActiveFrontstage should throw Error on invalid content group", () => {
    const frontstageProvider = new BadGroupFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    expect(FrontstageManager.setActiveFrontstage("BadGroup")).to.be.rejectedWith(Error);
  });

});
