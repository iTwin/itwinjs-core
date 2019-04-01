/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import { ConfigurableCreateInfo, ConfigurableUiControl, ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";

/** NavigationAid Activated Event Args interface.
 * @public
 */
export interface NavigationAidActivatedEventArgs {
  navigationAidId: string;
  iModelConnection: IModelConnection;
}

/** NavigationAid Activated Event class.
 * @public
 */
export class NavigationAidActivatedEvent extends UiEvent<NavigationAidActivatedEventArgs> { }

/** The base class for Navigation Aid controls.
 * @public
 */
export class NavigationAidControl extends ConfigurableUiControl {
  private _reactElement: React.ReactNode;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  /** Gets the React element associated with this control */
  public get reactElement(): React.ReactNode { return this._reactElement; }
  /** Sets the React element associated with this control */
  public set reactElement(r: React.ReactNode) { this._reactElement = r; }

  /** Default size is "64px". Override to set a different size. */
  public getSize(): string | undefined { return undefined; }

  /** Get the type of this control. */
  public getType(): ConfigurableUiControlType { return ConfigurableUiControlType.NavigationAid; }
}
