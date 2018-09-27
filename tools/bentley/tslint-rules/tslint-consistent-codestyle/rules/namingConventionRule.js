"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var ts = require("typescript");
var Lint = require("tslint");
var utils = require("tsutils");
var rules_1 = require("../src/rules");
var FORMAT_FAIL = ' name must be in ';
var LEADING_FAIL = ' name must not have leading underscore';
var TRAILING_FAIL = ' name must not have trailing underscore';
var NO_LEADING_FAIL = ' name must have leading underscore';
var NO_TRAILING_FAIL = ' name must have trailing underscore';
var REGEX_FAIL = ' name did not match required regex';
var PREFIX_FAIL = ' name must start with ';
var SUFFIX_FAIL = ' name must end with ';
var PREFIX_FAIL_ARR = ' name must start with one of ';
var SUFFIX_FAIL_ARR = ' name must end with one of ';
var Types;
(function (Types) {
    Types[Types["default"] = -1] = "default";
    Types[Types["variable"] = 1] = "variable";
    Types[Types["function"] = 2] = "function";
    Types[Types["parameter"] = 4] = "parameter";
    Types[Types["member"] = 8] = "member";
    Types[Types["property"] = 16] = "property";
    Types[Types["parameterProperty"] = 32] = "parameterProperty";
    Types[Types["method"] = 64] = "method";
    Types[Types["type"] = 128] = "type";
    Types[Types["class"] = 256] = "class";
    Types[Types["interface"] = 512] = "interface";
    Types[Types["typeAlias"] = 1024] = "typeAlias";
    Types[Types["genericTypeParameter"] = 2048] = "genericTypeParameter";
    Types[Types["enum"] = 4096] = "enum";
    Types[Types["enumMember"] = 8192] = "enumMember";
    Types[Types["functionVariable"] = 16384] = "functionVariable";
})(Types || (Types = {}));
var TypeSelector;
(function (TypeSelector) {
    TypeSelector[TypeSelector["variable"] = 1] = "variable";
    TypeSelector[TypeSelector["function"] = 3] = "function";
    TypeSelector[TypeSelector["functionVariable"] = 16385] = "functionVariable";
    TypeSelector[TypeSelector["parameter"] = 5] = "parameter";
    TypeSelector[TypeSelector["property"] = 24] = "property";
    TypeSelector[TypeSelector["parameterProperty"] = 61] = "parameterProperty";
    TypeSelector[TypeSelector["method"] = 72] = "method";
    TypeSelector[TypeSelector["class"] = 384] = "class";
    TypeSelector[TypeSelector["interface"] = 640] = "interface";
    TypeSelector[TypeSelector["typeAlias"] = 1152] = "typeAlias";
    TypeSelector[TypeSelector["genericTypeParameter"] = 2176] = "genericTypeParameter";
    TypeSelector[TypeSelector["enum"] = 4224] = "enum";
    TypeSelector[TypeSelector["enumMember"] = 8216] = "enumMember";
})(TypeSelector || (TypeSelector = {}));
var Modifiers;
(function (Modifiers) {
    Modifiers[Modifiers["const"] = 1] = "const";
    Modifiers[Modifiers["readonly"] = 1] = "readonly";
    Modifiers[Modifiers["static"] = 2] = "static";
    Modifiers[Modifiers["public"] = 4] = "public";
    Modifiers[Modifiers["protected"] = 8] = "protected";
    Modifiers[Modifiers["private"] = 16] = "private";
    Modifiers[Modifiers["global"] = 32] = "global";
    Modifiers[Modifiers["local"] = 64] = "local";
    Modifiers[Modifiers["abstract"] = 128] = "abstract";
    Modifiers[Modifiers["export"] = 256] = "export";
    Modifiers[Modifiers["import"] = 512] = "import";
    Modifiers[Modifiers["rename"] = 1024] = "rename";
    Modifiers[Modifiers["unused"] = 2048] = "unused";
})(Modifiers || (Modifiers = {}));
var Specifity;
(function (Specifity) {
    Specifity[Specifity["const"] = 1] = "const";
    Specifity[Specifity["readonly"] = 1] = "readonly";
    Specifity[Specifity["static"] = 2] = "static";
    Specifity[Specifity["global"] = 2] = "global";
    Specifity[Specifity["local"] = 2] = "local";
    Specifity[Specifity["public"] = 4] = "public";
    Specifity[Specifity["protected"] = 4] = "protected";
    Specifity[Specifity["private"] = 4] = "private";
    Specifity[Specifity["abstract"] = 8] = "abstract";
    Specifity[Specifity["export"] = 16] = "export";
    Specifity[Specifity["import"] = 32] = "import";
    Specifity[Specifity["rename"] = 64] = "rename";
    Specifity[Specifity["unused"] = 128] = "unused";
    Specifity[Specifity["filter"] = 256] = "filter";
    Specifity[Specifity["default"] = 512] = "default";
    Specifity[Specifity["variable"] = 1024] = "variable";
    Specifity[Specifity["function"] = 1536] = "function";
    Specifity[Specifity["functionVariable"] = 1536] = "functionVariable";
    Specifity[Specifity["parameter"] = 2048] = "parameter";
    Specifity[Specifity["member"] = 2560] = "member";
    Specifity[Specifity["property"] = 3072] = "property";
    Specifity[Specifity["method"] = 3072] = "method";
    Specifity[Specifity["enumMember"] = 3584] = "enumMember";
    Specifity[Specifity["parameterProperty"] = 3584] = "parameterProperty";
    Specifity[Specifity["type"] = 4096] = "type";
    Specifity[Specifity["class"] = 4608] = "class";
    Specifity[Specifity["interface"] = 4608] = "interface";
    Specifity[Specifity["typeAlias"] = 4608] = "typeAlias";
    Specifity[Specifity["genericTypeParameter"] = 4608] = "genericTypeParameter";
    Specifity[Specifity["enum"] = 4608] = "enum";
})(Specifity || (Specifity = {}));
var Rule = (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new IdentifierNameWalker(sourceFile, this.ruleName, this.ruleArguments.map(function (rule) { return new NormalizedConfig(rule); }).sort(NormalizedConfig.sort)));
    };
    return Rule;
}(rules_1.AbstractConfigDependentRule));
exports.Rule = Rule;
var NormalizedConfig = (function () {
    function NormalizedConfig(raw) {
        this._type = Types[raw.type];
        this._final = !!raw.final;
        this._specifity = Specifity[raw.type];
        this._modifiers = 0;
        if (raw.modifiers !== undefined) {
            if (Array.isArray(raw.modifiers)) {
                for (var _i = 0, _a = raw.modifiers; _i < _a.length; _i++) {
                    var modifier = _a[_i];
                    this._modifiers |= Modifiers[modifier];
                    this._specifity |= Specifity[modifier];
                }
            }
            else {
                this._modifiers = Modifiers[raw.modifiers];
                this._specifity |= Specifity[raw.modifiers];
            }
        }
        if (raw.filter !== undefined) {
            this._filter = new RegExp(raw.filter);
            this._specifity |= Specifity.filter;
        }
        else {
            this._filter = undefined;
        }
        this._format = raw;
    }
    NormalizedConfig.prototype.matches = function (type, modifiers, name) {
        if (this._final && type > this._type << 1)
            return [false, false];
        if ((this._type & type) === 0 || (this._modifiers & ~modifiers) !== 0)
            return [false, false];
        if (this._filter === undefined)
            return [true, false];
        return [this._filter.test(name), true];
    };
    NormalizedConfig.prototype.getFormat = function () {
        return this._format;
    };
    NormalizedConfig.sort = function (first, second) {
        return first._specifity - second._specifity;
    };
    return NormalizedConfig;
}());
var NameChecker = (function () {
    function NameChecker(_type, format) {
        this._type = _type;
        this._leadingUnderscore = format.leadingUnderscore;
        this._trailingUnderscore = format.trailingUnderscore;
        this._format = parseOptionArray(format.format);
        this._prefix = parseOptionArray(format.prefix);
        this._suffix = parseOptionArray(format.suffix);
        this._regex = format.regex ? new RegExp(format.regex) : undefined;
    }
    NameChecker.prototype._failMessage = function (message) {
        return TypeSelector[this._type] + message;
    };
    NameChecker.prototype.check = function (name, walker) {
        var identifier = name.text;
        if (this._regex !== undefined && !this._regex.test(identifier))
            walker.addFailureAtNode(name, this._failMessage(REGEX_FAIL));
        if (this._leadingUnderscore) {
            if (identifier[0] === '_') {
                if (this._leadingUnderscore === 'forbid')
                    walker.addFailureAtNode(name, this._failMessage(LEADING_FAIL));
                identifier = identifier.slice(1);
            }
            else if (this._leadingUnderscore === 'require') {
                walker.addFailureAtNode(name, this._failMessage(NO_LEADING_FAIL));
            }
        }
        if (this._trailingUnderscore) {
            if (identifier[identifier.length - 1] === '_') {
                if (this._trailingUnderscore === 'forbid')
                    walker.addFailureAtNode(name, this._failMessage(TRAILING_FAIL));
                identifier = identifier.slice(0, -1);
            }
            else if (this._trailingUnderscore === 'require') {
                walker.addFailureAtNode(name, this._failMessage(NO_TRAILING_FAIL));
            }
        }
        if (this._prefix) {
            if (Array.isArray(this._prefix)) {
                identifier = this._checkPrefixes(identifier, name, this._prefix, walker);
            }
            else if (identifier.startsWith(this._prefix)) {
                identifier = identifier.slice(this._prefix.length);
            }
            else {
                walker.addFailureAtNode(name, this._failMessage(PREFIX_FAIL + this._prefix));
            }
        }
        if (this._suffix) {
            if (Array.isArray(this._suffix)) {
                identifier = this._checkSuffixes(identifier, name, this._suffix, walker);
            }
            else if (identifier.endsWith(this._suffix)) {
                identifier = identifier.slice(0, -this._suffix.length);
            }
            else {
                walker.addFailureAtNode(name, this._failMessage(SUFFIX_FAIL + this._suffix));
            }
        }
        if (this._format) {
            if (Array.isArray(this._format)) {
                if (!matchesAnyFormat(identifier, this._format))
                    walker.addFailureAtNode(name, this._failMessage(FORMAT_FAIL + formatFormatList(this._format)));
            }
            else if (!matchesFormat(identifier, this._format)) {
                walker.addFailureAtNode(name, this._failMessage(FORMAT_FAIL + this._format));
            }
        }
    };
    NameChecker.prototype._checkPrefixes = function (identifier, name, prefixes, walker) {
        for (var _i = 0, prefixes_1 = prefixes; _i < prefixes_1.length; _i++) {
            var prefix = prefixes_1[_i];
            if (identifier.startsWith(prefix))
                return identifier.slice(prefix.length);
        }
        walker.addFailureAtNode(name, this._failMessage(PREFIX_FAIL_ARR + prefixes.toString()));
        return identifier;
    };
    NameChecker.prototype._checkSuffixes = function (identifier, name, suffixes, walker) {
        for (var _i = 0, suffixes_1 = suffixes; _i < suffixes_1.length; _i++) {
            var suffix = suffixes_1[_i];
            if (identifier.endsWith(suffix))
                return identifier.slice(0, -suffix.length);
        }
        walker.addFailureAtNode(name, this._failMessage(SUFFIX_FAIL_ARR + suffixes.toString()));
        return identifier;
    };
    return NameChecker;
}());
var IdentifierNameWalker = (function (_super) {
    tslib_1.__extends(IdentifierNameWalker, _super);
    function IdentifierNameWalker() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._depth = 0;
        _this._cache = new Map();
        _this._usage = undefined;
        return _this;
    }
    IdentifierNameWalker.prototype._isUnused = function (name) {
        if (this._usage === undefined)
            this._usage = utils.collectVariableUsage(this.sourceFile);
        return this._usage.get(name).uses.length === 0;
    };
    IdentifierNameWalker.prototype._checkTypeParameters = function (node, modifiers) {
        if (node.typeParameters !== undefined)
            for (var _i = 0, _a = node.typeParameters; _i < _a.length; _i++) {
                var name = _a[_i].name;
                this._checkName(name, TypeSelector.genericTypeParameter, modifiers);
            }
    };
    IdentifierNameWalker.prototype.visitEnumDeclaration = function (node) {
        var modifiers = this._getModifiers(node, TypeSelector.enum);
        this._checkName(node.name, TypeSelector.enum, modifiers);
        modifiers |= Modifiers.static | Modifiers.public | Modifiers.readonly;
        for (var _i = 0, _a = node.members; _i < _a.length; _i++) {
            var name = _a[_i].name;
            if (utils.isIdentifier(name))
                this._checkName(name, TypeSelector.enumMember, modifiers);
        }
    };
    IdentifierNameWalker.prototype.visitTypeAliasDeclaration = function (node) {
        this._checkDeclaration(node, TypeSelector.typeAlias);
        this._checkTypeParameters(node, Modifiers.global);
    };
    IdentifierNameWalker.prototype.visitClassLikeDeclaration = function (node) {
        if (node.name !== undefined)
            this._checkDeclaration(node, TypeSelector.class);
        this._checkTypeParameters(node, Modifiers.global);
    };
    IdentifierNameWalker.prototype.visitMethodDeclaration = function (node) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.method);
        this._checkTypeParameters(node, Modifiers.local);
    };
    IdentifierNameWalker.prototype.visitInterfaceDeclaration = function (node) {
        this._checkDeclaration(node, TypeSelector.interface);
        this._checkTypeParameters(node, Modifiers.global);
    };
    IdentifierNameWalker.prototype.visitParameterDeclaration = function (node) {
        var _this = this;
        if (node.parent.kind === ts.SyntaxKind.IndexSignature)
            return;
        if (isNameIdentifier(node)) {
            if (node.name.originalKeywordKind === ts.SyntaxKind.ThisKeyword)
                return;
            var parameterProperty = utils.isParameterProperty(node);
            this._checkDeclaration(node, parameterProperty ? TypeSelector.parameterProperty : TypeSelector.parameter, utils.isFunctionWithBody(node.parent) && !parameterProperty && this._isUnused(node.name) ? Modifiers.unused : 0);
        }
        else {
            utils.forEachDestructuringIdentifier(node.name, function (declaration) {
                var modifiers = Modifiers.local;
                if (!isEqualName(declaration.name, declaration.propertyName))
                    modifiers |= Modifiers.rename;
                if (utils.isFunctionWithBody(node.parent) && _this._isUnused(declaration.name))
                    modifiers |= Modifiers.unused;
                _this._checkName(declaration.name, TypeSelector.parameter, modifiers);
            });
        }
    };
    IdentifierNameWalker.prototype.visitPropertyDeclaration = function (node) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
    };
    IdentifierNameWalker.prototype.visitSetAccessor = function (node) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
    };
    IdentifierNameWalker.prototype.visitGetAccessor = function (node) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
    };
    IdentifierNameWalker.prototype._checkVariableDeclarationList = function (list, modifiers) {
        var _this = this;
        if ((list.flags & ts.NodeFlags.Const) !== 0)
            modifiers |= Modifiers.const;
        utils.forEachDeclaredVariable(list, function (declaration) {
            var currentModifiers = modifiers;
            var selector = TypeSelector.variable;
            if (declaration.kind === ts.SyntaxKind.BindingElement && !isEqualName(declaration.name, declaration.propertyName))
                currentModifiers |= Modifiers.rename;
            if (_this._isUnused(declaration.name))
                currentModifiers |= Modifiers.unused;
            if (isFunctionVariable(declaration))
                selector = TypeSelector.functionVariable;
            _this._checkName(declaration.name, selector, currentModifiers);
        });
    };
    IdentifierNameWalker.prototype.visitForStatement = function (node) {
        if (node.initializer !== undefined && utils.isVariableDeclarationList(node.initializer))
            this._checkVariableDeclarationList(node.initializer, this._getModifiers(node.initializer, TypeSelector.variable));
    };
    IdentifierNameWalker.prototype.visitForOfStatement = function (node) {
        if (utils.isVariableDeclarationList(node.initializer))
            this._checkVariableDeclarationList(node.initializer, this._getModifiers(node.initializer, TypeSelector.variable));
    };
    IdentifierNameWalker.prototype.visitForInStatement = function (node) {
        if (utils.isVariableDeclarationList(node.initializer))
            this._checkVariableDeclarationList(node.initializer, this._getModifiers(node.initializer, TypeSelector.variable));
    };
    IdentifierNameWalker.prototype.visitVariableStatement = function (node) {
        if (!utils.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword))
            this._checkVariableDeclarationList(node.declarationList, this._getModifiers(node, TypeSelector.variable));
    };
    IdentifierNameWalker.prototype.visitFunction = function (node) {
        if (node.name !== undefined)
            this._checkDeclaration(node, TypeSelector.function);
        this._checkTypeParameters(node, Modifiers.local);
    };
    IdentifierNameWalker.prototype.visitArrowFunction = function (node) {
        this._checkTypeParameters(node, Modifiers.local);
    };
    IdentifierNameWalker.prototype._checkDeclaration = function (node, type, initialModifiers) {
        this._checkName(node.name, type, this._getModifiers(node, type, initialModifiers));
    };
    IdentifierNameWalker.prototype._checkName = function (name, type, modifiers) {
        var matchingChecker = this._getMatchingChecker(type, modifiers, name.text);
        if (matchingChecker !== null)
            matchingChecker.check(name, this);
    };
    IdentifierNameWalker.prototype._getMatchingChecker = function (type, modifiers, name) {
        var key = type + "," + modifiers;
        var cached = this._cache.get(key);
        if (cached !== undefined)
            return cached;
        var _a = this._createChecker(type, modifiers, name), checker = _a[0], hasFilter = _a[1];
        if (!hasFilter)
            this._cache.set(key, checker);
        return checker;
    };
    IdentifierNameWalker.prototype._createChecker = function (type, modifiers, name) {
        var hasFilter = false;
        var config = this.options.reduce(function (format, rule) {
            var _a = rule.matches(type, modifiers, name), matches = _a[0], filterUsed = _a[1];
            if (!matches)
                return format;
            if (filterUsed)
                hasFilter = true;
            return Object.assign(format, rule.getFormat());
        }, {
            leadingUnderscore: undefined,
            trailingUnderscore: undefined,
            format: undefined,
            prefix: undefined,
            regex: undefined,
            suffix: undefined,
        });
        if (!config.leadingUnderscore &&
            !config.trailingUnderscore &&
            !config.format &&
            !config.prefix &&
            !config.regex &&
            !config.suffix)
            return [null, hasFilter];
        return [new NameChecker(type, config), hasFilter];
    };
    IdentifierNameWalker.prototype._getModifiers = function (node, type, modifiers) {
        if (modifiers === void 0) { modifiers = 0; }
        if (node.modifiers !== undefined) {
            if (type & Types.member) {
                if (utils.hasModifier(node.modifiers, ts.SyntaxKind.PrivateKeyword)) {
                    modifiers |= Modifiers.private;
                }
                else if (utils.hasModifier(node.modifiers, ts.SyntaxKind.ProtectedKeyword)) {
                    modifiers |= Modifiers.protected;
                }
                else {
                    modifiers |= Modifiers.public;
                }
                if (utils.hasModifier(node.modifiers, ts.SyntaxKind.ReadonlyKeyword))
                    modifiers |= Modifiers.const;
                if (utils.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword))
                    modifiers |= Modifiers.static;
            }
            if (utils.hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword))
                modifiers |= Modifiers.const;
            if (utils.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword))
                modifiers |= Modifiers.export;
            if (utils.hasModifier(node.modifiers, ts.SyntaxKind.AbstractKeyword))
                modifiers |= Modifiers.abstract;
        }
        if (type !== TypeSelector.property && type !== TypeSelector.method)
            modifiers |= this._depth !== 0 ? Modifiers.local : Modifiers.global;
        return modifiers;
    };
    IdentifierNameWalker.prototype.walk = function (sourceFile) {
        var _this = this;
        var cb = function (node) {
            _this.visitNode(node);
            if (utils.isScopeBoundary(node)) {
                ++_this._depth;
                ts.forEachChild(node, cb);
                --_this._depth;
            }
            else {
                return ts.forEachChild(node, cb);
            }
        };
        return ts.forEachChild(sourceFile, cb);
    };
    IdentifierNameWalker.prototype.visitNode = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                return this.visitVariableStatement(node);
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
                return this.visitFunction(node);
            case ts.SyntaxKind.ForStatement:
                return this.visitForStatement(node);
            case ts.SyntaxKind.ForInStatement:
                return this.visitForInStatement(node);
            case ts.SyntaxKind.ForOfStatement:
                return this.visitForOfStatement(node);
            case ts.SyntaxKind.Parameter:
                return this.visitParameterDeclaration(node);
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
                return this.visitClassLikeDeclaration(node);
            case ts.SyntaxKind.InterfaceDeclaration:
                return this.visitInterfaceDeclaration(node);
            case ts.SyntaxKind.EnumDeclaration:
                return this.visitEnumDeclaration(node);
            case ts.SyntaxKind.TypeAliasDeclaration:
                return this.visitTypeAliasDeclaration(node);
            case ts.SyntaxKind.PropertyDeclaration:
                return this.visitPropertyDeclaration(node);
            case ts.SyntaxKind.MethodDeclaration:
                return this.visitMethodDeclaration(node);
            case ts.SyntaxKind.GetAccessor:
                return this.visitGetAccessor(node);
            case ts.SyntaxKind.SetAccessor:
                return this.visitSetAccessor(node);
            case ts.SyntaxKind.ArrowFunction:
                return this.visitArrowFunction(node);
        }
    };
    return IdentifierNameWalker;
}(Lint.AbstractWalker));
function parseOptionArray(option) {
    if (!Array.isArray(option) || option.length > 1)
        return option;
    return option[0];
}
function matchesFormat(identifier, format) {
    switch (format) {
        case "PascalCase":
            return isPascalCase(identifier);
        case "StrictPascalCase":
            return isStrictPascalCase(identifier);
        case "camelCase":
            return isCamelCase(identifier);
        case "strictCamelCase":
            return isStrictCamelCase(identifier);
        case "snake_case":
            return isSnakeCase(identifier);
        case "UPPER_CASE":
            return isUpperCase(identifier);
    }
}
function matchesAnyFormat(identifier, formats) {
    for (var _i = 0, formats_1 = formats; _i < formats_1.length; _i++) {
        var format = formats_1[_i];
        if (matchesFormat(identifier, format))
            return true;
    }
    return false;
}
function formatFormatList(formats) {
    var result = formats[0];
    var lastIndex = formats.length - 1;
    for (var i = 1; i < lastIndex; ++i)
        result += ', ' + formats[i];
    return result + ' or ' + formats[lastIndex];
}
function isPascalCase(name) {
    return name.length === 0 || name[0] === name[0].toUpperCase() && !name.includes('_');
}
function isCamelCase(name) {
    return name.length === 0 || name[0] === name[0].toLowerCase() && !name.includes('_');
}
function isStrictPascalCase(name) {
    return name.length === 0 || name[0] === name[0].toUpperCase() && hasStrictCamelHumps(name, true);
}
function isStrictCamelCase(name) {
    return name.length === 0 || name[0] === name[0].toLowerCase() && hasStrictCamelHumps(name, false);
}
function hasStrictCamelHumps(name, isUpper) {
    if (name[0] === '_')
        return false;
    for (var i = 1; i < name.length; ++i) {
        if (name[i] === '_')
            return false;
        if (isUpper === isUppercaseChar(name[i])) {
            if (isUpper)
                return false;
        }
        else {
            isUpper = !isUpper;
        }
    }
    return true;
}
function isUppercaseChar(char) {
    return char === char.toUpperCase() && char !== char.toLowerCase();
}
function isSnakeCase(name) {
    return name === name.toLowerCase() && validateUnderscores(name);
}
function isUpperCase(name) {
    return name === name.toUpperCase() && validateUnderscores(name);
}
function validateUnderscores(name) {
    if (name[0] === '_')
        return false;
    var wasUnderscore = false;
    for (var i = 1; i < name.length; ++i) {
        if (name[i] === '_') {
            if (wasUnderscore)
                return false;
            wasUnderscore = true;
        }
        else {
            wasUnderscore = false;
        }
    }
    return !wasUnderscore;
}
function isNameIdentifier(node) {
    return node.name.kind === ts.SyntaxKind.Identifier;
}
function isEqualName(name, propertyName) {
    return propertyName === undefined ||
        (propertyName.kind === ts.SyntaxKind.Identifier && propertyName.text === name.text);
}
function isFunctionVariable(declaration) {
    if (declaration.initializer) {
        switch (declaration.initializer.kind) {
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionExpression:
                return true;
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nQ29udmVudGlvblJ1bGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJuYW1pbmdDb252ZW50aW9uUnVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBaUM7QUFDakMsNkJBQStCO0FBQy9CLCtCQUFpQztBQUVqQyxzQ0FBMkQ7QUFjM0QsSUFBTSxXQUFXLEdBQUssbUJBQW1CLENBQUM7QUFDMUMsSUFBTSxZQUFZLEdBQUksd0NBQXdDLENBQUM7QUFDL0QsSUFBTSxhQUFhLEdBQUcseUNBQXlDLENBQUM7QUFDaEUsSUFBTSxlQUFlLEdBQUksb0NBQW9DLENBQUM7QUFDOUQsSUFBTSxnQkFBZ0IsR0FBRyxxQ0FBcUMsQ0FBQztBQUMvRCxJQUFNLFVBQVUsR0FBTSxvQ0FBb0MsQ0FBQztBQUMzRCxJQUFNLFdBQVcsR0FBSyx3QkFBd0IsQ0FBQztBQUMvQyxJQUFNLFdBQVcsR0FBSyxzQkFBc0IsQ0FBQztBQUM3QyxJQUFNLGVBQWUsR0FBSSwrQkFBK0IsQ0FBQztBQUN6RCxJQUFNLGVBQWUsR0FBSSw2QkFBNkIsQ0FBQztBQUl2RCxJQUFLLEtBbUJKO0FBbkJELFdBQUssS0FBSztJQUVOLHdDQUFZLENBQUE7SUFDWix5Q0FBWSxDQUFBO0lBQ1oseUNBQWlCLENBQUE7SUFDakIsMkNBQWtCLENBQUE7SUFDbEIscUNBQWUsQ0FBQTtJQUNmLDBDQUFpQixDQUFBO0lBQ2pCLDREQUEwQixDQUFBO0lBQzFCLHNDQUFlLENBQUE7SUFDZixtQ0FBYSxDQUFBO0lBQ2IscUNBQWMsQ0FBQTtJQUNkLDZDQUFrQixDQUFBO0lBQ2xCLDhDQUFtQixDQUFBO0lBQ25CLG9FQUE4QixDQUFBO0lBQzlCLG9DQUFjLENBQUE7SUFDZCxnREFBb0IsQ0FBQTtJQUNwQiw2REFBMEIsQ0FBQTtBQUU5QixDQUFDLEVBbkJJLEtBQUssS0FBTCxLQUFLLFFBbUJUO0FBRUQsSUFBSyxZQWdCSjtBQWhCRCxXQUFLLFlBQVk7SUFFYix1REFBeUIsQ0FB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