/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { IStatusBar, StatusBarFieldId, FrontstageManager } from "@bentley/ui-framework";
import { ToolAssistanceIndicator, ToolAssistanceDialog as ToolAssistanceDialogComponent } from "@bentley/ui-ninezone";
import { withOnOutsideClick } from "@bentley/ui-core";

// tslint:disable-next-line: variable-name
const ToolAssistanceDialog = withOnOutsideClick(ToolAssistanceDialogComponent, undefined, false);

export interface ToolAssistanceProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

/** Tool Assistance Field React component.
 */
export class ToolAssistanceField extends React.Component<ToolAssistanceProps> {
  private _className: string;

  constructor(p: ToolAssistanceProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;
  }

  // TODO !!!
  public render(): React.ReactNode {
    return (
      <ToolAssistanceIndicator
        dialog={
          this.props.openWidget !== this._className ? undefined : (
            <ToolAssistanceDialog
              items={FrontstageManager.activeToolAssistanceNode}
              onOutsideClick={this._handleDialogOutsideClick}
              title={IModelApp.i18n.translate("SampleApp:toolAssist.title")}
            />
          )
        }
        icons={
          <>
            <i className="icon icon-placeholder" />
            <i className="icon icon-placeholder" />
          </>
        }
        isStepStringVisible={this.props.isInFooterMode}
        onClick={this._handleToolAssistanceIndicatorClick}
        stepString={IModelApp.i18n.translate("SampleApp:toolAssist.startPoint")}
      />
    );
  }

  private _handleToolAssistanceIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private _handleDialogOutsideClick = () => {
    this.setOpenWidget(null);
  }

  private setOpenWidget(openWidget: StatusBarFieldId) {
    this.props.statusBar.setOpenWidget(openWidget);
  }
}
