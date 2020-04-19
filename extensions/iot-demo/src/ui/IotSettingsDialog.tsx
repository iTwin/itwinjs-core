/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { Dialog, Select, Input, Button, ButtonType, Popup } from "@bentley/ui-core";
import { SyncPropertiesChangeEventArgs, RelativePosition } from "@bentley/ui-abstract";
import { ModelessDialogManager } from "@bentley/ui-framework";
import { IotUiProvider } from "./IotUiProvider";
import { AnimationTypeName } from "../IoTDefinitions";

import "./IotSettingsDialog.scss";

/** Props for the [[IotSettingsDialog]] component */
interface IotSettingsDialogProps {
  dataProvider: IotUiProvider;
}

/** State for the [[IotSettingsDialog]] component */
interface IotSettingsDialogState {
  currentTab: number; // current tab (0 == History / 1 == Monitor)
  sensor: string;
  alarm: string;
  startTime: Date;
  endTime: Date;
  monitorTime: Date;
}

/**
 * A dialog containing Iot settings
 * @alpha
 */
// istanbul ignore next
export class IotSettingsDialog extends React.Component<IotSettingsDialogProps, IotSettingsDialogState> {
  public readonly state: Readonly<IotSettingsDialogState>;
  public static readonly id = "IotSettingsDialog";
  private _alarms: Map<string, string> = new Map<string, string>();
  private _sensors: { [key: string]: string } = {};
  private _temperatureLabel: string;
  private _heatingCoolingLabel: string;
  private _co2Label: string;
  private _occupancyLabel: string;
  private _smokeLabel: string;
  private _fireLabel: string;
  private _historyLabel: string;
  private _monitorLabel: string;
  private _dialogTitle: string;

  constructor(props: IotSettingsDialogProps) {
    super(props);
    const i18n = this.props.dataProvider.extension.i18n;
    this._temperatureLabel = i18n.translate("iotDemo:Dialog.Temperature");
    this._heatingCoolingLabel = i18n.translate("iotDemo:Dialog.HeatingCooling");
    this._co2Label = i18n.translate("iotDemo:Dialog.CO2");
    this._occupancyLabel = i18n.translate("iotDemo:Dialog.Occupancy");
    this._smokeLabel = i18n.translate("iotDemo:Dialog.Smoke");
    this._fireLabel = i18n.translate("iotDemo:Dialog.Fire");
    this._historyLabel = i18n.translate("iotDemo:Dialog.History");
    this._monitorLabel = i18n.translate("iotDemo:Dialog.Monitor");
    this._dialogTitle = i18n.translate("iotDemo:Dialog.Title");

    this._sensors[AnimationTypeName.Temperature] = this._temperatureLabel;
    this._sensors[AnimationTypeName.HeatingCooling] = this._heatingCoolingLabel;
    this._sensors[AnimationTypeName.Co2] = this._co2Label;
    this._sensors[AnimationTypeName.Occupancy] = this._occupancyLabel;
    this._sensors[AnimationTypeName.Smoke] = this._smokeLabel;
    this._sensors[AnimationTypeName.Fire] = this._fireLabel;

    this._alarms.set("None", "grey");
    this._alarms.set("Temperature", "yellow");
    this._alarms.set("Smoke", "orange");
    this._alarms.set("Fire", "red");

    this.state = {
      currentTab: 0, sensor: "0", startTime: this.props.dataProvider.minDate, endTime: this.props.dataProvider.maxDate,
      monitorTime: this.props.dataProvider.monitorTime,
      alarm: (this.props.dataProvider.alarmText) ? this.props.dataProvider.alarmText : "None",
    };
  }

