/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { StatusHelpers, Status } from "../../../../../ui-ninezone";

describe("<StatusHelpers />", () => {
  it("should return information class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Information);
    sut.should.eq("nz-status-information");
  });

  it("should return information class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Success);
    sut.should.eq("nz-status-success");
  });

  it("should return information class name", () => {
    const sut = StatusHelpers.getCssClassName(Status.Error);
    sut.should.eq("nz-status-error");
  });
});
