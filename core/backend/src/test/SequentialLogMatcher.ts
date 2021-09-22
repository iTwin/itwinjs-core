/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GetMetaDataFunction, IDisposable, Logger, LogLevel } from "@itwin/core-bentley";
import { IModelHost } from "../IModelHost";
/**
 * SequentialLogMatcher match log message in order and remove them from list. Any test using
 * should check if length come down to zero. If its not then test should fail.
 */
export class SequentialLogMatcher implements IDisposable {
  private _rules: LogMatchRule[] = [];
  public constructor(private _suppressMatchLogMsgs: boolean = true) {
    Logger.setIntercept((level: LogLevel, category: string, message: string, metaData?: GetMetaDataFunction) => {
      if (this._rules.length === 0) {
        return true;
      }
      const rule = this._rules[0];
      if (rule.test(level, category, message, metaData)) {
        this._rules.shift();
        return this._suppressMatchLogMsgs === false;
      }
      return true;
    });
  }
  public append(): LogMatchRule {
    const newMatch = new LogMatchRule();
    this._rules.push(newMatch);
    return newMatch;
  }
  public dispose() {
    Logger.setIntercept(undefined);
  }
  public finish(): boolean {
    IModelHost.flushLog();
    return this.length === 0;
  }
  public finishAndDispose(): boolean {
    const rc = this.finish();
    this.dispose();
    return rc;
  }
  public get length(): number { return this._rules.length; }
}

export class LogMatchRule {
  private _level?: LogLevel;
  private _category?: string | RegExp;
  private _message?: string | RegExp;
  private _metaDataCheck?: (data: any) => boolean;
  public test(level: LogLevel, category: string, message: string, metaData?: GetMetaDataFunction): boolean {
    if (this._level) {
      if (this._level !== level)
        return false;
    }

    if (this._category) {
      if (this._category instanceof RegExp) {
        if (!this._category.test(category))
          return false;
      } else {
        if (this._category !== category)
          return false;
      }
    }
    if (this._message) {
      if (this._message instanceof RegExp) {
        if (!this._message.test(message))
          return false;
      } else {
        if (this._message !== message)
          return false;
      }
    }
    if (this._metaDataCheck) {
      if (!metaData)
        return false;

      if (!this._metaDataCheck(metaData()))
        return false;
    }
    return true;
  }

  private level(lvl: LogLevel): LogMatchRule {
    this._level = lvl;
    return this;
  }
  // eslint-disable-next-line @bentley/prefer-get
  public trace(): LogMatchRule {
    return this.level(LogLevel.Trace);
  }
  // eslint-disable-next-line @bentley/prefer-get
  public error(): LogMatchRule {
    return this.level(LogLevel.Error);
  }
  // eslint-disable-next-line @bentley/prefer-get
  public info(): LogMatchRule {
    return this.level(LogLevel.Info);
  }
  // eslint-disable-next-line @bentley/prefer-get
  public warn(): LogMatchRule {
    return this.level(LogLevel.Warning);
  }
  public category(category: string | RegExp): LogMatchRule {
    this._category = category;
    return this;
  }
  public message(message: string | RegExp): LogMatchRule {
    this._message = message;
    return this;
  }
  public metadata(check: (data: any) => boolean): LogMatchRule {
    this._metaDataCheck = check;
    return this;
  }
}