  private _handleSyncPropertiesChangeEvent = (args: SyncPropertiesChangeEventArgs) => {
    if (args.properties && args.properties.length) {
      for (const prop of args.properties) {
        if (prop.propertyName === this.props.dataProvider.monitorTimePropertyName) {
          this.setState((_prevState, props) => ({ monitorTime: props.dataProvider.monitorTime }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.alarmTextPropertyName) {
          this.setState((_prevState, props) => ({ alarm: props.dataProvider.alarmText }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.currentAnimationTypePropertyName) {
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.monitorModePropertyName) {
          this.setState((_prevState, props) => ({ currentTab: props.dataProvider.monitorMode ? 1 : 0 }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.startTimePropertyName) {
          this.setState((_prevState, props) => ({ startTime: props.dataProvider.startTime }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.endTimePropertyName) {
          this.setState((_prevState, props) => ({ endTime: props.dataProvider.endTime }));
          continue;
        }
      }
    }
  }

  public componentDidMount() {
    this.props.dataProvider.onSyncPropertiesChangeEvent.addListener(this._handleSyncPropertiesChangeEvent);
  }

  public componentWillUnmount() {
    this.props.dataProvider.onSyncPropertiesChangeEvent.removeListener(this._handleSyncPropertiesChangeEvent);
  }

  // called when a tab is changed
  private _onTabChange = (tabIndex: number) => {
    this.setState({ currentTab: tabIndex });
  }

  // called when the sensor is changed
  private _onSensorChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setState({ sensor: event.target.value });
  }

  // called when the start time is changed
  private _onStartTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) {
      const date = new Date(event.target.value);
      this.setState({ startTime: date });
    }
  }

  // called when the end time is changed
  private _onEndTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) {
      const date = new Date(event.target.value);
      this.setState({ endTime: date });
    }
  }

  // called when the monitor is changed
  private _onMonitorTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) {
      const date = new Date(event.target.value);
      this.setState({ monitorTime: date });
    }
  }

  // called when the color is changed
  private _onColorChange = (value: string) => {
    this.setState({ alarm: value });
  }

  // called when the Run button is pressed
  private _onRun = () => {
    // this._closeDialog();  // NOTE: to close the dialog, uncomment this line

    const { currentTab, sensor, startTime, endTime } = this.state;

    const properties = [];
    properties.push({ value: { value: this.props.dataProvider.getAnimationTypeFromString(sensor)}, propertyName: this.props.dataProvider.currentAnimationTypePropertyName });
    properties.push({ value: { value: startTime }, propertyName: this.props.dataProvider.startTimePropertyName });
    properties.push({ value: { value: endTime}, propertyName: this.props.dataProvider.endTimePropertyName });
    const monitorModeValue = 1 === currentTab ? true : false;
    properties.push({ value: { value: monitorModeValue }, propertyName: this.props.dataProvider.monitorModePropertyName });

    this.props.dataProvider.processChangesInUi(properties);
  }

  // user closed the modeless dialog
  private _onCancel = () => {
    this._closeDialog();
  }

  private _closeDialog = () => {
    ModelessDialogManager.closeDialog(IotSettingsDialog.id);
  }

  private getInputValue(date: Date) {
    const addZero = (i: number) => {
      return (i < 10) ? "0" + i : i;
    };

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minutes = date.getMinutes();
    return `${year}-${addZero(month)}-${addZero(day)}T${addZero(hour)}:${addZero(minutes)}`;
  }

  private renderHistoryContent() {
    const { sensor, startTime, endTime } = this.state;
    const start = this.getInputValue(startTime);
    const end = this.getInputValue(endTime);
    return (
      <>
        <span>Sensors</span>
        <Select className="classification-dialog-select" options={this._sensors} value={sensor} onChange={this._onSensorChange} />
        <span>Start Time</span>
        <Input className="time-input" type="datetime-local" value={start} min={start} onChange={this._onStartTimeChange} />
        <span>End Time</span>
        <Input className="time-input" type="datetime-local" value={end} max={end} onChange={this._onEndTimeChange} />
      </>
    );
  }

  private renderMonitorContent() {
    const { sensor, monitorTime, alarm } = this.state;
    const monitor = this.getInputValue(monitorTime);
    return (
      <>
        <span>Sensors</span>
        <Select className="classification-dialog-select" options={this._sensors} value={sensor} onChange={this._onSensorChange} />
        <span>Time</span>
        <Input className="time-input" type="datetime-local" value={monitor} min={monitor} onChange={this._onMonitorTimeChange} disabled={true} />
        <span>Alarm</span>
        <ColorPicker values={this._alarms} value={alarm} onColorChange={this._onColorChange} />
      </>
    );
  }

  private renderContent() {
    const { currentTab } = this.state;

    return (
      <div className="iot-settings-dialog">
        <Tabs defaultTab={currentTab} onClick={this._onTabChange} >
          <Tab label={this._historyLabel} />
          <Tab label={this._monitorLabel} />
        </Tabs>
        <div className="iot-settings-dialog-content">
          {currentTab === 0 && this.renderHistoryContent()}
          {currentTab === 1 && this.renderMonitorContent()}
        </div>
        <Button buttonType={ButtonType.Blue} onClick={this._onRun}>Run</Button>
      </div>
    );
  }

  /** @hidden */
  public render(): JSX.Element {
    return (
      <Dialog
        title={this._dialogTitle}
        opened={true}
        resizable={false}
        movable={true}
        modal={false}
        onClose={() => this._onCancel()}
        onEscape={() => this._onCancel()}
        width={350}
        height={200}
      >
        {this.renderContent()}
      </Dialog>
    );
  }
}

interface ColorPickerProps {
  values: Map<string, string>; // key is the value, value is the text color (for example "red")
  value: string;
  onColorChange: (color: string) => void;
}

interface ColorPickerState {
  showPopup: boolean;
}

class ColorPicker extends React.Component<ColorPickerProps, ColorPickerState> {
  private _target = React.createRef<HTMLButtonElement>();

