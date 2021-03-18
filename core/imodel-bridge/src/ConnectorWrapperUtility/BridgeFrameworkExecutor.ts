/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as childProcess from "child_process";
import { BridgeFrameworkExecutorInterface } from "./BridgeFrameworkExecutorInterface";
import { BridgeJobExecutionStatus } from "./BridgeJobExecutionStatus";
import { Logger } from "@bentley/bentleyjs-core";

export class BridgeFrameworkExecutor implements BridgeFrameworkExecutorInterface {
  // Properties
  public jobCurrentStatus: BridgeJobExecutionStatus = BridgeJobExecutionStatus.NotStarted;
  private _bridgeFrameworkPath: string;
  private _childProcess: childProcess.ChildProcess | undefined;
  private _timeOut?: number | undefined;
  private _timeOutAllowed: boolean | undefined;
  private _timeoutPromise: any | false;
  private _timeStamp!: Date;
  private _executedDuration!: number | 0;
  private _rspFile: string | "";
  private _logTimeoutPromise: any | undefined;
  private _logTimeoutValue: number | undefined;

  // StreamListener
  private _outputStreamListener: ((data: string) => void) | undefined;

  // callBacks
  private _timeoutListener: (() => void) | undefined;
  private _bridgeStartListener: ((childProcess: childProcess.ChildProcess) => void) | undefined;
  private _closeListener: ((code: number, signal: string) => void) | undefined;
  private _disconnect: (() => void) | undefined;
  private _errorListener: ((err: Error) => void) | undefined;
  private _exitListener: ((code: number | null, signal: string | null) => void) | undefined;

  constructor(bridgeFrameworkPath: string, rspFile: string, logTimeoutValue: number | undefined) {
    this._bridgeFrameworkPath = bridgeFrameworkPath;
    this._rspFile = rspFile;
    this._logTimeoutValue = logTimeoutValue;
  }

  public getDuration(): number {
    if (this.jobCurrentStatus === BridgeJobExecutionStatus.NotStarted) return 0;
    if (this.jobCurrentStatus === BridgeJobExecutionStatus.InProgress) return (new Date().valueOf() - this._timeStamp.valueOf()) / 1000;

    return this._executedDuration;
  }

  public setTimeOut(minutes: number | undefined) {
    this._timeOut = minutes;
    return this;
  }

  public setTimeoutAllowed(allowed: boolean) {
    this._timeOutAllowed = allowed;
    return this;
  }

  public setBridgeStartListener(bridgeStartListener: (childProcess: childProcess.ChildProcess) => void) {
    this._bridgeStartListener = bridgeStartListener;
    return this;
  }

  public setTimeoutListener(timeoutListener: () => void) {
    this._timeoutListener = timeoutListener;
    return this;
  }

  public setCloseListener(closeListener: (code: number, signal: string) => void) {
    this._closeListener = closeListener;
    return this;
  }

  public setDisconnectListener(disconnectListener: () => void) {
    this._disconnect = disconnectListener;
    return this;
  }

  public setErrorListener(errorListener: (err: Error) => void) {
    this._errorListener = errorListener;
    return this;
  }

  public setExitListener(exitListener: (code: number | null, signal: string | null) => void) {
    this._exitListener = exitListener;
    return this;
  }

  public setOutPutStream(outputStreamListener: (data: string) => void) {
    this._outputStreamListener = outputStreamListener;
    return this;
  }

  public async executeBridgeJob() {
    this._childProcess = childProcess.spawn(this._bridgeFrameworkPath, [`@${this._rspFile}`]);
    this.jobCurrentStatus = BridgeJobExecutionStatus.InProgress;

    this._childProcess.stderr.on("data", (data) => {
      Logger.logInfo("BridgeFrameworkExectutor", data);
    });

    if (this._bridgeStartListener) {
      this._timeStamp = new Date();
      this._bridgeStartListener(this._childProcess);
    }

    if (this._timeOut && this._timeOutAllowed) {
      Logger.logInfo("BridgeFrameworkExectutor", "Inside set timeout");
      this._timeoutPromise = setTimeout(() => {
        if (this._childProcess) {
          if (this._timeoutListener) {
            this._timeoutListener();
          }
          if (this.jobCurrentStatus === BridgeJobExecutionStatus.InProgress) {
            this.jobCurrentStatus = BridgeJobExecutionStatus.Timeout;
            Logger.logInfo("BridgeFrameworkExectutor", "Job status updated to timeout");
            this._childProcess.kill();
          }
        }
      }, this._timeOut * 600);
    }

    if (this._closeListener) {
      this._childProcess.on("close", this._closeListener);
    }

    if (this._disconnect) {
      this._childProcess.on("disconnect", this._disconnect);
    }

    if (this._errorListener) {
      this._childProcess.on("error", this._errorListener);
    }

    this._childProcess.on("exit", async (_code: number | null, _signal: string | null) => {
      clearTimeout(this._timeoutPromise);
      if (this._exitListener) {
        this._executedDuration = (new Date().valueOf() - this._timeStamp.valueOf()) / 1000;
        Logger.logTrace(
          "BridgeFrameworkExecutor",
          `[iModelBridgeService.NodeJsWrapper]: ExecuteBridgeJob-- Process exited with code: ${_code} and signal: ${_signal}`,
        );
        this._exitListener(_code, _signal);
      }
    });

    this._childProcess.stdout.on("data", (data) => {
      // Do not act, if data is empty or undefined
      if (data) {
        // Listen log message and detect bgsender for specific time
        const regex = new RegExp(/bg\s*sender [runningsleeping]/i);
        if (regex.test(String(data))) {
          if (this._logTimeoutPromise === undefined && this._logTimeoutValue !== undefined) {
            Logger.logInfo("BridgeFrameworkExectutor", "Inside set timeout");
            this._logTimeoutPromise = setTimeout(() => {
              if (this._childProcess) {
                if (this._timeoutListener) {
                  this._timeoutListener();
                }
                if (this.jobCurrentStatus === BridgeJobExecutionStatus.InProgress) {
                  this.jobCurrentStatus = BridgeJobExecutionStatus.Timeout;
                  Logger.logInfo("BridgeFrameworkExectutor", "Job is stuck and status updated to timeout");
                  this._childProcess.kill();
                }
              }
            }, this._logTimeoutValue * (60 * 1000));
          }
        } else {
          clearTimeout(this._logTimeoutPromise);
          this._logTimeoutPromise = undefined;
        }
        // send data to listener
        if (this._outputStreamListener) {
          this._outputStreamListener(data);
        }
      }
    });
  }

  public async killBridgeJob() {
    return new Promise(async (_resolve, _reject) => {
      Logger.logInfo("BridgeFrameworkExectutor", "Inside Killbridgejob");
      if (this._childProcess && this.jobCurrentStatus === BridgeJobExecutionStatus.InProgress) {
        try {
          clearTimeout(this._timeoutPromise);
          this._childProcess.kill();
          this.jobCurrentStatus = BridgeJobExecutionStatus.Canceled;
          Logger.logInfo("BridgeFrameworkExectutor", "Job status updated to canceled");
          _resolve("job killed");
        } catch (ex) {
          Logger.logInfo("BridgeFrameworkExectutor", "Failed to stop child process");
          _reject("error");
        }
      } else {
        Logger.logInfo("BridgeFrameworkExectutor", "Job is not in progress");
        if (this._exitListener) this._exitListener(0, "JNIP_TERM");
      }
    });
  }
}
