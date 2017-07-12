/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

 /** The mapping between EC class name and the factory to create instances */
export class EcRegistry {
  public static ecClasses: Map<string, any> = new Map<string, any>();

  public static create(args: any): any | undefined {
    if (!args.className || !args.schemaName)
      return undefined;

    const factory = EcRegistry.ecClasses.get((args.schemaName + "." + args.className).toLowerCase());
    return factory ? new factory(args) : undefined;
  }
}

/** Decorator function for classes that handle an EC class */
export const registerEcClass = (className: string) => (ctor: any) => {
  EcRegistry.ecClasses.set(className.toLowerCase(), ctor);
};