  constructor(props: ColorPickerProps, context?: any) {
    super(props, context);

    this.state = { showPopup: false };
  }

  // set active tab
  private _onColorChange = (color: string) => {
    this._closePopup();
    if (this.props.onColorChange)
      this.props.onColorChange(color);
  }

  private _togglePopup = () => {
    this.setState((_prevState) => ({ showPopup: !_prevState.showPopup }));
  }

  private _closePopup = () => {
    this.setState((_prevState) => ({ showPopup: false }));
  }

  private renderPopup() {
    const { values } = this.props;
    return (
      <ul className="iot-color-picker-popup-container">
        {Array.from(values.keys()).map((key: string) => {
          const color = values.get(key);
          return <li key={key} style={{ backgroundColor: color, borderColor: color }} onClick={this._onColorChange.bind(this, key)}>{key}</li>;
        })}
      </ul>
    );
  }

  public render() {
    const { values, value } = this.props;
    const { showPopup } = this.state;
    const buttonClassName = classnames("iot-color-picker-button", this.state.showPopup && "opened");

    return (
      <>
        <button onClick={this._togglePopup} className={buttonClassName} style={{ backgroundColor: values.get(value) }} ref={this._target} disabled={true}>
          <span>{value}</span>
          <span className="icon icon-chevron-down" />
        </button>
        <Popup
          className="iot-color-picker-popup"
          isOpen={showPopup}
          position={RelativePosition.Bottom}
          onClose={this._closePopup}
          target={this._target.current}>
          {this.renderPopup()}
        </Popup>
      </>
    );
  }
}

/**
 * Properties for the [[Tab]] component.
 * @hidden
 */
interface TabProps {
  label?: string;
  icon?: string;
  isSeparator?: boolean;
  index?: number;
  selectedTabIndex?: number;
  onTabClicked?: () => any;
}

/**
 * Specific Tab component for IModelIndex.
 * @hidden
 */
class Tab extends React.Component<TabProps> {

  constructor(props: TabProps, context?: any) {
    super(props, context);
  }

  public static defaultProps: Partial<TabProps> = {
    label: "",
    icon: "",
    selectedTabIndex: 0,
  };

  private _onClick = () => {
    if (this.props.onTabClicked) {
      this.props.onTabClicked();
    }
  }

  public render() {
    const isActive = this.props.index === this.props.selectedTabIndex!;
    const classes = classnames("tabs-style-linemove", isActive && "tab-active");
    const icon = classnames("icon", this.props.icon);
    return (
      <li className={classes} onClick={this._onClick}>
        <a>
          <span className={icon} />
          <span className="text">{this.props.label}</span>
        </a>
      </li>
    );
  }
}

/** Properties for the [[Tabs]] component
 * @hidden
 */
interface TabsProps {
  onClick?: (tabIndex: number) => any;
  defaultTab: number;
}

interface TabsState {
  activeTab: number;
}

/**
 * List of tabs.
 * @hidden
 */
class Tabs extends React.Component<TabsProps, TabsState> {

  constructor(props: TabsProps, context?: any) {
    super(props, context);

    this.state = { activeTab: this.props.defaultTab };
  }

  public componentDidUpdate() {
    if (this.props.defaultTab !== this.state.activeTab)
      this.setState((_, props) => ({ activeTab: props.defaultTab }));
  }

  // set active tab
  private _handleTabClick = (tabIndex: number, onTabClick: () => any) => {
    this.setState({ activeTab: tabIndex });

    // fire the tab onClick
    if (onTabClick) {
      onTabClick();
    }

    // fire the tabs onClick
    if (this.props.onClick)
      this.props.onClick(tabIndex);
  }

  private renderChildren() {
    return React.Children.map(this.props.children, (child: any, i) => {
      return React.cloneElement(child, {
        isActive: i === this.state.activeTab,
        index: i,
        selectedTabIndex: this.state.activeTab,
        onTabClicked: this._handleTabClick.bind(this, i, child.props.onTabClicked),
      });
    });
  }

  public render() {
    return (
      <div className="dialog-tabstrip">
        <nav>
          <ul>
            {this.renderChildren()}
          </ul>
        </nav>
      </div>
    );
  }
}
