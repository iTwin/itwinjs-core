/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ClassDef, ECClassCtor, ECClass, ECClassFullname, ECClassProps } from "./ECClass";
import { IModel } from "./IModel";
import { Schema, Schemas } from "./Schema";

/** The mapping between a class name and its constructor function  */
export class ClassRegistry {
  public static ecClasses: Map<string, ECClassCtor> = new Map<string, ECClassCtor>();

  private static getClassRegistryKey(schemaName: string, className: string) {
    return (schemaName + "." + className).toLowerCase();
  }

  private static getClassRegistryKeyFromECClassFullname(fullname: ECClassFullname) {
    return ClassRegistry.getClassRegistryKey(fullname.schema, fullname.name);
  }

  private static getClassRegistryKeyFromIECInstance(inst: ECClassProps) {
    return ClassRegistry.getClassRegistryKey(inst.schemaName, inst.className);
  }

  /** create an instance of a class from it properties */
  public static async createInstance(props: ECClassProps): Promise<ECClass | undefined> {
    if (!props.className || !props.schemaName)
      return undefined;

    let ctor = ClassRegistry.ecClasses.get(ClassRegistry.getClassRegistryKeyFromIECInstance(props));
    if (!ctor) {
      ctor = await ClassRegistry.generateClass(props.schemaName, props.className, props.iModel);
    }
    return ctor ? new ctor(props) : undefined;
  }

  public static registerSchema(schema: Schema) { Schemas.registerSchema(schema); }
  public static getRegisteredSchema(domainName: string) { return Schemas.getRegisteredSchema(domainName); }
  public static getSchemaBaseClass(): any { return Schema; }

  private static generateProxySchema(schemaName: string): string {
    let def = "class " + schemaName + " extends ClassRegistry.getSchemaBaseClass(){constructor(){super();}}";
    // register it here, while we are in the scope in which `schemaName` is actually defined as a class.
    def = def + " ClassRegistry.registerSchema(" + schemaName + ");";
    return def;
  }

  /**
   * Generate a JS class from an ECClass definition
   * @param ecClass The ECClass definition
   */
  private static generateClassDefFromECClass(ecClass: ClassDef): string {
    let domainDef = "";

    // schema
    const schema: Schema = Schemas.getRegisteredSchema(ecClass.schema);
    if (!schema) {
      domainDef = domainDef + ClassRegistry.generateProxySchema(ecClass.schema);
    }

    // static properties
    const classDefStaticProps = " " + ecClass.name + ".schema = ClassRegistry.getRegisteredSchema('" + ecClass.schema + "');";

    // extends
    let classDefExtends = "";
    if (ecClass.baseClasses.length !== 0) {
      classDefExtends = " extends ClassRegistry.ecClasses.get('" + ClassRegistry.getClassRegistryKeyFromECClassFullname(ecClass.baseClasses[0]) + "')";
      // *** WIP_IMODELJS -- JS has only single inheritance. In order to handle mixins, we have to write functions that actually merge them into the single prototype for the class.
      // ***   https://addyosmani.com/resources/essentialjsdesignpatterns/book/#mixinpatternjavascript
    }
    // constructor
    let classDefCtor = "{constructor(props){";

    // super
    if (ecClass.baseClasses.length !== 0)
      classDefCtor = classDefCtor + "super(props);";

    // this.prop = props
    for (const propName of Object.getOwnPropertyNames(ecClass.properties)) {
      classDefCtor = classDefCtor + " this." + propName + "=props." + propName + ";";
    }
    classDefCtor = classDefCtor + "}}";

    // The class as a whole
    return domainDef + "class " + ecClass.name + classDefExtends + classDefCtor + classDefStaticProps;
  }

  public static registerEcClass(ctor: ECClassCtor) {
    const key = ClassRegistry.getClassRegistryKey(ctor.schema.name, ctor.name);
    ClassRegistry.ecClasses.set(key, ctor);
  }

  /** register all of the classes that derive from ECClass, that are found in a given module
   * @param moduleObj The module to search for subclasses of ECClass
   * @param schema The schema for all found classes
   */
  public static registerModuleClasses(moduleObj: any, schema: Schema) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

      const thisClass = moduleObj[thisMember];
      if (thisClass instanceof ECClass.constructor) {
        thisClass.schema = schema;
        ClassRegistry.registerEcClass(thisClass);
      }
    }
  }

  /** This function fetches the specified ECClass from the imodel, generates a JS class for it, and registers the generated
   *  class. This function also ensures that all of the base classes of the ECClass exist and are registered.
   */
  private static async generateClass(schemaName: string, className: string, imodel: IModel): Promise<ECClassCtor | undefined> {
    const ecclassJson = await imodel.dgnDb.getECClassMetaData(schemaName, className);
    if (null == ecclassJson)
      return undefined;

    const ecclass: ClassDef = JSON.parse(ecclassJson);

    // Make sure that we have all base classes registered.
    // This recurses. I have to know that the super class is defined and registered before defining a derived class.
    // Therefore, I must await getRegisteredClass.
    if (ecclass.baseClasses.length !== 0) {
      for (const base of ecclass.baseClasses) {
        if (!await ClassRegistry.getClass(base, imodel))
          return undefined;
      }
    }

    // Now we can generate the class from the classDef.
    return ClassRegistry.generateClassForECClass(ecclass);
  }

  /** This function generates a JS class for the specified ECClass and registers it. It is up to the caller
   *  to make sure that all superclasses are already registered.
   */
  public static generateClassForECClass(ecclass: ClassDef): ECClassCtor {
    // Generate and register this class
    const jsDef = ClassRegistry.generateClassDefFromECClass(ecclass) + " ClassRegistry.registerEcClass(" + ecclass.name + "); " + ecclass.name + ".ecClass=ecclass;";

    // tslint:disable-next-line:no-eval NOTE: eval is OK here, because I generated the expression myself, and I know it's safe.
    eval(jsDef);

    return ClassRegistry.ecClasses.get(ClassRegistry.getClassRegistryKeyFromECClassFullname(ecclass))!;
  }

  /**
   * Get the class for the specified ECClass.
   * @param ecclassFullName The name of the ECClass
   * @param imodel The IModel that contains the class definitions
   * @return The corresponding class
   */
  public static async getClass(ecclassFullName: ECClassFullname, imodel: IModel): Promise<ECClassCtor | undefined> {
    const key = ClassRegistry.getClassRegistryKeyFromECClassFullname(ecclassFullName);
    if (!ClassRegistry.ecClasses.has(key)) {
      return ClassRegistry.generateClass(ecclassFullName.schema, ecclassFullName.name, imodel);
    }
    return ClassRegistry.ecClasses.get(key);
  }

  /**
   * Check if the class for the specified ECClass is in the registry.
   * @param ecclassFullName The name of the ECClass
   */
  public static isClassRegistered(schemaName: string, className: string): boolean {
    return ClassRegistry.ecClasses.has(ClassRegistry.getClassRegistryKey(schemaName, className));
  }
}
