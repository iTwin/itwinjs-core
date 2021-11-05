/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Status, StatusHelpers } from "../../../appui-layout-react";

describe("<StatusHelpers />", () => {
  it("should return information class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Information);
    sut.should.eq("nz-status-information");
  });

  it("should return success class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Success);
    sut.should.eq("nz-status-success");
  });

  it("should return error class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Error);
    sut.should.eq("nz-status-error");
  });

  it("should return warning class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Warning);
    sut.should.eq("nz-status-warning");
  });
});
