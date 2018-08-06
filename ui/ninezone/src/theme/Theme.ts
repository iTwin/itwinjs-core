/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Theme */

/** Describes theme of 9-Zone UI. */
export default interface Theme {
  /** Theme name. This will be injected to themed component class name as nz-theme-themeName  */
  name: string;
}

class Primary implements Theme {
  public get name() {
    return "primary";
  }
}

class Light implements Theme {
  public get name() {
    return "light";
  }
}

class Dark implements Theme {
  public get name() {
    return "dark";
  }
}

/** Primary (default) theme of 9-Zone UI. */
// tslint:disable-next-line:variable-name
export const PrimaryTheme: Theme = new Primary();

/** Light theme. */
// tslint:disable-next-line:variable-name
export const LightTheme: Theme = new Light();

/** Dark theme. */
// tslint:disable-next-line:variable-name
export const DarkTheme: Theme = new Dark();
