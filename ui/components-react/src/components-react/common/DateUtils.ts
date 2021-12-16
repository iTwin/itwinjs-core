/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */
/**
 * Adjust a Date object to show time in one time zone as if it is in the local time zone.
 * This is useful when showing sunrise and sunset times for a project location in a different time zone
 * and the time displayed should appear as if the user is seeing clock in project location.
 * Example 1:
 * If you have a UTC time for London (UTC +0100) and you want to display it in Eastern-US (UTC -0400) as if you were in London.
 * ```ts
 *   londonDate = new Date("July 22, 2018 07:22:13 +0100");
 *   in Eastern-US londonDate will show as '7/22/2018, 2:22:13 AM'
 *   adjustedDate = adjustDateToTimezone(londonDate, 1*60);
 *   in location Eastern-US adjustedDate will show as '7/22/2018, 7:22:13 AM'
 * ```
 * Example 2:
 * If you have a UTC time for your location (UTC -0400) and you want to display the time as if you are in Western-US (UTC -0700).
 * ```ts
 *   easternDate = new Date("July 22, 2018 07:22:13 -0400");
 *   adjustedDate = adjustDateToTimezone(easternDate, -7*60);
 *   in location Eastern-US adjustedDate will show as '7/22/2018, 7:22:13 AM'
 * ```
 *
 * The utcOffset must be the time in minutes between the UTC and the desired time zone at the date specified by inDateTime.
 * For example, if you want the time offset to New York, NY and the date is during Daylight Saving Time, utcOffset should be -240 (-4 * 60).
 * If the date falls during Standard Time in New York, utcOffset will be -300 (-5 * 60).
 *
 * @param inDateTime date/time at project location
 * @param utcOffset UTC offset in  minutes
 * @public
 */
export function adjustDateToTimezone(inDateTime: Date, utcOffset: number) {
  return new Date(inDateTime.getTime() + (inDateTime.getTimezoneOffset() + utcOffset) * 60000);
}
/**
 * Format a date in a display string, optionally converting to time zone, if specified by timeZoneOffset
 * @param date Date object to format
 * @param timeZoneOffset optional: offset from UTC to use for conversion
 * @returns formatted date string
 * @public
 */
export const toDateString = (date: Date, timeZoneOffset?: number) => {
  return undefined === timeZoneOffset ? date.toLocaleDateString() : adjustDateToTimezone(date, timeZoneOffset).toLocaleDateString();
};
/**
 * Format the time included in a date, optionally converting to time zone, if specified
 * @param date Date object
 * @param timeZoneOffset optional: offset from UTC to use for conversion
 * @returns formatted time string
 * @public
 */
export const toTimeString = (date: Date, timeZoneOffset?: number) => {
  return undefined === timeZoneOffset ? date.toLocaleTimeString() : adjustDateToTimezone(date, timeZoneOffset).toLocaleTimeString();
};

