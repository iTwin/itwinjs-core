/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Theme */

import * as React from "react";
import * as classnames from "classnames";
import ThemeContext from "./Context";
import { ClassNameProps } from "../utilities/Props";
import Theme from "./Theme";

/** Properties supplemented to components that are enhanced with [[withTheme]] HOC. */
export interface WithThemeProps {
  /** Explicit theme used by component. Takes precedence over [[ThemeContext]] */
  theme?: Theme;
}

/**
 * HOC which will supplement component with theme capabilities.
 * @note Component will be injected with class name: nz-theme-[[Theme.name]]
 */
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
