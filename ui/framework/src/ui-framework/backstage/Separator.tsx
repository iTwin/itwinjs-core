/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { BackstageSeparator as NZ_BackstageSeparator } from "@bentley/ui-ninezone";
import { BackstageItemProps } from "./BackstageItem";

/** Separator Backstage item.
 * @public
 */
export class SeparatorBackstageItem extends React.PureComponent<BackstageItemProps> {
  private static _sSeparatorBackstageItemKey: number;
  private _key: number;

  constructor(separatorBackstageItemDef: BackstageItemProps) {
    super(separatorBackstageItemDef);

    SeparatorBackstageItem._sSeparatorBackstageItemKey++;
    this._key = SeparatorBackstageItem._sSeparatorBackstageItemKey;
  }

  public render(): React.ReactNode {
    return (
      <NZ_BackstageSeparator key={this._key} />
    );
  }
}
