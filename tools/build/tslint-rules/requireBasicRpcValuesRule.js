"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = void 0;
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const Lint = require("tslint");
const ts = require("typescript");
const LOCKED = Symbol("LOCKED");
class Rule extends Lint.Rules.TypedRule {
    constructor() {
        super(...arguments);
        this._checker = undefined;
        this._ctx = undefined;
    }
    applyWithProgram(sourceFile, program) {
        this._checker = program.getTypeChecker();
        return this.applyWithFunction(sourceFile, (ctx) => {
            this._ctx = ctx;
            ts.forEachChild(ctx.sourceFile, (n) => this.walk(n));
        }, this.getOptions());
    }
    walk(node) {
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            this.checkClassDeclaration(node);
        }
        else if (node.kind === ts.SyntaxKind.CallExpression) {
            this.checkCallExpression(node);
        }
        else if (node.kind === ts.SyntaxKind.ReturnStatement) {
            this.checkReturnStatement(node);
        }
        ts.forEachChild(node, (n) => this.walk(n));
    }
    checkReturnStatement(node) {
        if (!this.isRpcReturn(node)) {
            return;
        }
        for (const child of node.getChildren()) {
            const type = this._checker.getTypeAtLocation(child);
            this.checkNode(child, type, "");
        }
    }
    isRpcReturn(_node) {
        let node = _node;
        for (;;) {
            if (node.kind === ts.SyntaxKind.MethodDeclaration && this.isStatic(node)) {
                return false;
            }
            if (node.parent.kind === ts.SyntaxKind.ClassDeclaration) {
                return this.isRpcInterface(node.parent);
            }
            else if (node.parent.kind === ts.SyntaxKind.SourceFile) {
                return false;
            }
            else {
                node = node.parent;
            }
        }
    }
    checkCallExpression(node) {
        const signature = this._checker.getResolvedSignature(node);
        if (signature) {
            const declaration = signature.getDeclaration();
            if (!declaration || !declaration.parent) {
                return;
            }
            if (ts.isClassDeclaration(declaration.parent) && this.isRpcInterface(declaration.parent)) {
                for (const argument of node.arguments) {
                    const type = this._checker.getTypeAtLocation(argument);
                    this.checkNode(argument, type, "");
                }
            }
        }
    }
    checkClassDeclaration(node) {
        if (this.isRpcInterface(node)) {
            node.forEachChild((child) => {
                if (child.kind !== ts.SyntaxKind.MethodDeclaration || this.isStatic(child)) {
                    return;
                }
                const method = child;
                this.checkParameters(method);
                this.checkReturnType(method);
            });
        }
    }
    checkParameters(method) {
        for (const param of method.parameters) {
            if (!param.type) {
                continue;
            }
            const type = this._checker.getTypeFromTypeNode(param.type);
            this.checkNode(param, type, "");
        }
    }
    checkReturnType(method) {
        const signature = this._checker.getSignatureFromDeclaration(method);
        if (signature) {
            this.checkNode(signature.getDeclaration().type, signature.getReturnType(), "");
        }
    }
    isStatic(node) {
        if (node.modifiers) {
            for (const modifier of node.modifiers) {
                if (modifier.kind === ts.SyntaxKind.StaticKeyword) {
                    return true;
                }
            }
        }
        return false;
    }
    resolveReferences(_type) {
        let type = _type;
        let base = type.symbol ? type.symbol.getName() : "";
        for (;;) {
            const asRef = type;
            if (asRef.typeArguments && asRef.typeArguments.length && (base === "Array" || base === "Promise")) {
                type = asRef.typeArguments[0];
                base = type.symbol ? type.symbol.getName() : "";
            }
            else {
                const bases = type.getBaseTypes();
                if (bases && bases.length === 1 && bases[0].symbol && bases[0].symbol.name === "Array") {
                    const baseRef = bases[0];
                    if (baseRef.typeArguments && baseRef.typeArguments.length) {
                        type = baseRef.typeArguments[0];
                        base = type.symbol ? type.symbol.getName() : "";
                        continue;
                    }
                }
                break;
            }
        }
        return { type, base };
    }
    checkNode(node, _type, scope) {
        const { type, base } = this.resolveReferences(_type);
        const typeAny = type;
        if (typeAny[LOCKED]) {
            return true;
        }
        typeAny[LOCKED] = true;
        let failure = false;
        let childFailure = false;
        let message = Rule.FAILURE_STRING;
        if (type.isClass()) {
            failure = true;
            message += `\n"${scope ? (`${scope}.`) : ""}${type.symbol.getName()}" is a class.`;
        }
        else if (!this.isPrimitive(type)) {
            const asObject = type;
            if (asObject.objectFlags && asObject.objectFlags === ts.ObjectFlags.Reference) {
                const asRef = asObject;
                if (asRef.typeArguments) {
                    let t = 0;
                    for (const member of asRef.typeArguments) {
                        if (!this.checkNode(node, member, `${scope || base}.[${t}]`)) {
                            childFailure = true;
                        }
                        ++t;
                    }
                }
            }
            else if (type.isUnionOrIntersection()) {
                if (node && this.isPropsUnion(type, node)) {
                    // special case
                }
                else {
                    let t = 0;
                    for (const member of type.types) {
                        if (!this.checkNode(node, member, `${scope}.[${t}]`)) {
                            childFailure = true;
                        }
                        ++t;
                    }
                }
            }
            else if (base === "Uint8Array") {
                // special case
            }
            else {
                const properties = type.getProperties();
                for (const member of properties) {
                    if (this.isFunction(member)) {
                        failure = true;
                        message += `\n"${scope || base}.${member.name}" is a function.`;
                    }
                    else if (node) {
                        const memberType = this._checker.getTypeOfSymbolAtLocation(member, node);
                        if (!this.checkNode(node, memberType, `${scope || base}.${member.name}`)) {
                            childFailure = true;
                        }
                    }
                }
            }
        }
        if (failure && node) {
            this._ctx.addFailureAtNode(node, message);
        }
        typeAny[LOCKED] = false;
        return !failure && !childFailure;
    }
    isPropsUnion(type, node) {
        let primitives = 0;
        let classes = 0;
        for (const _member of type.types) {
            const member = this.resolveReferences(_member).type;
            if (member.isClass()) {
                ++classes;
            }
            else if (this.isUndefinedOrNull(member)) {
                // these don't count as a primitive in this case
            }
            else if (this.checkNode(node, member, "")) {
                ++primitives;
            }
        }
        return classes === 1 && primitives;
    }
    isFunction(symbol) {
        const F = ts.SymbolFlags;
        return (symbol.getFlags() & (F.Function | F.Method | F.Constructor)) !== 0;
    }
    isPrimitive(type) {
        const F = ts.TypeFlags;
        return (type.getFlags() & (F.String | F.StringLiteral | F.Number | F.NumberLiteral | F.Boolean | F.BooleanLiteral | F.Null | F.Undefined | F.Enum | F.EnumLiteral)) !== 0;
    }
    isUndefinedOrNull(type) {
        const F = ts.TypeFlags;
        return (type.getFlags() & (F.Undefined | F.Null)) !== 0;
    }
    isRpcInterface(node) {
        if (node.heritageClauses) {
            for (const clause of node.heritageClauses) {
                if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                    for (const expr of clause.types) {
                        const type = this._checker.getTypeFromTypeNode(expr);
                        if (type.symbol && type.symbol.getName() === "RpcInterface") {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
exports.Rule = Rule;
Rule.FAILURE_STRING = "Unsupported RPC value.";
