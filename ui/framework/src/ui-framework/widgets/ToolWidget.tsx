/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { ToolWidgetProps, WidgetType } from "./WidgetDef";
import { ToolbarWidgetDefBase } from "./ToolbarWidgetBase";
import { CommandItemDef } from "../shared/CommandItemDef";
import { Icon } from "../shared/IconComponent";
import { FrontstageManager, ToolActivatedEventArgs } from "../frontstage/FrontstageManager";
import { UiShowHideManager } from "../utils/UiShowHideManager";

import { AppButton, Tools as NZ_ToolsWidget } from "@bentley/ui-ninezone";
import { CommonProps } from "@bentley/ui-core";

/** A Tool Widget normally displayed in the top left zone in the 9-Zone Layout system.
 * @public
 */
export class ToolWidgetDef extends ToolbarWidgetDefBase {
  private _appButton: CommandItemDef | undefined;
  private _reactElement: React.ReactNode;

  constructor(def: ToolWidgetProps) {
    super(def);

    this._appButton = def.appButton;

    this.widgetType = WidgetType.Tool;
  }

  public get reactElement(): React.ReactNode {
    if (!this._reactElement)
      this._reactElement = <ToolWidgetWithDef toolWidgetDef={this} />;

    return this._reactElement;
  }

  public renderCornerItem(): React.ReactNode | undefined {
    if (this._appButton) {
      return (
        <AppButton
          onClick={this._appButton.execute}
          icon={
            <Icon iconSpec={this._appButton.iconSpec} />
          }
        />
      );
    }

    return undefined;
  }
}

/** Properties for the [[ToolWidget]] React component.
 * @public
 */
export interface ToolWidgetPropsEx extends ToolWidgetProps, CommonProps {
  button?: React.ReactNode;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

/** State for the [[ToolWidget]] React component.
 * @internal
 */
interface ToolWidgetState {
  toolWidgetDef: ToolWidgetDef;
}

/** ToolWidget React component.
 * @public
 */
export class ToolWidget extends React.Component<ToolWidgetPropsEx, ToolWidgetState> {

  /** @internal */
  public readonly state: Readonly<ToolWidgetState>;

  constructor(props: ToolWidgetPropsEx) {
    super(props);

    this.state = { toolWidgetDef: new ToolWidgetDef(props) };
  }

  public componentDidUpdate(prevProps: ToolWidgetPropsEx, _prevState: ToolWidgetState) {
    if (this.props !== prevProps) {
      this.setState({ toolWidgetDef: new ToolWidgetDef(this.props) });
    }
  }

  public render(): React.ReactNode {
    return (
      <ToolWidgetWithDef
        className={this.props.className}
        style={this.props.style}
        toolWidgetDef={this.state.toolWidgetDef}
        button={this.props.button}
        horizontalToolbar={this.props.horizontalToolbar}
        verticalToolbar={this.props.verticalToolbar}
      />
    );
  }
}

/** Properties for the Tool Widget React component.
 */
interface Props extends CommonProps {
  toolWidgetDef: ToolWidgetDef;
  button?: React.ReactNode;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

/** Tool Widget React component.
 */
class ToolWidgetWithDef extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  private _handleToolActivatedEvent = (args: ToolActivatedEventArgs): void => {
    this.setState((_prevState, _props) => {
      const toolId = args.toolId;
      return {
        toolId,
      };
    });
  }

  public componentDidMount() {
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.onToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
  }

  public render(): React.ReactNode {
    const button = (this.props.button !== undefined) ? this.props.button : this.props.toolWidgetDef.renderCornerItem();
    const horizontalToolbar = (this.props.horizontalToolbar) ? this.props.horizontalToolbar : this.props.toolWidgetDef.renderHorizontalToolbar();
    const verticalToolbar = (this.props.verticalToolbar) ? this.props.verticalToolbar : this.props.toolWidgetDef.renderVerticalToolbar();

    return (
      <NZ_ToolsWidget
        className={this.props.className}
        style={this.props.style}
        button={button}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
        preserveSpace={true}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      />
    );
  }
}
