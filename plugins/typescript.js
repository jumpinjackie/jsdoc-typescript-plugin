var TsdPlugin;
(function (TsdPlugin) {
    /**
     * Constants for different kinds of doclets
     */
    var DocletKind = (function () {
        function DocletKind() {
        }
        Object.defineProperty(DocletKind, "function", {
            /**
             * Doclet for a function
             */
            get: function () { return "function"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DocletKind, "typedef", {
            /**
             * Doclet for a typedef
             */
            get: function () { return "typedef"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DocletKind, "class", {
            /**
             * Doclet for a class
             */
            get: function () { return "class"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DocletKind, "member", {
            /**
             * Doclet for a member
             */
            get: function () { return "member"; },
            enumerable: true,
            configurable: true
        });
        return DocletKind;
    })();
    TsdPlugin.DocletKind = DocletKind;
})(TsdPlugin || (TsdPlugin = {}));
/// <reference path="./doclettypes.ts" />
var TsdPlugin;
(function (TsdPlugin) {
    var CLS_DESC_PLACEHOLDER = "%TYPENAME%";
    /**
     * The class that does all the grunt work
     */
    var TsdGenerator = (function () {
        function TsdGenerator(config) {
            this.config = {
                rootModuleName: (config.rootModuleName || "generated"),
                outDir: (config.outDir || "."),
                typeReplacements: (config.typeReplacements || {}),
                defaultCtorDesc: (config.defaultCtorDesc || ("Constructor for " + CLS_DESC_PLACEHOLDER)),
                fillUndocumentedDoclets: !!config.fillUndocumentedDoclets,
                outputDocletDefs: !!config.outputDocletDefs,
                publicAnnotation: (config.publicAnnotation || null),
                defaultReturnType: (config.defaultReturnType || "any"),
                aliases: {
                    global: ((config.aliases || {}).global || {}),
                    module: ((config.aliases || {}).module || {})
                },
                interfaces: {
                    global: ((config.interfaces || {}).global || {}),
                    module: ((config.interfaces || {}).module || {})
                },
                ignoreTypes: {}
            };
            var ignoreJsDocTypes = (config.ignore || []);
            for (var i = 0; i < ignoreJsDocTypes.length; i++) {
                this.config.ignoreTypes[ignoreJsDocTypes[i]] = ignoreJsDocTypes[i];
            }
            this.classes = {};
            this.typedefs = {};
            this.userInterfaces = [];
            this.userTypeAliases = [];
            this.stats = {
                typedefs: {
                    user: 0,
                    gen: 0
                },
                ifaces: 0,
                classes: 0
            };
        }
        TsdGenerator.prototype.ignoreThisType = function (fullname) {
            if (this.config.ignoreTypes[fullname])
                return true;
            else
                return false;
        };
        TsdGenerator.prototype.isPrivateDoclet = function (doclet) {
            var _this = this;
            //If the configuration defines a particular annotation as a public API marker and it
            //exists in the doclet's tag list, the doclet is considered part of the public API
            if (this.config.publicAnnotation) {
                var found = (doclet.tags || []).filter(function (tag) { return tag.originalTitle == _this.config.publicAnnotation; });
                if (found.length == 1)
                    return false;
                //In this mode, absence of the tag means not public
                return true;
            }
            return doclet.access == "private" ||
                doclet.undocumented == true;
        };
        TsdGenerator.prototype.ensureClassDef = function (name, factory) {
            if (!this.classes[name]) {
                if (factory != null)
                    this.classes[name] = factory();
                else
                    return null;
            }
            else {
                return this.classes[name];
            }
        };
        TsdGenerator.prototype.ensureTypedef = function (name, factory) {
            if (!this.typedefs[name]) {
                if (factory != null)
                    this.typedefs[name] = factory();
            }
            else {
                return this.typedefs[name];
            }
        };
        TsdGenerator.prototype.parseClassesAndTypedefs = function (doclets) {
            for (var _i = 0; _i < doclets.length; _i++) {
                var doclet = doclets[_i];
                if (this.ignoreThisType(doclet.longname))
                    continue;
                //TypeScript definition covers a module's *public* API surface, so
                //skip private classes
                if (this.isPrivateDoclet(doclet))
                    continue;
                if (doclet.kind == "class") {
                    var parentModName = null;
                    if (doclet.longname.indexOf("module:") >= 0) {
                        //Assuming that anything annotated "module:" will have a "." to denote end of module and start of class name
                        var modLen = "module:".length;
                        var dotIdx = doclet.longname.indexOf(".");
                        if (dotIdx < 0)
                            dotIdx = doclet.longname.length;
                        parentModName = doclet.longname.substring(modLen, dotIdx);
                    }
                    else if (doclet.memberof) {
                        parentModName = doclet.memberof;
                    }
                    //Key class definition on longname
                    var cls = this.ensureClassDef(doclet.longname, function () { return new TsdPlugin.TSClass(doclet); });
                    if (parentModName != null)
                        cls.setParentModule(parentModName);
                }
                else if (doclet.kind == "typedef") {
                    this.ensureTypedef(doclet.longname, function () { return new TsdPlugin.TSTypedef(doclet); });
                }
            }
        };
        TsdGenerator.prototype.processTypeMembers = function (doclets) {
            for (var _i = 0; _i < doclets.length; _i++) {
                var doclet = doclets[_i];
                if (this.ignoreThisType(doclet.longname))
                    continue;
                //TypeScript definition covers a module's *public* API surface, so
                //skip private classes
                if (this.isPrivateDoclet(doclet))
                    continue;
                //We've keyed class definition on longname, so memberof should
                //point to it
                var cls = this.ensureClassDef(doclet.memberof);
                if (!cls) {
                    //Failing that it would've been registered as a typedef
                    cls = this.ensureTypedef(doclet.memberof);
                    if (!cls)
                        continue;
                }
                if (doclet.kind == "value") {
                    cls.members.push(new TsdPlugin.TSProperty(doclet));
                }
                else if (doclet.kind == "function") {
                    cls.members.push(new TsdPlugin.TSMethod(doclet));
                }
            }
        };
        TsdGenerator.prototype.processUserDefinedTypes = function () {
            //Output user-injected type aliases
            //global
            for (var typeAlias in this.config.aliases.global) {
                this.userTypeAliases.push(new TsdPlugin.TSUserTypeAlias(null, typeAlias, this.config.aliases.global[typeAlias]));
            }
            //module
            for (var moduleName in this.config.aliases.module) {
                for (var typeAlias in this.config.aliases.module[moduleName]) {
                    this.userTypeAliases.push(new TsdPlugin.TSUserTypeAlias(moduleName, typeAlias, this.config.aliases.module[moduleName][typeAlias]));
                }
            }
            //Output user-injected interfaces
            //global
            for (var typeName in this.config.interfaces.global) {
                var iface = this.config.interfaces.global[typeName];
                this.userInterfaces.push(new TsdPlugin.TSUserInterface(null, typeName, iface));
            }
            //module
            for (var moduleName in this.config.interfaces.module) {
                for (var typeName in this.config.interfaces.module[moduleName]) {
                    var iface = this.config.interfaces.module[moduleName][typeName];
                    this.userInterfaces.push(new TsdPlugin.TSUserInterface(moduleName, typeName, iface));
                }
            }
        };
        TsdGenerator.ensureModuleTree = function (root, moduleNameParts) {
            var tree = root;
            for (var _i = 0; _i < moduleNameParts.length; _i++) {
                var name = moduleNameParts[_i];
                //Doesn't exist at this level, make it
                if (!tree.children[name]) {
                    tree.children[name] = {
                        children: {},
                        types: []
                    };
                }
                tree = tree.children[name];
            }
            return tree;
        };
        TsdGenerator.putTypeInTree = function (type, moduleName, root) {
            if (TsdPlugin.ModuleUtils.isAMD(moduleName)) {
                //No nesting required for AMD modules
                if (!root.children[moduleName]) {
                    root.children[moduleName] = {
                        children: {},
                        types: []
                    };
                }
                root.children[moduleName].types.push(type);
            }
            else {
                //Explode this module name and see how many levels we need to go
                var moduleNameParts = moduleName.split(".");
                var tree = TsdGenerator.ensureModuleTree(root, moduleNameParts);
                tree.types.push(type);
            }
        };
        /**
         * This method groups all of our collected TS types according to their parent module
         */
        TsdGenerator.prototype.assembleModuleTree = function () {
            var root = {
                children: {},
                types: []
            };
            for (var typeName in this.classes) {
                var cls = this.classes[typeName];
                var moduleName = cls.getParentModule();
                TsdGenerator.putTypeInTree(cls, moduleName, root);
            }
            for (var typeName in this.typedefs) {
                var tdf = this.typedefs[typeName];
                var moduleName = tdf.getParentModule();
                TsdGenerator.putTypeInTree(tdf, moduleName, root);
            }
            return root;
        };
        TsdGenerator.prototype.process = function (doclets, streamFactory) {
            var _this = this;
            var fileName = this.config.outDir + "/" + this.config.rootModuleName + ".d.ts";
            var output = new TsdPlugin.IndentedOutputStream(streamFactory(fileName));
            //1st pass
            this.parseClassesAndTypedefs(doclets);
            //2nd pass
            this.processTypeMembers(doclets);
            //Process user-defined types
            this.processUserDefinedTypes();
            var tree = this.assembleModuleTree();
            TsdPlugin.ModuleUtils.outputTsd(tree, output);
            output.close(function () {
                console.log("Wrote:");
                console.log("  " + _this.stats.typedefs.user + " user-specified typedefs");
                console.log("  " + _this.stats.ifaces + " user-specified interfaces");
                console.log("  " + _this.stats.typedefs.gen + " scanned typedefs");
                console.log("  " + _this.stats.classes + " scanned classes");
                console.log("Saved TypeScript definition file to: " + fileName);
            });
        };
        return TsdGenerator;
    })();
    TsdPlugin.TsdGenerator = TsdGenerator;
})(TsdPlugin || (TsdPlugin = {}));
var TsdPlugin;
(function (TsdPlugin) {
    var IndentedOutputStream = (function () {
        function IndentedOutputStream(output /* fs.WriteStream */) {
            this.indentLevel = 0;
            this.output;
        }
        IndentedOutputStream.prototype.indent = function () {
            this.indentLevel++;
        };
        IndentedOutputStream.prototype.unindent = function () {
            this.indentLevel--;
        };
        IndentedOutputStream.prototype.indentedText = function () {
            var pattern = " ";
            var count = this.indentLevel * 4;
            if (count < 1)
                return '';
            var result = '';
            while (count > 1) {
                if (count & 1)
                    result += pattern;
                count >>= 1, pattern += pattern;
            }
            return result + pattern;
        };
        IndentedOutputStream.prototype.writeln = function (str) {
            this.output.write("" + this.indentedText() + str);
        };
        IndentedOutputStream.prototype.close = function (callback) {
            this.output.on("finish", callback);
            this.output.end();
        };
        return IndentedOutputStream;
    })();
    TsdPlugin.IndentedOutputStream = IndentedOutputStream;
})(TsdPlugin || (TsdPlugin = {}));
var TsdPlugin;
(function (TsdPlugin) {
    /**
     * Module helper utility
     */
    var ModuleUtils = (function () {
        function ModuleUtils() {
        }
        /**
         * Gets whether this module name is an AMD one
         */
        ModuleUtils.isAMD = function (name) {
            return name.indexOf("/") >= 0;
        };
        /**
         * Writes the TS module tree out to the specified output stream
         */
        ModuleUtils.outputTsd = function (module, stream) {
            for (var _i = 0, _a = module.types; _i < _a.length; _i++) {
                var type = _a[_i];
                type.output(stream);
            }
            for (var moduleName in module.children) {
                //Write module decl
                if (ModuleUtils.isAMD(moduleName)) {
                    stream.writeln("module \"" + moduleName + "\" {");
                }
                else {
                    stream.writeln("module " + moduleName + " {");
                }
                stream.indent();
                var child = module.children[moduleName];
                ModuleUtils.outputTsd(child, stream);
                stream.unindent();
                stream.writeln("}");
            }
        };
        return ModuleUtils;
    })();
    TsdPlugin.ModuleUtils = ModuleUtils;
})(TsdPlugin || (TsdPlugin = {}));
/// <reference path="./doclet.ts" />
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="./doclet.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var TsdPlugin;
(function (TsdPlugin) {
    var TSMember = (function () {
        function TSMember(doclet) {
            this.docletRef = doclet;
        }
        return TSMember;
    })();
    TsdPlugin.TSMember = TSMember;
    var TSProperty = (function (_super) {
        __extends(TSProperty, _super);
        function TSProperty(doclet) {
            _super.call(this, doclet);
        }
        TSProperty.prototype.output = function (stream) {
        };
        return TSProperty;
    })(TSMember);
    TsdPlugin.TSProperty = TSProperty;
    var TSMethod = (function (_super) {
        __extends(TSMethod, _super);
        function TSMethod(doclet) {
            _super.call(this, doclet);
        }
        TSMethod.prototype.output = function (stream) {
        };
        return TSMethod;
    })(TSMember);
    TsdPlugin.TSMethod = TSMethod;
    var TSConstructor = (function (_super) {
        __extends(TSConstructor, _super);
        function TSConstructor(doclet) {
            _super.call(this, doclet);
        }
        TSConstructor.prototype.output = function (stream) {
        };
        return TSConstructor;
    })(TSMethod);
    TsdPlugin.TSConstructor = TSConstructor;
    /**
     * Defines a TS type that resides within a module
     */
    var TSChildElement = (function () {
        function TSChildElement() {
        }
        TSChildElement.prototype.setParentModule = function (module) {
            this.parentModule = module;
        };
        TSChildElement.prototype.getParentModule = function () {
            return this.parentModule;
        };
        return TSChildElement;
    })();
    TsdPlugin.TSChildElement = TSChildElement;
    /**
     * A TS type that resides within a module that can output its representation
     */
    var TSOutputtable = (function (_super) {
        __extends(TSOutputtable, _super);
        function TSOutputtable(doclet) {
            _super.call(this);
            this.doclet = doclet;
        }
        return TSOutputtable;
    })(TSChildElement);
    TsdPlugin.TSOutputtable = TSOutputtable;
    /**
     * A TS type that has child members
     */
    var TSComposable = (function (_super) {
        __extends(TSComposable, _super);
        function TSComposable(doclet) {
            _super.call(this, doclet);
            this.members = [];
        }
        return TSComposable;
    })(TSOutputtable);
    TsdPlugin.TSComposable = TSComposable;
    /**
     * A TS typedef. This could be a type alias or an interface
     */
    var TSTypedef = (function (_super) {
        __extends(TSTypedef, _super);
        function TSTypedef(doclet) {
            _super.call(this, doclet);
        }
        TSTypedef.prototype.output = function (stream) {
        };
        return TSTypedef;
    })(TSComposable);
    TsdPlugin.TSTypedef = TSTypedef;
    /**
     * A TS class definition
     */
    var TSClass = (function (_super) {
        __extends(TSClass, _super);
        function TSClass(doclet) {
            _super.call(this, doclet);
        }
        TSClass.prototype.output = function (stream) {
        };
        return TSClass;
    })(TSComposable);
    TsdPlugin.TSClass = TSClass;
    /**
     * A user-defined interface
     */
    var TSUserInterface = (function (_super) {
        __extends(TSUserInterface, _super);
        function TSUserInterface(moduleName, name, members) {
            _super.call(this);
            this.setParentModule(moduleName);
            this.name = name;
            this.members = members;
        }
        TSUserInterface.prototype.outputDecl = function (stream) {
            stream.writeln("export interface " + this.name + " {");
            stream.indent();
            for (var _i = 0, _a = this.members; _i < _a.length; _i++) {
                var member = _a[_i];
                stream.writeln(member + ";");
            }
            stream.unindent();
            stream.writeln("}");
        };
        TSUserInterface.prototype.output = function (stream) {
            if (this.parentModule == null) {
                this.outputDecl(stream);
            }
            else {
                if (TsdPlugin.ModuleUtils.isAMD(this.parentModule))
                    stream.writeln("declare module \"" + this.parentModule + "\" {");
                else
                    stream.writeln("declare module " + this.parentModule + " {");
                stream.indent();
                this.outputDecl(stream);
                stream.unindent();
                stream.writeln("}");
            }
        };
        return TSUserInterface;
    })(TSChildElement);
    TsdPlugin.TSUserInterface = TSUserInterface;
    /**
     * A user-defined type alias
     */
    var TSUserTypeAlias = (function (_super) {
        __extends(TSUserTypeAlias, _super);
        function TSUserTypeAlias(moduleName, typeAlias, type) {
            _super.call(this);
            this.setParentModule(moduleName);
            this.typeAlias = typeAlias;
            this.type = type;
        }
        TSUserTypeAlias.prototype.outputDecl = function (stream) {
            stream.writeln("declare type " + this.typeAlias + " = " + this.type + ";");
        };
        TSUserTypeAlias.prototype.output = function (stream) {
            if (this.parentModule == null) {
                this.outputDecl(stream);
            }
            else {
                if (TsdPlugin.ModuleUtils.isAMD(this.parentModule))
                    stream.writeln("declare module \"" + this.parentModule + "\" {");
                else
                    stream.writeln("declare module " + this.parentModule + " {");
                stream.indent();
                this.outputDecl(stream);
                stream.unindent();
                stream.writeln("}");
            }
        };
        return TSUserTypeAlias;
    })(TSChildElement);
    TsdPlugin.TSUserTypeAlias = TSUserTypeAlias;
})(TsdPlugin || (TsdPlugin = {}));
//# sourceMappingURL=typescript.js.map