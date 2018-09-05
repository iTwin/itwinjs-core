/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";

import { IModelApp, SnapMode } from "@bentley/imodeljs-frontend";
import { ConfigurableUIActions } from "../state";
import { StatusBarFieldId, IStatusBar } from "../StatusBarWidgetControl";

import SnapModeIndicator from "@bentley/ui-ninezone/lib/footer/snap-mode/Indicator";
import SnapModeIcon from "@bentley/ui-ninezone/lib/footer/snap-mode/Icon";
import SnapModeDialog from "@bentley/ui-ninezone/lib/footer/snap-mode/Dialog";
import SnapRow from "@bentley/ui-ninezone/lib/footer/snap-mode/Snap";

export interface SnapModeFieldProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
  snapMode: number;
  setSnapMode: (mode: number) => any;
}

export interface SnapModeFieldEntry {
  label: string;
  value: number;
  iconName: string;
}

/** Snap Mode Field React component.
 */
export class SnapModeFieldComponent extends React.Component<SnapModeFieldProps> {
  private _className: string;
  private _snapModeFieldArray: SnapModeFieldEntry[] = [
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.keypoint"), value: SnapMode.NearestKeypoint as number, iconName: "snaps" },
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.intersection"), value: SnapMode.Intersection as number, iconName: "snaps-intersection" },
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.center"), value: SnapMode.Center as number, iconName: "snaps-center" },
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.nearest"), value: SnapMode.Nearest as number, iconName: "snaps-nearest" },
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.origin"), value: SnapMode.Origin as number, iconName: "snaps-origin" },
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.midpoint"), value: SnapMode.MidPoint as number, iconName: "snaps-midpoint" },
    { label: IModelApp.i18n.translate("UiFramework:snapModeField.bisector"), value: SnapMode.Bisector as number, iconName: "snaps-bisector" },
  ];

  constructor(props?: any, context?: any) {
    super(props, context);

    const instance = this.constructor;
    this._className = instance.name;
  }

  private getSnapModeIconNameFromMode(snapMode: number): string {
    for (const mode of this._snapModeFieldArray) {
      if (mode.value === snapMode)
        return mode.iconName;
    }

    if (snapMode > 0)
      return "snaps-multione";

    return "placeholder";
  }

  public render(): React.ReactNode {
    return (
      <SnapModeIndicator
        label={IModelApp.i18n.translate("UiFramework:snapModeField.snapMode")}
        isLabelVisible={this.props.isInFooterMode}
        onClick={this._handleSnapModeIndicatorClick}
        icon={
          <SnapModeIcon iconName={this.getSnapModeIconNameFromMode(this.props.snapMode)} className="nz-footer-icon" />
        }
        dialog={
          this.props.openWidget !== this._className ? undefined :
            <SnapModeDialog
              title={IModelApp.i18n.translate("UiFramework:snapModeField.snapMode")}
              snaps={this.getSnapEntries()}
            />
        }
      />
    );
  }

  private getSnapEntries(): JSX.Element[] {
    return this._snapModeFieldArray.map((item: SnapModeFieldEntry, index: number) => {
      return (
        <SnapRow
          key={`SM_${index}`}
          onClick={() => this._handleSnapModeFieldClick(item.value)}
          isActive={(this.props.snapMode & item.value) === item.value}
          label={item.label}
          icon={
            <SnapModeIcon isActive={(this.props.snapMode & item.value) === item.value}
              text={item.iconName} iconName={item.iconName} />
          }
        />
      );
    });
  }

  private _handleSnapModeFieldClick = (snapModeField: number) => {
    this.props.setSnapMode(snapModeField as number);
  }

  private _handleSnapModeIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private setOpenWidget(openWidget: StatusBarFieldId) {
    this.props.statusBar!.setOpenWidget(openWidget);
  }
}

// map dispatch to props requires SnapModeFieldProps interface above to include a setSnapModeField entry
const mapDispatch = {
  setSnapMode: ConfigurableUIActions.setSnapMode,
};

function mapStateToProps(state: any) {
  return { snapMode: state.frameworkState!.configurableUIState.snapMode };
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */ // tslint:disable-next-line:variable-name
export const SnapModeField = connect(mapStateToProps, mapDispatch)(SnapModeFieldComponent);
