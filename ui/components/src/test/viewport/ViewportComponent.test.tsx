/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render, cleanup /*, RenderResult, waitForElement*/ } from "react-testing-library";
import * as moq from "typemoq";
import * as faker from "faker";

import { ViewportComponent } from "../../index";

import { IModelConnection, ViewState3d } from "@bentley/imodeljs-frontend";
import { Id64String, Id64 } from "@bentley/bentleyjs-core";

// Most of this setup code is either from presentation/common or presentation/components
const createRandomId = (): Id64String => {
  return Id64.fromLocalAndBriefcaseIds(faker.random.number(), faker.random.number());
};

describe("ViewportComponent", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  let viewDefinitionId: Id64String;

  beforeEach(() => {
    viewDefinitionId = createRandomId();
    const viewsMock = moq.Mock.ofInstance<IModelConnection.Views>(new IModelConnection.Views(imodelMock.object));
    viewsMock.setup(async (views) => views.load(moq.It.isAny())).returns(async () => moq.Mock.ofType<ViewState3d>().object);
    imodelMock.reset();
    imodelMock.setup((imodel) => imodel.views).returns(() => viewsMock.object);
  });

  afterEach(cleanup);

  it("should render", () => {
    render(<ViewportComponent imodel={imodelMock.object} viewDefinitionId={viewDefinitionId} />);
  });

});
