/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import { BackstageSeparator as NZ_BackstageSeparator } from "@itwin/appui-layout-react";
import { BackstageItemProps } from "./BackstageItemProps";

/** Separator Backstage item.
 * @public
 * @deprecated
 */
export class SeparatorBackstageItem extends React.PureComponent<BackstageItemProps> { // eslint-disable-line deprecation/deprecation
  private static _sSeparatorBackstageItemKey: number;
  private _key: number;

  constructor(separatorBackstageItemDef: BackstageItemProps) { // eslint-disable-line deprecation/deprecation
    super(separatorBackstageItemDef);

    SeparatorBackstageItem._sSeparatorBackstageItemKey++; // eslint-disable-line deprecation/deprecation
    this._key = SeparatorBackstageItem._sSeparatorBackstageItemKey; // eslint-disable-line deprecation/deprecation
  }

  public override render(): React.ReactNode {
    return (
      <NZ_BackstageSeparator key={this._key} />
    );
  }
}
