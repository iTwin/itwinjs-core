/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SnapRequestProps, SnapResponseProps } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

function overrideRequestSnap(iModel: IModelConnection, impl: (iModel: IModelConnection, props: SnapRequestProps) => Promise<SnapResponseProps>): () => void {
  const baseImpl = iModel.requestSnap;
  iModel.requestSnap = (props) => impl(iModel, props);
  return () => iModel.requestSnap = baseImpl;
}

describe.only("AccuSnap", () => {
  describe("requestSnap", () => {
  });
});
