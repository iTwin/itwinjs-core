/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

import * as React from "react";
import { connect } from "react-redux";
import { UiFramework } from "../UiFramework";
import { ColorTheme } from "../overallcontent/state";

/** Properties of [[ThemeManagerComponent]]. */
interface ThemeProps {
  /** theme ("light", "dark", etc.) */
  theme: ColorTheme;
}

function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey];  // since app sets up key, don't hard-code name
  if (!frameworkState)
    return undefined;

  return { theme: frameworkState.overallContentState.theme };
}

/** ThemeManagerComponent handles setting themes. */
export class ThemeManagerComponent extends React.Component<ThemeProps> {

  public componentDidMount() {
    this._addTheme(this.props.theme);
  }

  public componentWillReceiveProps(nextProps: ThemeProps) {
    if (nextProps.theme !== this.props.theme) {
      this._addTheme(nextProps.theme);
    }
  }

  private _addTheme = (theme: string) => {
    document.documentElement.classList.add("theme-transition");
    document.documentElement.setAttribute("data-theme", theme);
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 1000);
  }

  public render(): React.ReactNode {
    return this.props.children;
  }
}

/** ThemeManager React component that is Redux connected. */
export const ThemeManager = connect(mapStateToProps)(ThemeManagerComponent); // tslint:disable-line:variable-name
