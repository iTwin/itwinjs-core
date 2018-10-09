/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Config */
import { KnownRegions } from "./Client";

type ValueType = string | boolean | number;

/** Option to specify the version of the iModel to be acquired and used */
export class Config {
    private static _appConfig: Config;
    private _container: any = {};
    private _expanded: any = {};
    private constructor() { }

    private appendSystemVars() {
        this.set("imjs_env_dev", Number(KnownRegions.DEV));
        this.set("imjs_env_qa", Number(KnownRegions.QA));
        this.set("imjs_env_perf", Number(KnownRegions.PERF));
        this.set("imjs_env_prod", Number(KnownRegions.PROD));
        this.set("imjs_env_is_browser", Boolean(typeof window !== undefined));
        if (typeof process.env !== "undefined") {
            this.merge(process.env);
        }
    }

    /**
     * Expand var containing other vars as values.
     * This is strict function that will fail if recursion is detected or var name is not found.
     */
    private expand(name: string, value: any): any {
        if (typeof value !== "string")
            return value;

        const descriptor = Object.getOwnPropertyDescriptor(this._expanded, name);
        if (descriptor !== undefined) {
            return descriptor.value;
        }

        const vars: any = {};
        const matches = value.match(/\${[\w]+}/g);
        if (matches === null)
            return value;

        matches.forEach((element: string) => {
            const varName: string = element.match(/\${([\w]+)}/)![1];
            if (!vars.hasOwnProperty(varName))
                vars[varName] = element;
        });

        this._expanded[name] = null; // avoid recursive resolution by setting current entry to empty
        Object.getOwnPropertyNames(vars).forEach((element: string) => {
            const toReplace = vars[element];
            const subDescriptor = Object.getOwnPropertyDescriptor(this._expanded, element);
            if (subDescriptor !== undefined) {
                if (subDescriptor.value === null) {
                    throw new Error(`Found recursive definition of var ${element}`);
                }
                value = value.replace(toReplace, subDescriptor.value);
            } else if (this._container.hasOwnProperty(element)) {
                value = value.replace(toReplace, this.get(element));
            } else {
                throw new Error(`Failed to expand var ${element}`);
            }
        });

        return value;
    }

    /** Get a property value. Throws exception if property name is not found */
    public get(name: string, defaultVal?: ValueType): any {
        const descriptor = Object.getOwnPropertyDescriptor(this._container, name);
        if (descriptor === undefined) {
            if (defaultVal !== undefined)
                return defaultVal;
            throw new Error(`Property ${name} does not exists.`);
        }
        if (typeof descriptor.value === "string") {
            const strVal = descriptor.value as string;
            if (strVal.match(/\${\w+}/) !== null)
                return this.expand(name, strVal);
        }
        return descriptor.value;
    }
    /** Checks if a property exists or not */
    public has(name: string): boolean {
        return this._container.hasOwnProperty(name);
    }

    /** Get number type property */
    public getNumber(name: string, defaultVal?: number): number {
        return Number(this.get(name, defaultVal));
    }

    /** Get boolean type property */
    public getBoolean(name: string, defaultVal?: boolean): boolean {
        return Boolean(this.get(name, defaultVal));
    }

    /** Get string type property */
    public getString(name: string, defaultVal?: string): string {
        return String(this.get(name, defaultVal));
    }

    /** Remove a property from config */
    public remove(name: string) {
        if (!this.has(name)) {
            throw new Error(`Property ${name} does not exists.`);
        }
        this._expanded = {};
        delete this._container[name];
    }

    /** Set define a new property if it does not exist or update a writable property to new value */
    public set(name: string, value: ValueType) {
        this._container[name] = value;
        this._expanded = {};
    }

    /**
     *  Return list of property names present in config
     */
    public getVars(): string[] {
        return Object.getOwnPropertyNames(this._container);
    }
    /**
     * Override or add new values from a given object into config. Immutable properties are skipped.
     */
    public merge(source: any) {
        if (source === undefined || source === null || source !== Object(source)) {
            throw new Error("source should be a object");
        }

        Object.keys(source).forEach((name) => {
            const val = source[name];
            if (typeof val === "object" || typeof val === "undefined" || val === null)
                return;

            const descriptor = Object.getOwnPropertyDescriptor(this._container, name);
            if (descriptor !== undefined) {
                if (!descriptor.writable)
                    return;
            }

            this.set(name, val);
        });
    }

    /**
     * Return clone of the internal property container object.
     */
    public getContainer(): any {
        return JSON.parse(JSON.stringify(this._container));
    }

    public static get App(): Config {
        if (!Config._appConfig) {
            Config._appConfig = new Config();
            Config._appConfig.appendSystemVars();
        }
        return Config._appConfig;
    }
}
