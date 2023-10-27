/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { connect } from "react-redux";
import { SnapMode } from "@itwin/core-frontend";
import { Snap, SnapModePanel } from "@itwin/appui-layout-react";
import { ConfigurableUiActions } from "../configurableui/state";
import { UiFramework } from "../UiFramework";
import { StatusFieldProps } from "./StatusFieldProps";
import { Indicator } from "./Indicator";

// cSpell:ignore multione
/** Defines properties supported by the SnapMode Field Component.
 */
interface SnapModeFieldProps extends StatusFieldProps {
  snapMode: number;
  setSnapMode: (mode: number) => any;
}

/** Define the properties that will be used to represent the available snap modes. */
interface SnapModeFieldEntry {
  label: string;
  value: number;
  iconName: string;
}

interface SnapModeFieldState {
  target: HTMLElement | null;
}

/**
 * Snap Mode Field React component. This component is designed to be specified in a status bar definition. It will
 * display the active snap mode that AccuSnap will use and allow the user to select a new snap mode.
 */
class SnapModeFieldComponent extends React.Component<SnapModeFieldProps, SnapModeFieldState> {
  private _snapModeFieldArray: SnapModeFieldEntry[] = [
    { label: UiFramework.translate("snapModeField.keypoint"), value: SnapMode.NearestKeypoint as number, iconName: "snaps" },
    { label: UiFramework.translate("snapModeField.intersection"), value: SnapMode.Intersection as number, iconName: "snaps-intersection" },
    { label: UiFramework.translate("snapModeField.center"), value: SnapMode.Center as number, iconName: "snaps-center" },
    { label: UiFramework.translate("snapModeField.nearest"), value: SnapMode.Nearest as number, iconName: "snaps-nearest" },
    { label: UiFramework.translate("snapModeField.origin"), value: SnapMode.Origin as number, iconName: "snaps-origin" },
    { label: UiFramework.translate("snapModeField.midpoint"), value: SnapMode.MidPoint as number, iconName: "snaps-midpoint" },
    { label: UiFramework.translate("snapModeField.bisector"), value: SnapMode.Bisector as number, iconName: "snaps-bisector" },
  ];
  private _title = UiFramework.translate("snapModeField.snapMode");

  public override readonly state: SnapModeFieldState = {
    target: null,
  };

  constructor(props: SnapModeFieldProps) {
    super(props);
  }

  /** Return icon class name for a specific snapMode. */
  private getSnapModeIconNameFromMode(snapMode: number): string {
    for (const mode of this._snapModeFieldArray) {
      if (mode.value === snapMode)
        return mode.iconName;
    }

    /* istanbul ignore else */
    if (snapMode > 0)
      return "snaps-multione";

    /* istanbul ignore next */
    return "placeholder";
  }

  /** Standard React render method. */
  public override render(): React.ReactNode {
    return (
      <>
        <Indicator // eslint-disable-line deprecation/deprecation
          iconName={`icon-${this.getSnapModeIconNameFromMode(this.props.snapMode)}`}
          toolTip={this._title}
          label={this._title}
          isLabelVisible={true}
          dialog={
            <SnapModePanel title={this._title}>
              {this.getSnapEntries()}
            </SnapModePanel>
          }
        />
      </>
    );
  }

  /** Return array of SnapRow elements, one for each support snap mode. This array will populate the pop-up used
    * to select a SnapMode.
    */
  private getSnapEntries(): React.ReactElement[] {
    return this._snapModeFieldArray.map((item: SnapModeFieldEntry, index: number) => {
      return (
        <Snap
          key={`SM_${index}`}
          onClick={() => this._handleSnapModeFieldClick(item.value)}
          isActive={(this.props.snapMode & item.value) === item.value}
          icon={
            <i className={`icon icon-${item.iconName}`} />
          }
        >
          {item.label}
        </Snap >
      );
    });
  }

  /** Called when user clicks on a Snap Mode entry in the pop-up window. */
  private _handleSnapModeFieldClick = (snapModeField: number) => {
    this.props.setSnapMode(snapModeField);
  };

}

// Used by Redux to map dispatch functions to props entry. This requires SnapModeFieldProps interface above to include a setSnapMode entry */
const mapDispatch = {
  setSnapMode: ConfigurableUiActions.setSnapMode,
};

/** Function used by Redux to map state data in Redux store to props that are used to render this component. */
function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey];  // since app sets up key, don't hard-code name
  /* istanbul ignore next */
  if (!frameworkState)
    return undefined;

  return { snapMode: frameworkState.configurableUiState.snapMode };
}

// we declare the variable and export that rather than using export default.
/**
 * Snap Mode Field React component. This component is designed to be specified in a status bar definition. It will
 * display the active snap mode that AccuSnap will use and allow the user to select a new snap mode.
 * This Field React component is Redux connected.
 * @public
 */ // eslint-disable-next-line @typescript-eslint/naming-convention
export const SnapModeField = connect(mapStateToProps, mapDispatch)(SnapModeFieldComponent);
