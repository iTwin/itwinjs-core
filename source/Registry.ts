/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:ban-types
export class Registry {
  public static elements: Map<string, any> = new Map<string, any>();

  public static createElement(args: any) {
    const className = args.className;
    if (!className)
      throw Error;

    const factory = Registry.elements.get(className.toLowerCase());
    return factory ? new factory(args) : undefined;
  }
}

export const registerElement = (className: string) => (ctor: Function) => {
  Registry.elements.set(className.toLowerCase(), ctor);
};
