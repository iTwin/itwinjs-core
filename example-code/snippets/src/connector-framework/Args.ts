/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export class AllArgsProps {
  constructor(jobArgs: JobArgs, hubArgs: HubArgs) {
    this.jobArgs = jobArgs;
    this.hubArgs = hubArgs;
  }
  public version: string = "1.0";
  public jobArgs: JobArgs;
  public hubArgs: HubArgs;
}

export class HubArgsProps {

}

export class HubArgs {
  public constructor(hubArgsProps: HubArgsProps) {
    this.hubArgProps = hubArgsProps;
  }
  public isValid: boolean = false;
  public hubArgProps: HubArgsProps;
}

export class JobArgsProps {

}

export class JobArgs {
  public constructor(jobArgsProps: JobArgsProps) {
    this.jobArgsProps = jobArgsProps;
  }
  public isValid: boolean = false;
  public jobArgsProps: JobArgsProps;
  public loggerConfigJSONFile: any;
}
