/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IECInstance } from "./Element";
import { ECClass, ECClassFullname } from "./ECClass";
import { IModel } from "./IModel";
import { Schema, Schemas } from "./Schema";

/** The mapping between EC class name and the factory to create instances */
export class EcRegistry {
  public static ecClasses: Map<string, any> = new Map<string, any>();

  public static getEcRegistryKey(schemaName: string, className: string) {
    return (schemaName + "." + className).toLowerCase();
  }

  public static getEcRegistryKeyFromECClassFullname(fullname: ECClassFullname) {
    return EcRegistry.getEcRegistryKey(fullname.schema, fullname.name);
  }

  public static getEcRegistryKeyFromIECInstance(inst: IECInstance) {
    return EcRegistry.getEcRegistryKey(inst.schemaName, inst.className);
  }

  public static create(args: IECInstance, defaultClass?: string): any | undefined {
    if (!args.className || !args.schemaName)
      return undefined;

    let factory = EcRegistry.ecClasses.get(EcRegistry.getEcRegistryKeyFromIECInstance(args));
    if (!factory && defaultClass)
      factory = EcRegistry.ecClasses.get(defaultClass.toLowerCase());
    return factory ? new factory(args) : undefined;
  }

  public static GetSchemaBaseClass(): any { return Schema; }

  public static generateProxySchema(schemaName: string): string {
    let def: string = "";
    def = def + "class " + schemaName + " extends EcRegistry.GetSchemaBaseClass() {";
    def = def + "  constructor() { super(); }";
    def = def + "}";
    // register it here, while we are in the scope in which `schemaName` is actually defined as a class.
    def = def + " EcRegistry.registerSchema(" + schemaName + ");";
    return def;
  }

  public static registerSchema(schema: Schema) {
    Schemas.registerSchema(schema);
  }

  public static getRegisteredSchema(domainName: string) {
    return Schemas.getRegisteredSchema(domainName);
  }

  /**
   * Generate a JS class from an ECClass definition
   * @param ecclass The ECClass definition
   */
  public static generateClassDefFromECClass(ecclass: ECClass): string {
    let domainDef: string = "";

    // schema
    const schema: Schema = Schemas.getRegisteredSchema(ecclass.schema);
    if (!schema) {
      domainDef = domainDef + EcRegistry.generateProxySchema(ecclass.schema);
    }

    // static properties
    let classDefStaticProps: string = "";
    classDefStaticProps = classDefStaticProps + " " + ecclass.name + ".schema = EcRegistry.getRegisteredSchema('" + ecclass.schema + "');";

    //        extends
    let classDefExtends: string = "";
    if (ecclass.baseClasses.length !== 0) {
        classDefExtends = classDefExtends + " extends";
        let sep = " ";
        for (const base of ecclass.baseClasses) {
          classDefExtends = classDefExtends + sep + "EcRegistry.ecClasses.get('" + EcRegistry.getEcRegistryKeyFromECClassFullname(base) + "')";
          sep = ",";
          break; // *** WIP_IMODELJS -- JS has only single inheritance. In order to handle mixins, we have to write functions that actually merge them into the single prototype for the class.
                 // ***   https://addyosmani.com/resources/essentialjsdesignpatterns/book/#mixinpatternjavascript
        }
    }
    // constructor
    let classDefCtor: string = " constructor(opts) {";

    //    super
    if (ecclass.baseClasses.length !== 0)
      classDefCtor = classDefCtor + " super(opts);";

    //    prop = opt
    for (const propname of Object.getOwnPropertyNames(ecclass.properties)) {
      classDefCtor = classDefCtor + "  this." + propname + " = opts." + propname + ";";
    }
    classDefCtor = classDefCtor + "  }";

    // The class a whole
    let classDef: string = "class " + ecclass.name;
    classDef = classDef + classDefExtends;
    classDef = classDef + " {";
    classDef = classDef + classDefCtor;
    classDef = classDef + "}";
    classDef = classDef + classDefStaticProps;

    return domainDef + classDef;
  }

  public static registerEcClass(ctor: any) {
    const key = EcRegistry.getEcRegistryKey(ctor.schema.name, ctor.name);
    EcRegistry.ecClasses.set(key, ctor);
  }

  /* This function fetches the specified ECClass from the imodel, generates a JS class for it, and registers the generated
      class. This function also ensures that all of the base classes of the ECClass exist and are registered. */
  public static async generateClass(schemaName: string, className: string, imodel: IModel): Promise<any> {
    const ecclassJson = await imodel.getDgnDb().getECClassMetaData(schemaName, className);
    if (null == ecclassJson) {
      return undefined;
    }
    const ecclass: ECClass = JSON.parse(ecclassJson);

    // *** TBD: assert(ecclass.name == className, nocase);
    // *** TBD: assert(ecclass.schema == schemaName, nocase);

    // Make sure that we have all base classes registered.
    // This recurses. I have to know that the super class is defined and registered before defining a derived class.
    // Therefore, I must await getRegisteredClass.
    if (ecclass.baseClasses.length !== 0) {
      for (const base of ecclass.baseClasses) {
        if (!await EcRegistry.getClass(base, imodel))
          return undefined;
      }
    }

    // Now we can generate the class from the classdef.
    return EcRegistry.generateClassForECClass(ecclass);
  }

  /* This function generates a JS class for the specified ECClass and registers it. It is up to the caller
     to make sure that all superclasses are already registered.
   */
  public static generateClassForECClass(ecclass: ECClass): any {

    // Generate and register this class
    let jsDef: string = EcRegistry.generateClassDefFromECClass(ecclass);
    const fullname = EcRegistry.getEcRegistryKeyFromECClassFullname(ecclass);
    jsDef = jsDef + " EcRegistry.registerEcClass(" + ecclass.name + ");";
    jsDef = jsDef + " " + ecclass.name + ".ecClass=ecclass;";
    // tslint:disable-next-line:no-eval
    eval(jsDef); // eval is OK here, because I generated the expression myself, and I know it's safe.

    return EcRegistry.ecClasses.get(fullname);
  }

  /**
   * Get the class for the specified ECClass.
   * @param ecclassFullName The name of the ECClass
   * @param imodel        The IModel that contains the class definitions
   * @return The corresponding class
   */
  public static async getClass(ecclassFullName: ECClassFullname, imodel: IModel): Promise<any> {
    const key = EcRegistry.getEcRegistryKeyFromECClassFullname(ecclassFullName);
    if (!EcRegistry.ecClasses.has(key)) {
      return EcRegistry.generateClass(ecclassFullName.schema, ecclassFullName.name, imodel);
    }
    return EcRegistry.ecClasses.get(key);
  }

}
