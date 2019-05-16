/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./DayPicker.scss";
import { UiComponents } from "../../ui-components/UiComponents";

// component is in alpha state - it may change after usability testing - test coverage not complete
/* istanbul ignore file */

const addZero = (i: number) => {
  return (i < 10) ? "0" + i : i;
};

interface DayPickerProps {
  shortDayNames?: ReadonlyArray<string>;
  monthNames?: ReadonlyArray<string>;
  longDayNames?: ReadonlyArray<string>;
  hours?: number;
  minutes?: number;
  onDayChange: (day: Date) => void;
  onTimeChange?: (hours: number, minutes: number) => void;
  active?: Date;
}

interface DayPickerState {
  date: number;
  month: number;
  year: number;
  today: Date;
  time: string;
}

/** Day Picker for Solar Timeline component
 * @alpha
 */
export class DayPicker extends React.Component<DayPickerProps, DayPickerState> {
  private _months = [
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
  ];

  private _daysLong = [
    UiComponents.i18n.translate("UiComponents:days.long.sunday"),
    UiComponents.i18n.translate("UiComponents:days.long.monday"),
    UiComponents.i18n.translate("UiComponents:days.long.tuesday"),
    UiComponents.i18n.translate("UiComponents:days.long.wednesday"),
    UiComponents.i18n.translate("UiComponents:days.long.thursday"),
    UiComponents.i18n.translate("UiComponents:days.long.friday"),
    UiComponents.i18n.translate("UiComponents:days.long.saturday"),
  ];

  private _daysShort = [
    UiComponents.i18n.translate("UiComponents:days.short.sunday"),
    UiComponents.i18n.translate("UiComponents:days.short.monday"),
    UiComponents.i18n.translate("UiComponents:days.short.tuesday"),
    UiComponents.i18n.translate("UiComponents:days.short.wednesday"),
    UiComponents.i18n.translate("UiComponents:days.short.thursday"),
    UiComponents.i18n.translate("UiComponents:days.short.friday"),
    UiComponents.i18n.translate("UiComponents:days.short.saturday"),
  ];

  constructor(props: DayPickerProps) {
    super(props);

    const now = props.active ? props.active : new Date();

    let time = "";
    if (this.props.hours && this.props.minutes) {
      time = `${addZero(this.props.hours)}:${addZero(this.props.minutes)}`;
    }

    this.state = {
      date: now.getDate(),
      month: now.getMonth(),
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      year: now.getFullYear(),
      time,
    };
  }

  public static isSameDay(a: Date, b: Date) {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  get days() {
    const { month, year } = this.state;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    const offset = new Date(year, month, 1).getDay();
    if (offset < 7) {
      for (let i = 0; i < offset; i++) {
        days.push(null);
      }
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }

  get weeks() {
    const days = this.days;
    const weeks = [];
    const weekCount = Math.ceil(days.length / 7);
    for (let i = 0; i < weekCount; i++) {
      weeks.push(days.slice(i * 7, (i + 1) * 7));
    }
    return weeks;
  }

  public longMonthName(month: number) {
    if (this.props.monthNames) {
      return this.props.monthNames[month];
    }

    return this._months[month];
  }

  public longDayName(dayOfWeek: number) {
    if (this.props.longDayNames) {
      return this.props.longDayNames[dayOfWeek];
    }

    return this._daysLong[dayOfWeek];
  }

  public shortDayName(dayOfWeek: number) {
    if (this.props.shortDayNames) {
      return this.props.shortDayNames[dayOfWeek];
    }

    return this._daysShort[dayOfWeek];
  }

  public previousMonth = () => {
    const { month, year } = this.state;

    this.setState({
      month: month !== 0 ? month - 1 : 11,
      year: month !== 0 ? year : year - 1,
    });
  }

  public nextMonth = () => {
    const { month, year } = this.state;

    this.setState({
      month: month !== 11 ? month + 1 : 0,
      year: month !== 11 ? year : year + 1,
    });
  }

  public onDayChange = (day: Date) => () => {
    if (day) {
      this.props.onDayChange(day);
    }
  }

  private _onTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) {
      const time = event.target.value;
      this.setState({ time });

      if (this.props.onTimeChange) {
        const hours = time.substring(0, 2);
        const minutes = time.substring(3, 5);
        this.props.onTimeChange(Number(hours), Number(minutes));
      }
    }
  }

  public renderDay = (day: Date, index: number) => {
    const { month, today, year } = this.state;
    const { active } = this.props;

    const isToday = day && day.valueOf() === today.valueOf();
    const isActive = active && day && DayPicker.isSameDay(active, day);

    return (
      <td
        className={[
          "day",
          isActive ? "active" : null,
          !day ? "empty" : null,
          isToday ? "today" : null,
        ]
          .filter((v) => v)
          .join(" ")}
        key={`${year}.${month}.day.${index}`}
        onClick={this.onDayChange(day)}
      >
        {day ? day.getDate() : ""}
      </td>
    );
  }

  public renderWeek = (days: any, index: number) => {
    const { month, year } = this.state;

    return (
      <tr key={`${year}.${month}.week.${index}`}>{days.map((date: Date, i: number) => this.renderDay(date, i))}</tr>
    );
  }

  public renderDayHeader(dayOfWeek: number) {
    return (
      <th scope="col">
        <abbr title={this.longDayName(dayOfWeek)}>
          {this.shortDayName(dayOfWeek)}
        </abbr>
      </th>
    );
  }

  public render() {
    const { month, year, time } = this.state;
    const hasTime = time !== "";

    return (
      <div className="day-picker">
        <div className="header">
          <span className="previous-month icon icon-chevron-left" onClick={this.previousMonth} />
          <span className="month-year">{this.longMonthName(month)} {year}</span>
          <span className="next-month icon icon-chevron-right" onClick={this.nextMonth} />
        </div>
        <table>
          <thead>
            <tr>
              {this.renderDayHeader(0)}
              {this.renderDayHeader(1)}
              {this.renderDayHeader(2)}
              {this.renderDayHeader(3)}
              {this.renderDayHeader(4)}
              {this.renderDayHeader(5)}
              {this.renderDayHeader(6)}
            </tr>
          </thead>
          <tbody>{this.weeks.map((days, index) => this.renderWeek(days, index))}</tbody>
        </table>
        {hasTime &&
          <div className="time-container">
            <input className="input" type="time" value={time} onChange={this._onTimeChange} />
          </div>
        }
      </div>
    );
  }
}
