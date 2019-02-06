/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { Rectangle } from "../../../utilities/Rectangle";
import { SizeProps } from "../../../utilities/Size";

/** @hidden */
export class Root {
  public static readonly FOOTER_HEIGHT = 48;
  private _isInFooterMode: boolean;
  private _bounds: Rectangle;

  public constructor(size: SizeProps, isInFooterMode: boolean) {
    this._bounds = Rectangle.createFromSize(size);
    this._isInFooterMode = isInFooterMode;
  }

  public get isInFooterMode() {
    return this._isInFooterMode;
  }

  public set isInFooterMode(isInFooterMode: boolean) {
    this._isInFooterMode = isInFooterMode;
  }

  public set size(size: SizeProps) {
    this._bounds = Rectangle.createFromSize(size);
  }

  public get bounds() {
    return this._bounds;
  }
}
