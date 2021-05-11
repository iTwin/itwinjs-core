/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Date
 */

import * as React from "react";
import classnames from "classnames";
import { SpecialKey } from "@bentley/ui-abstract";
import { WebFontIcon } from "@bentley/ui-core";
import { UiComponents } from "../UiComponents";

import "./DatePicker.scss";

function isSameDay(a: Date, b: Date) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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
 * @param inDateTime date/time at project location
 * @param utcOffset UTC offset for project location in minutes.
 *
 * @alpha
 */
export function adjustDateToTimezone(inDateTime: Date, utcOffset: number) {
  return new Date(inDateTime.getTime() + (inDateTime.getTimezoneOffset() + utcOffset) * 60000);
}

/**
 * Props for [[DatePicker]] component.
 * @alpha
 */
export interface DatePickerProps {
  /** defines both date and time */
  selected: Date;
  /** function to call when date or time has changed */
  onDateChange?: (day: Date) => void;
  /** show focus outlines, useful for keyboard navigation */
  showFocusOutline?: boolean;
}

/** DatePicker component. Show a month selector and a day calendar to select a specific date.
 * @alpha
 */
export function DatePicker(props: DatePickerProps) {
  const previousMonthLabel = React.useRef(UiComponents.i18n.translate("UiComponents:datepicker.previousMonth"));
  const nextMonthLabel = React.useRef(UiComponents.i18n.translate("UiComponents:datepicker.nextMonth"));
  const monthsLong = React.useRef([
    UiComponents.i18n.translate("UiComponents:month.long.january"),
    UiComponents.i18n.translate("UiComponents:month.long.february"),
    UiComponents.i18n.translate("UiComponents:month.long.march"),
    UiComponents.i18n.translate("UiComponents:month.long.april"),
    UiComponents.i18n.translate("UiComponents:month.long.may"),
    UiComponents.i18n.translate("UiComponents:month.long.june"),
    UiComponents.i18n.translate("UiComponents:month.long.july"),
    UiComponents.i18n.translate("UiComponents:month.long.august"),
    UiComponents.i18n.translate("UiComponents:month.long.september"),
    UiComponents.i18n.translate("UiComponents:month.long.october"),
    UiComponents.i18n.translate("UiComponents:month.long.november"),
    UiComponents.i18n.translate("UiComponents:month.long.december"),
  ]);

  const daysLong = React.useRef([
    UiComponents.i18n.translate("UiComponents:days.long.sunday"),
    UiComponents.i18n.translate("UiComponents:days.long.monday"),
    UiComponents.i18n.translate("UiComponents:days.long.tuesday"),
    UiComponents.i18n.translate("UiComponents:days.long.wednesday"),
    UiComponents.i18n.translate("UiComponents:days.long.thursday"),
    UiComponents.i18n.translate("UiComponents:days.long.friday"),
    UiComponents.i18n.translate("UiComponents:days.long.saturday"),
  ]);

  const daysShort = React.useRef([
    UiComponents.i18n.translate("UiComponents:days.short.sunday"),
    UiComponents.i18n.translate("UiComponents:days.short.monday"),
    UiComponents.i18n.translate("UiComponents:days.short.tuesday"),
    UiComponents.i18n.translate("UiComponents:days.short.wednesday"),
    UiComponents.i18n.translate("UiComponents:days.short.thursday"),
    UiComponents.i18n.translate("UiComponents:days.short.friday"),
    UiComponents.i18n.translate("UiComponents:days.short.saturday"),
  ]);

  const [selectedDay, setSelectedDay] = React.useState(new Date(props.selected.getTime()));
  const [displayedMonthIndex, setDisplayedMonthIndex] = React.useState(selectedDay.getMonth());
  const [displayedYear, setDisplayedYear] = React.useState(selectedDay.getFullYear());
  const [focusedDay, setFocusedDay] = React.useState(selectedDay);
  const days = React.useMemo(() => {
    const msFirstDayOfMonth = new Date(displayedYear, displayedMonthIndex, 1).getTime();
    let offsetToFirst = new Date(msFirstDayOfMonth).getDay();
    if (0 === offsetToFirst)
      offsetToFirst = 7;

    const daysInMonth: Date[] = [];
    // generate 6 weeks of dates
    for (let i = 0; i < 42; i++) {
      const adjustedDay = 1 + i - offsetToFirst;
      daysInMonth.push(new Date(displayedYear, displayedMonthIndex, adjustedDay));
    }
    return daysInMonth;
  }, [displayedMonthIndex, displayedYear]);

  const weeks = React.useMemo(() => {
    const weeksInMonth = [];
    const weekCount = Math.ceil(days.length / 7);
    for (let i = 0; i < weekCount; i++) {
      weeksInMonth.push(days.slice(i * 7, (i + 1) * 7));
    }
    return weeksInMonth;
  }, [days]);

  const setMonthAndYear = React.useCallback((newMonth: number, newYear: number) => {
    setDisplayedMonthIndex(newMonth);
    setDisplayedYear(newYear);
    if (selectedDay.getFullYear() === newYear && selectedDay.getMonth() === newMonth) {
      setFocusedDay(new Date(selectedDay.getTime()));
    } else {
      const newFocusDay = new Date(focusedDay.getTime());
      newFocusDay.setFullYear(newYear, newMonth, 1);
      setFocusedDay(newFocusDay);
    }
  }, [focusedDay, selectedDay]);

  const handleMoveToPreviousMonth = React.useCallback(() => {
    const newMonth = displayedMonthIndex !== 0 ? displayedMonthIndex - 1 : 11;
    const newYear = displayedMonthIndex !== 0 ? displayedYear : displayedYear - 1;
    setMonthAndYear(newMonth, newYear);
  }, [displayedMonthIndex, displayedYear, setMonthAndYear]);

  const handleMoveToNextMonth = React.useCallback(() => {
    const newMonth = displayedMonthIndex !== 11 ? displayedMonthIndex + 1 : 0;
    const newYear = displayedMonthIndex !== 11 ? displayedYear : displayedYear + 1;
    setMonthAndYear(newMonth, newYear);
  }, [displayedMonthIndex, displayedYear, setMonthAndYear]);

  // when invoked, it will return another function which can be used for the onClick React listener.
  const handleOnDayChange = React.useCallback((day: Date) => () => {
    setSelectedDay(day);
    setFocusedDay(day);
    props.onDateChange && props.onDateChange(day);
  }, [props]);

  const handleCalendarKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === SpecialKey.ArrowDown) {
      const focusedDayIndex = days.findIndex((day) => isSameDay(day, focusedDay));
      if ((focusedDayIndex + 7) > 41)
        setFocusedDay(days[focusedDayIndex % 7]);
      else
        setFocusedDay(days[focusedDayIndex + 7]);
      event.preventDefault();
    }
    if (event.key === SpecialKey.ArrowUp) {
      const focusedDayIndex = days.findIndex((day) => isSameDay(day, focusedDay));
      if ((focusedDayIndex - 7) < 0)
        setFocusedDay(days[(focusedDayIndex % 7) + 35]);
      else
        setFocusedDay(days[focusedDayIndex - 7]);
      event.preventDefault();
    }
    if (event.key === SpecialKey.ArrowLeft) {
      const focusedDayIndex = days.findIndex((day) => isSameDay(day, focusedDay));
      // istanbul ignore else
      if ((focusedDayIndex - 1) >= 0)
        setFocusedDay(days[focusedDayIndex - 1]);
      event.preventDefault();
    }
    if (event.key === SpecialKey.ArrowRight) {
      const focusedDayIndex = days.findIndex((day) => isSameDay(day, focusedDay));
      // istanbul ignore else
      if ((focusedDayIndex + 1) <= 41)
        setFocusedDay(days[focusedDayIndex + 1]);
      event.preventDefault();
    }
    if (event.key === SpecialKey.Enter || event.key === SpecialKey.Space) {
      handleOnDayChange(focusedDay)(); // NB: immediately call returned handler function
      event.preventDefault();
    }
  }, [days, focusedDay, handleOnDayChange]);

  const previousButtonClass = classnames("components-previous-month", props.showFocusOutline && "showFocusOutline");
  const nextButtonClass = classnames("components-next-month", props.showFocusOutline && "showFocusOutline");
  const calendarClass = classnames("components-date-picker-calendar-month", props.showFocusOutline && "showFocusOutline");

  return (
    <div className="components-date-picker-calendar">
      <div className="components-date-picker-calendar-header-months">
        <button className={previousButtonClass} title={previousMonthLabel.current} onClick={handleMoveToPreviousMonth}>
          <WebFontIcon iconName={"icon-chevron-left"} />
        </button>
        <span className="components-month-year">{monthsLong.current[displayedMonthIndex]} {displayedYear}</span>
        <button className={nextButtonClass} title={nextMonthLabel.current} onClick={handleMoveToNextMonth}>
          <WebFontIcon iconName={"icon-chevron-right"} />
        </button>
      </div>
      <div className="components-date-picker-calendar-header-weekdays">
        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) =>
          <div key={`day-${dayOfWeek}`} className="components-date-picker-calendar-header-day-short"
            title={daysLong.current[dayOfWeek]}><span>{daysShort.current[dayOfWeek]}</span></div>)}
      </div>
      <ul tabIndex={0} onKeyDown={handleCalendarKeyDown} data-testid="components-date-picker-calendar-list" className={calendarClass} role="listbox">
        {weeks.map((weekdays, weekIndex) => (
          <React.Fragment key={`week-${weekIndex}`}>
            {weekdays.map((day: Date, dayIndex: number) => {
              const isActive = selectedDay && day && isSameDay(selectedDay, day);
              const isFocused = focusedDay && day && isSameDay(focusedDay, day) && props.showFocusOutline;
              const isCurrentMonth = day.getMonth() === displayedMonthIndex;
              const classNames = classnames("components-date-picker-calendar-day", isActive && "selected", !isCurrentMonth && "notCurrentMonth", isFocused && "focused");
              const dateValue = day.getDate();
              return (
                /* eslint-disable-next-line jsx-a11y/click-events-have-key-events */
                <li className={classNames} key={`${displayedYear}.${displayedMonthIndex}.day.${dayIndex}`}
                  onClick={handleOnDayChange(day)} role="option" aria-selected={isActive} data-value={day.getTime()}>
                  <span>{dateValue}</span>
                </li>
              );
            })}
          </React.Fragment>)
        )}
      </ul>
    </div>
  );
}
