/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { MessagePresenter } from "./notification/MessagePresenter";
import { getClassName } from "./utils/getClassName";
import { UiError } from "./utils/UiError";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class UiAbstract {
  private static _messagePresenter?: MessagePresenter;

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = `"appui-abstract"${(className ? `.${className}` : "")}`;
    return category;
  }

  /** The MessagePresenter used to display messages. */
  public static get messagePresenter(): MessagePresenter {
    if (!UiAbstract._messagePresenter)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract.MessagePresenter not set");
    return UiAbstract._messagePresenter;
  }
  public static set messagePresenter(mp: MessagePresenter) {
    UiAbstract._messagePresenter = mp;
  }

}
