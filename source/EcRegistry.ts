/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECClass, FullClassName, ECClassFullname } from "./Element";
import { IModel } from "./IModel";

/** The mapping between EC class name and the factory to create instances */
export class EcRegistry {
  public static ecClasses: Map<string, any> = new Map<string, any>();

  public static getFullNameForECClass(fn: ECClassFullname): FullClassName {
    return {schemaName: fn.schema, className: fn.name};
  }

  public static getECClassFullNameAsKey(ecclass: ECClassFullname) {
    return (ecclass.schema + "." + ecclass.name).toLowerCase();
  }

  public static create(args: FullClassName, defaultClass?: string): any | undefined {
    if (!args.className || !args.schemaName)
      return undefined;

    let factory = EcRegistry.ecClasses.get(EcRegistry.getECClassFullNameAsKey({schema: args.schemaName, name: args.className}));
    if (!factory && defaultClass)
      factory = EcRegistry.ecClasses.get(defaultClass.toLowerCase());
    return factory ? new factory(args) : undefined;
  }

  /**
   * Generate a JS class from an ECClass definition
   * @param ecclass The ECClass definition
   */
  public static generateClassDefFromECClass(ecclass: ECClass): string {
    let def: string = "";
    // class
    def = def + "class " + ecclass.name;

    //        extends
    if (ecclass.baseClasses.length !== 0) {
        def = def + " extends";
        let sep = " ";
        for (const base of ecclass.baseClasses) {
          def = def + sep + "EcRegistry.ecClasses.get('" + EcRegistry.getECClassFullNameAsKey(base) + "')";
          sep = ",";
          break; // *** WIP_IMODELJS -- JS has only single inheritance. In order to handle mixins, we have to write functions that actually merge them into the single prototype for the class.
                 // ***   https://addyosmani.com/resources/essentialjsdesignpatterns/book/#mixinpatternjavascript
        }
    }

    // constructor
    def = def + "{ constructor(opts) {";

    //    super
    if (ecclass.baseClasses.length !== 0)
      def = def + " super(opts);";

    //    prop = opt
    for (const propname of Object.getOwnPropertyNames(ecclass.properties)) {
      def = def + "  this." + propname + " = opts." + propname + ";";
    }
    def = def + "  }";

    // end of class
    def = def + "}";
    return def;
  }

  public static registerEcClass(fullname: string, ctor: any) {
    EcRegistry.ecClasses.set(fullname.toLowerCase(), ctor);
    // console.log("registerEcClass " + fullname);
  }

  public static registerEcClass2(schemaName: string, ctor: any) {
    EcRegistry.ecClasses.set((schemaName + "." + ctor.name).toLowerCase(), ctor);
    // console.log("registerEcClass " + fullname);
  }

  /* This function generates a JS class for the specified ECClass and registers it. It also ensures that
      all of the base classes of the ECClass exist and are registered. */
  public static async generateClassFromFullName(fullClassName: FullClassName, imodel: IModel): Promise<any> {
    const ecclassJson = await imodel.getDgnDb().getECClassMetaData(fullClassName.schemaName, fullClassName.className);
    if (null == ecclassJson) {
      return undefined;
    }
    const ecclass: ECClass = JSON.parse(ecclassJson);

    // Make sure that we have all base classes registered.
    // This recurses. I have to know that the super class is defined and registered before defining a derived class.
    // Therefore, I must await getRegisteredClass.
    if (ecclass.baseClasses.length !== 0) {
      for (const base of ecclass.baseClasses) {
        if (!await EcRegistry.getRegisteredClass(base, imodel))
          return undefined;
      }
    }

    // Generate and register this class
    let jsDef: string = EcRegistry.generateClassDefFromECClass(ecclass);
    const fullname = EcRegistry.getECClassFullNameAsKey(ecclass);
    jsDef = jsDef + ' EcRegistry.registerEcClass("' + fullname + '",' + ecclass.name + ");";
    jsDef = jsDef + " " + ecclass.name + ".ecClass=ecclass;";
    eval(jsDef); // eval is OK here, because I generated the expression myself, and I know it's safe.

    return EcRegistry.ecClasses.get(fullname);
  }

  public static async generateClassFromECClassName(ecclass: ECClassFullname, imodel: IModel): Promise<any> {
    return EcRegistry.generateClassFromFullName(EcRegistry.getFullNameForECClass(ecclass), imodel);
  }

  public static async getRegisteredClass(ecclass: ECClassFullname, imodel: IModel): Promise<any> {
    const key = EcRegistry.getECClassFullNameAsKey(ecclass);
    if (!EcRegistry.ecClasses.has(key)) {
      return EcRegistry.generateClassFromECClassName(ecclass, imodel);
    }
    return EcRegistry.ecClasses.get(key);
  }

}
