/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Message */

export enum Status {
  Information,
  Success,
  Error,
}

export class StatusHelpers {
  public static readonly INFORMATION_CLASS_NAME = "nz-status-information";
  public static readonly SUCCESS_CLASS_NAME = "nz-status-success";
  public static readonly ERROR_CLASS_NAME = "nz-status-error";

  public static getCssClassName(status: Status): string {
    switch (status) {
      case Status.Information:
        return StatusHelpers.INFORMATION_CLASS_NAME;
      case Status.Success:
        return StatusHelpers.SUCCESS_CLASS_NAME;
      case Status.Error:
        return StatusHelpers.ERROR_CLASS_NAME;
    }
  }
}

export default Status;
