/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import {
  IModelConnection,
  ViewState,
  DrawingViewState,
  SheetViewState,
  SpatialViewState,
  EmphasizeElements,
  EmphasizeElementsProps,
  ScreenViewport,
} from "@bentley/imodeljs-frontend";
import {
  ViewStateProps,
  ViewDefinitionProps,
  CategorySelectorProps,
  ModelSelectorProps,
  DisplayStyleProps,
  SheetProps,
} from "@bentley/imodeljs-common";
import { Id64Array } from "@bentley/bentleyjs-core";

import { ViewUtilities } from "../utils/ViewUtilities";

/** SavedViewProps interface for sharing ViewState and EmphasizeElements information.
 * @beta
 */
export interface SavedViewProps {
  bisBaseClass: string;
  viewDefinitionProps: ViewDefinitionProps;
  categorySelectorProps: CategorySelectorProps;
  modelSelectorProps?: ModelSelectorProps;
  displayStyleProps: DisplayStyleProps;
  sheetProps?: SheetProps;
  sheetAttachments?: Id64Array;
  emphasizeElementsProps?: EmphasizeElementsProps;
}

/** SavedView class. Used to serialize/deserialize a ViewState.
 * @beta
 */
export class SavedView {

  /** Create a ViewState from the SavedView */
  public static async viewStateFromProps(iModelConnection: IModelConnection, savedViewProps: SavedViewProps): Promise<ViewState | undefined> {
    const props: ViewStateProps = {
      viewDefinitionProps: savedViewProps.viewDefinitionProps,
      categorySelectorProps: savedViewProps.categorySelectorProps,
      modelSelectorProps: savedViewProps.modelSelectorProps,
      displayStyleProps: savedViewProps.displayStyleProps,
      sheetProps: savedViewProps.sheetProps,
      sheetAttachments: savedViewProps.sheetAttachments,
    };

    let viewState: ViewState | undefined;

    if (ViewUtilities.isSpatial(savedViewProps.bisBaseClass))
      viewState = SpatialViewState.createFromProps(props, iModelConnection);
    else if (ViewUtilities.isDrawing(savedViewProps.bisBaseClass))
      viewState = DrawingViewState.createFromProps(props, iModelConnection);
    else if (ViewUtilities.isSheet(savedViewProps.bisBaseClass))
      viewState = SheetViewState.createFromProps(props, iModelConnection);

    if (viewState)
      await viewState.load();

    return viewState;
  }

  /** Apply EmphasizeElements from the SavedView */
  public static emphasizeElementsFromProps(vp: ScreenViewport, savedViewProps: SavedViewProps): boolean {
    let changed = false;
    if (savedViewProps.emphasizeElementsProps) {
      const emphasizeElements = new EmphasizeElements();
      changed = emphasizeElements.fromJSON(savedViewProps.emphasizeElementsProps, vp);
    }
    return changed;
  }

  /** Create props for a ViewState */
  public static viewStateToProps(viewState: ViewState): SavedViewProps {
    const savedViewProps: SavedViewProps = {
      bisBaseClass: ViewUtilities.getBisBaseClass(viewState.classFullName),
      viewDefinitionProps: viewState.toJSON(),
      categorySelectorProps: viewState.categorySelector.toJSON(),
      displayStyleProps: viewState.displayStyle.toJSON(),
    };

    if (ViewUtilities.isSpatial(savedViewProps.bisBaseClass)) {
      const spatialViewState = viewState as SpatialViewState;
      savedViewProps.modelSelectorProps = spatialViewState.modelSelector.toJSON();
    }

    if (ViewUtilities.isSheet(savedViewProps.bisBaseClass)) {
      const sheetViewState = viewState as SheetViewState;
      // TODO - Create valid SheetProps from SheetViewState
      savedViewProps.sheetProps = {
        width: sheetViewState.sheetSize.x, height: sheetViewState.sheetSize.y,
        classFullName: "BisCore:Sheet",
        code: { spec: "", scope: "" },
        model: "",
      };
      savedViewProps.sheetAttachments = sheetViewState.attachmentIds;
    }

    return savedViewProps;
  }

  /** Create props for an EmphasizeElements and store in SavedViewProps */
  public static emphasizeElementsToProps(vp: ScreenViewport, savedViewProps: SavedViewProps): void {
    const ee = EmphasizeElements.get(vp);
    const emphasizeElementsProps = ee ? ee.toJSON(vp) : undefined;
    savedViewProps.emphasizeElementsProps = emphasizeElementsProps;
  }

}
