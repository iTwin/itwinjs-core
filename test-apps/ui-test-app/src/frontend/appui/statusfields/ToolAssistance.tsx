/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { IStatusBar, StatusBarFieldId, FrontstageManager } from "@bentley/ui-framework";
import { ToolAssistance, ToolAssistanceDialog, FooterPopup } from "@bentley/ui-ninezone";

export interface ToolAssistanceProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

/** Tool Assistance Field React component.
 */
export class ToolAssistanceField extends React.Component<ToolAssistanceProps> {
  private _className: string;
  private _target = React.createRef<HTMLDivElement>();
  private _indicator = React.createRef<HTMLDivElement>();

  constructor(p: ToolAssistanceProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;
  }

  // TODO !!!
  public render(): React.ReactNode {
    return (
      <>
        <div ref={this._target}>
          <ToolAssistance
            icons={
              <>
                <i className="icon icon-placeholder" />
                <i className="icon icon-placeholder" />
              </>
            }
            indicatorRef={this._indicator}
            isInFooterMode={this.props.isInFooterMode}
            onClick={this._handleToolAssistanceIndicatorClick}
          >
            {this.props.isInFooterMode ? IModelApp.i18n.translate("SampleApp:toolAssist.startPoint") : undefined}
          </ToolAssistance>
        </div>
        <FooterPopup
          isOpen={this.props.openWidget === this._className}
          onClose={this._handleClose}
          onOutsideClick={this._handleOutsideClick}
          target={this._target}
        >
          <ToolAssistanceDialog
            title={IModelApp.i18n.translate("SampleApp:toolAssist.title")}
          >
            {FrontstageManager.activeToolAssistanceNode}
          </ToolAssistanceDialog>
        </FooterPopup>
      </>
    );
  }

  private _handleClose = () => {
    this.setOpenWidget(null);
  }

  private _handleOutsideClick = (e: MouseEvent) => {
    if (!this._indicator.current ||
      !(e.target instanceof Node) ||
      this._indicator.current.contains(e.target))
      return;

    this._handleClose();
  }

  private _handleToolAssistanceIndicatorClick = () => {
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
