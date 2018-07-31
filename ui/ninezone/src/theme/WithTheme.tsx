/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Theme */

import * as React from "react";
import * as classnames from "classnames";
import ThemeContext from "./Context";
import { ClassNameProps } from "../utilities/Props";
import Theme from "./Theme";

export interface WithThemeProps {
  theme?: Theme;
}

export const withTheme = <ComponentProps extends ClassNameProps>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
): React.ComponentClass<ComponentProps & WithThemeProps> => {
  return class WithTheme extends React.Component<ComponentProps & WithThemeProps> {
    public getTheme(contextTheme: Theme): Theme {
      if (this.props.theme)
        return this.props.theme!;
      return contextTheme;
    }

    public render() {
      return (
        <ThemeContext.Consumer>
          {
            (theme) =>
              <Component
                {...this.props}
                className={classnames(this.props.className, `nz-theme-${this.getTheme(theme).name}`)}
              />
          }
        </ThemeContext.Consumer>
      );
    }
  };
};

export default withTheme;
