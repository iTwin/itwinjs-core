/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SheetNavigationAid } from "../../../src/index";
import TestUtils from "../../TestUtils";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";

describe("SheetNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const connection = moq.Mock.ofType<IModelConnection>();
  describe("<SheetNavigationAid />", () => {
    it("should render", () => {
      mount(<SheetNavigationAid iModelConnection={connection.object} />);
    });
    it("renders correctly", () => {
      shallow(<SheetNavigationAid iModelConnection={connection.object} />).should.matchSnapshot();
    });
  });
});
