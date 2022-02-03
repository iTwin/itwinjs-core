/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Date
 */

import type { DateFormatter } from "@itwin/appui-abstract";

/**
 * A basic class that allows user to provide an Intl.DateTimeFormat
 * that can be used to format the date and time display. If no format is
 * specified a default format will be used. This default implementation does not
 * support parsing, so when used by [[DatePickerPopup]] the edit field will be readonly. If
 * a parseData function is implemented then the edit field will be editable.
 * @alpha
 */
export class IntlFormatter implements DateFormatter {
  constructor(private _intlFormatter?: Intl.DateTimeFormat) {
  }

  public get formatter(): Intl.DateTimeFormat {
    if (!this._intlFormatter) {
      // https://tc39.es/ecma402/#sec-intl-datetimeformat-constructor
      this._intlFormatter = new Intl.DateTimeFormat(undefined,
        {
          weekday: "short",    /* "narrow", "short", "long" */
          year: "numeric",    /* "2-digit", "numeric" */
          month: "2-digit",   /* "2-digit", "numeric", "narrow", "short", "long" */
          day: "2-digit",     /* "2-digit", "numeric" */
          hour: "numeric",    /* "2-digit", "numeric" */
          hour12: true,
          minute: "numeric",  /* "2-digit", "numeric" */
          second: "numeric",  /* "2-digit", "numeric" */
          /* timeZoneName:	"short", */ /* "short", "long" */
        });
    }
    return this._intlFormatter;
  }

  public formateDate(day: Date) {
    return this.formatter.format(day);
  }

  // The default implementation does not currently support parsing. If a derived class supports parsing then the
  // parseDate function must be implemented.
  // parseDate(dateString: string): Date|undefined {}
}

