/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Theme */

export default interface Theme {
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

// tslint:disable-next-line:variable-name
export const PrimaryTheme: Theme = new Primary();

// tslint:disable-next-line:variable-name
export const LightTheme: Theme = new Light();

// tslint:disable-next-line:variable-name
export const DarkTheme: Theme = new Dark();
