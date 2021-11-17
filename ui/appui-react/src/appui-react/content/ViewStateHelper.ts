/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import { EmphasizeElementsProps, ViewStateProps } from "@itwin/core-common";
import {
  EmphasizeElements, EntityState, IModelConnection, ScreenViewport, ViewState,
} from "@itwin/core-frontend";
import { ViewUtilities } from "../utils/ViewUtilities";

/** SavedViewProps interface for sharing ViewState and EmphasizeElements information.
 * @public
 */
export interface ViewStateHelperProps extends ViewStateProps {
  bisBaseClass: string;
  emphasizeElementsProps?: EmphasizeElementsProps;
}

/** SavedView class. Used to serialize/deserialize a ViewState.
 * @public
 */
export class ViewStateHelper {
  /** Create a ViewState from the SavedView */
  public static async viewStateFromProps(iModelConnection: IModelConnection, savedViewProps: ViewStateHelperProps): Promise<ViewState | undefined> {
    const className = savedViewProps.viewDefinitionProps.classFullName;
    const ctor = await iModelConnection.findClassFor<typeof EntityState>(className, undefined) as typeof ViewState | undefined;

    // istanbul ignore next
    if (undefined === ctor)
      throw new Error(`Invalid ViewState class name of [${className}]`);

    const viewState = ctor.createFromProps(savedViewProps, iModelConnection)!;
    await viewState.load(); // loads models for ModelSelector

    return viewState;
  }

  /** Apply EmphasizeElements from the SavedView */
  public static emphasizeElementsFromProps(vp: ScreenViewport, savedViewProps: ViewStateHelperProps): boolean {
    let changed = false;
    if (savedViewProps.emphasizeElementsProps) {
      const emphasizeElements = new EmphasizeElements();
      changed = emphasizeElements.fromJSON(savedViewProps.emphasizeElementsProps, vp);
    }
    return changed;
  }

  /** Create props for a ViewState */
  public static viewStateToProps(viewState: ViewState): ViewStateHelperProps {
    const savedViewProps = viewState.toProps() as ViewStateHelperProps;
    savedViewProps.bisBaseClass = ViewUtilities.getBisBaseClass(viewState.classFullName);
    return savedViewProps;
  }

  /** Create props for an EmphasizeElements and store in SavedViewProps */
  public static emphasizeElementsToProps(vp: ScreenViewport, savedViewProps: ViewStateHelperProps): void {
    const ee = EmphasizeElements.get(vp);
    const emphasizeElementsProps = ee ? ee.toJSON(vp) : undefined;
    savedViewProps.emphasizeElementsProps = emphasizeElementsProps;
  }

}
