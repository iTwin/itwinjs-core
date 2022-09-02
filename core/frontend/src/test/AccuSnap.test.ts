/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SnapRequestProps, SnapResponseProps } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

describe.only("AccuSnap", () => {
  describe("requestSnap", () => {
    function overrideRequestSnap(iModel: IModelConnection, impl: (iModel: IModelConnection, props: SnapRequestProps) => SnapResponseProps): void {
      iModel.requestSnap = (props) => Promise.resolve(impl(iModel, props));
    }
  });
});
