/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render, cleanup /*, RenderResult, waitForElement*/ } from "react-testing-library";
import * as moq from "typemoq";

import TestUtils from "../TestUtils";
import { ViewportComponent } from "../../ui-components";

import { IModelConnection, ViewState3d, MockRender, SpatialViewState } from "@bentley/imodeljs-frontend";
import { ViewStateProps, IModel, Code, RenderMode } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";

class SavedViewUtil {
  /** Creates an empty view state props */
  private static _createEmptyViewStateProps(_categories: Id64String[] | undefined, _models: Id64String[] | undefined): ViewStateProps {
    // Use dictionary model in all props
    const dictionaryId = IModel.dictionaryId;

    // Category Selector Props
    const categorySelectorProps = {
      categories: _categories ? _categories : [],
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:CategorySelector",
    };
    // Model Selector Props
    const modelSelectorProps = {
      models: _models ? _models : [],
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:ModelSelector",
    };
    // View Definition Props
    const viewDefinitionProps = {
      categorySelectorId: "",
      displayStyleId: "",
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:SpatialViewDefinition",
    };
    // Display Style Props
    const displayStyleProps = {
      code: Code.createEmpty(),
      model: dictionaryId,
      classFullName: "BisCore:DisplayStyle",
      jsonProperties: {
        styles: {
          viewflags: {
            renderMode: RenderMode.SmoothShade,
            noSourceLights: false,
            noCameraLights: false,
            noSolarLight: false,
            noConstruct: true,
          },
        },
      },
    };

    return { displayStyleProps, categorySelectorProps, modelSelectorProps, viewDefinitionProps };
  }

  /** Create an empty view state */
  public static async createEmptyViewState(iModelConnection: IModelConnection, categories: Id64String[] | undefined, models: Id64String[] | undefined): Promise<SpatialViewState> {
    const props = SavedViewUtil._createEmptyViewStateProps(categories, models);
    const viewState = SpatialViewState.createFromProps(props, iModelConnection) as SpatialViewState;
    await viewState.load();
    return viewState;
  }
}

describe.skip("ViewportComponent", () => {

  before(async () => {
    TestUtils.initializeUiComponents(); // tslint:disable-line:no-floating-promises
    MockRender.App.startup();
  });

  after(async () => {
    MockRender.App.shutdown();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  let viewState: ViewState3d;

  beforeEach(async () => {
    imodelMock.reset();

    const viewsMock = moq.Mock.ofInstance<IModelConnection.Views>(new IModelConnection.Views(imodelMock.object));
    viewsMock.setup(async (views) => views.load(moq.It.isAny())).returns(async () => moq.Mock.ofType<ViewState3d>().object);
    imodelMock.setup((imodel) => imodel.views).returns(() => viewsMock.object);

    const modelsMock = moq.Mock.ofType<IModelConnection.Models>();
    modelsMock.setup(async (models) => models.load(moq.It.isAny())).returns(async () => moq.Mock.ofType<void>().object);
    imodelMock.setup((imodel) => imodel.models).returns(() => modelsMock.object);

    viewState = await SavedViewUtil.createEmptyViewState(imodelMock.object, undefined, undefined);
  });

  afterEach(cleanup);

  it("should render", () => {
    render(<ViewportComponent imodel={imodelMock.object} viewState={viewState} />);
  });

});
