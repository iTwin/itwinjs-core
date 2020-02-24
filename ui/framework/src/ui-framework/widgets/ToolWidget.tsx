/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

import { CommonProps, Icon } from "@bentley/ui-core";
import { AppButton, Tools as NZ_ToolsWidget, Direction } from "@bentley/ui-ninezone";

import { ToolWidgetProps, WidgetType } from "./WidgetDef";
import { ToolbarWidgetDefBase } from "./ToolbarWidgetBase";
import { CommandItemDef } from "../shared/CommandItemDef";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { UiShowHideManager } from "../utils/UiShowHideManager";

/** Definition of a Tool Widget normally displayed in the top left zone in the 9-Zone Layout system.
 *  @public @deprecated use ToolWidgetComposer instead
 */
export class ToolWidgetDef extends ToolbarWidgetDefBase {
  private _appButton: CommandItemDef | undefined;
  private _reactElement: React.ReactNode;

  constructor(props: ToolWidgetProps) {
    super(props);

    this._appButton = props.appButton;

    this.widgetType = WidgetType.Tool;
    this.verticalDirection = (props.verticalDirection !== undefined) ? props.verticalDirection : Direction.Right;

    const activeStageName = FrontstageManager.activeFrontstageDef ? FrontstageManager.activeFrontstageDef.id : "";
    this.widgetBaseName = `[${activeStageName}]ToolWidget`;
  }

  public get reactElement(): React.ReactNode {
    // istanbul ignore else
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
 *  @public @deprecated use ToolWidgetComposer instead
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
  toolWidgetDef: ToolWidgetDef; // tslint:disable-line:deprecation
}

/** ToolWidget React component.
 *  @public @deprecated use ToolWidgetComposer instead
 */
export class ToolWidget extends React.Component<ToolWidgetPropsEx, ToolWidgetState> { // tslint:disable-line:deprecation

  /** @internal */
  public readonly state: Readonly<ToolWidgetState>;

  constructor(props: ToolWidgetPropsEx) { // tslint:disable-line:deprecation
    super(props);

    this.state = { toolWidgetDef: new ToolWidgetDef(props) }; // tslint:disable-line:deprecation
  }

  public componentDidUpdate(prevProps: ToolWidgetPropsEx, _prevState: ToolWidgetState) { // tslint:disable-line:deprecation
    if (this.props !== prevProps) {
      this.setState((_, props) => ({ toolWidgetDef: new ToolWidgetDef(props) })); // tslint:disable-line:deprecation
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
  toolWidgetDef: ToolWidgetDef; // tslint:disable-line:deprecation
  button?: React.ReactNode;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

interface ToolWidgetWithDefState {
  horizontalToolbar: React.ReactNode;
  verticalToolbar: React.ReactNode;
  cornerItem: React.ReactNode;
}

/** Tool Widget React component.
 */
class ToolWidgetWithDef extends React.Component<Props, ToolWidgetWithDefState> {
  constructor(props: Props) {
    super(props);

    const horizontalToolbar = (this.props.horizontalToolbar) ? this.props.horizontalToolbar : this.props.toolWidgetDef.renderHorizontalToolbar();
    const verticalToolbar = (this.props.verticalToolbar) ? this.props.verticalToolbar : this.props.toolWidgetDef.renderVerticalToolbar();
    const cornerItem = (this.props.button !== undefined) ? this.props.button : this.props.toolWidgetDef.renderCornerItem();
    this.state = { horizontalToolbar, verticalToolbar, cornerItem };
  }

  private reloadToolbars() {
    const horizontalToolbar = (this.props.horizontalToolbar) ? this.props.horizontalToolbar : this.props.toolWidgetDef.renderHorizontalToolbar();
    const verticalToolbar = (this.props.verticalToolbar) ? this.props.verticalToolbar : this.props.toolWidgetDef.renderVerticalToolbar();
    this.setState({ horizontalToolbar, verticalToolbar });
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.props !== prevProps)
      this.reloadToolbars();
  }

  public render(): React.ReactNode {
    return (
      <NZ_ToolsWidget
        className={this.props.className}
        style={this.props.style}
        button={this.state.cornerItem}
        horizontalToolbar={this.state.horizontalToolbar}
        verticalToolbar={this.state.verticalToolbar}
        preserveSpace={true}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      />
    );
  }
}
