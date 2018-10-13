/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

/** Available status types of status message. */
export enum Status {
  Information,
  Success,
  Error,
}

/** Helpers for [[Status]]. */
export class StatusHelpers {
  /** Class name of [[Status.Information]] */
  public static readonly INFORMATION_CLASS_NAME = "nz-status-information";
  /** Class name of [[Status.Success]] */
  public static readonly SUCCESS_CLASS_NAME = "nz-status-success";
  /** Class name of [[Status.Error]] */
  public static readonly ERROR_CLASS_NAME = "nz-status-error";

  /** @returns Class name of specified [[Status]] */
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
