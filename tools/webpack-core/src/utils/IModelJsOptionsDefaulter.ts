/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { WebpackOptionsDefaulter, WebpackOptionsNormalized } from "webpack";

/** @deprecated in 3.x. */
export class IModelJsOptionsDefaulter extends WebpackOptionsDefaulter {
  constructor(private _enableSourceMaps = true) {
    super();
  }

  public override process(_options: WebpackOptionsNormalized) {
    return _options;
  }
}
