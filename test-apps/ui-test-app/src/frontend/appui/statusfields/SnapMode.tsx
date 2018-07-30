/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { StatusBarFieldId, IStatusBar } from "@bentley/ui-framework";

import SnapModeIndicator from "@bentley/ui-ninezone/lib/footer/snap-mode/Indicator";
import SnapModeIcon from "@bentley/ui-ninezone/lib/footer/snap-mode/Icon";
import SnapModeDialog from "@bentley/ui-ninezone/lib/footer/snap-mode/Dialog";
import SnapRow from "@bentley/ui-ninezone/lib/footer/snap-mode/Snap";

export interface SnapModeProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

/** Snap Mode Field React component.
 */
export class SnapModeField extends React.Component<SnapModeProps> {
  private _className: string;

  constructor(p: SnapModeProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;
  }

  // TODO !!!
  public render(): React.ReactNode {
    return (
      <SnapModeIndicator
        label={IModelApp.i18n.translate("SampleApp:snapMode.snapMode")}
        isLabelVisible={this.props.isInFooterMode}
        onIndicatorClick={this.handleSnapModeIndicatorClick}
        icon={
          <SnapModeIcon text="k" />
        }
        dialog={
          <SnapModeDialog
            isOpen={this.props.openWidget === this._className}
            title="Snap Mode"
            snaps={[
              <SnapRow
                key="1"
                isActive
                label={IModelApp.i18n.translate("SampleApp:snapMode.keypoint")}
                icon={
                  <SnapModeIcon isActive text="k" />
                }
              />,
              <SnapRow
                key="2"
                label={IModelApp.i18n.translate("SampleApp:snapMode.intersection")}
                icon={
                  <SnapModeIcon text="i" />
                }
              />,
              <SnapRow
                key="3"
                label={IModelApp.i18n.translate("SampleApp:snapMode.center")}
                icon={
                  <SnapModeIcon text="c" />
                }
              />,
              <SnapRow
                key="4"
                label={IModelApp.i18n.translate("SampleApp:snapMode.nearest")}
                icon={
                  <SnapModeIcon text="n" />
                }
              />,
            ]}
          />
        }
      />
    );
  }

  private handleSnapModeIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private setOpenWidget(openWidget: StatusBarFieldId) {
    this.props.statusBar.setOpenWidget(openWidget);
  }

}
