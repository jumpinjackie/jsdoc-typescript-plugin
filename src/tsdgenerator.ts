module TsdPlugin {
    const CLS_DESC_PLACEHOLDER = "%TYPENAME%";

    interface IGeneratorStats {
        typedefs: {
            user: number;
            gen: number;
        },
        ifaces: number;
        classes: number;
    }

    /**
     * The class that does all the grunt work
     */
    export class TsdGenerator {
        private classes: Dictionary<TSClass>;
        private typedefs: Dictionary<TSTypedef>;
        private userTypeAliases: TSUserTypeAlias[];
        private userInterfaces: TSUserInterface[];
        
        private config: ITypeScriptPluginConfiguration;
        private stats: IGeneratorStats;
        constructor(config: any) {
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
            }
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
            //Register standard TS type replacements
            this.config.typeReplacements["*"] = "any";
            this.config.typeReplacements["?"] = "any";
            this.config.typeReplacements["Object"] = "any";
            this.config.typeReplacements["function"] = "Function";
        }
        private ignoreThisType(fullname: string): boolean {
            if (this.config.ignoreTypes[fullname])
                return true;
            else
                return false;
        }
        private isPrivateDoclet(doclet: IDoclet): boolean {
            //If the configuration defines a particular annotation as a public API marker and it
            //exists in the doclet's tag list, the doclet is considered part of the public API
            if (this.config.publicAnnotation) {
                var found = (doclet.tags || []).filter(tag => tag.originalTitle == this.config.publicAnnotation);
                if (found.length == 1) //tag found
                    return false;
                
                //In this mode, absence of the tag means not public
                return true;
            }
            
            return doclet.access == "private" ||
                doclet.undocumented == true;
        }
        private ensureClassDef(name: string, factory?: () => TSClass): TSClass {
            if (!this.classes[name]) {
                if (factory != null) {
                    var cls = factory();
                    this.classes[name] = cls;
                    return cls;
                } else {
                    return null;
                }
            } else {
                return this.classes[name];
            }
        }
        private ensureTypedef(name: string, factory?: () => TSTypedef): TSTypedef {
            if (!this.typedefs[name]) {
                if (factory != null) {
                    var tdf = factory();
                    this.typedefs[name] = tdf;
                    return tdf;
                } else {
                    return null;
                }
            } else {
                return this.typedefs[name];
            }
        }
        private parseClassesAndTypedefs(doclets: IDoclet[]): void {
            for (var doclet of doclets) {
                if (this.ignoreThisType(doclet.longname))
                    continue;
                //TypeScript definition covers a module's *public* API surface, so
                //skip private classes
                if (this.isPrivateDoclet(doclet))
                    continue;
                
                var parentModName = null;
                if (doclet.longname.indexOf("module:") >= 0) {
                    //Assuming that anything annotated "module:" will have a "." to denote end of module and start of class name
                    var modLen = "module:".length;
                    var dotIdx = doclet.longname.indexOf(".");
                    if (dotIdx < 0)
                        dotIdx = doclet.longname.length;
                    parentModName = doclet.longname.substring(modLen, dotIdx);
                } else if (doclet.memberof) {
                    parentModName = doclet.memberof;
                }
                if (doclet.kind == "class") {
                    //Key class definition on longname
                    var cls = this.ensureClassDef(doclet.longname, () => new TSClass(doclet));
                    if (parentModName != null)
                        cls.setParentModule(parentModName);
                } else if (doclet.kind == "typedef") {
                    var tdf = this.ensureTypedef(doclet.longname, () => new TSTypedef(doclet));
                    if (parentModName != null)
                        tdf.setParentModule(parentModName);
                }
            }
        }
        private processTypeMembers(doclets: IDoclet[]): void {
            for (var doclet of doclets) {
                if (this.ignoreThisType(doclet.longname))
                    continue;
                //TypeScript definition covers a module's *public* API surface, so
                //skip private classes
                if (this.isPrivateDoclet(doclet))
                    continue;

                //We've keyed class definition on longname, so memberof should
                //point to it
                var cls: TSComposable = this.ensureClassDef(doclet.memberof);
                if (!cls) {
                    //Failing that it would've been registered as a typedef
                    cls = this.ensureTypedef(doclet.memberof);
                    if (!cls)
                        continue;
                }
                
                if (doclet.kind == "value") {
                    cls.members.push(new TSProperty(doclet));
                } else if (doclet.kind == "function") {
                    cls.members.push(new TSMethod(doclet));
                }
            }
        }
        private processUserDefinedTypes(): void {
            //Output user-injected type aliases
            //global
            for (var typeAlias in this.config.aliases.global) {
                this.userTypeAliases.push(new TSUserTypeAlias(null, typeAlias, this.config.aliases.global[typeAlias]));
            }
            //module
            for (var moduleName in this.config.aliases.module) {
                for (var typeAlias in this.config.aliases.module[moduleName]) {
                    this.userTypeAliases.push(new TSUserTypeAlias(moduleName, typeAlias, this.config.aliases.module[moduleName][typeAlias]));
                }
            }
            //Output user-injected interfaces
            //global
            for (var typeName in this.config.interfaces.global) {
                var iface = this.config.interfaces.global[typeName];
                this.userInterfaces.push(new TSUserInterface(null, typeName, iface));
            }
            //module
            for (var moduleName in this.config.interfaces.module) {
                for (var typeName in this.config.interfaces.module[moduleName]) {
                    var iface = this.config.interfaces.module[moduleName][typeName];
                    this.userInterfaces.push(new TSUserInterface(moduleName, typeName, iface));
                }
            }
        }
        private static ensureModuleTree(root: ITSModule, moduleNameParts: string[]): ITSModule {
            var tree: ITSModule = root;
            var i = 0;
            for (var name of moduleNameParts) {
                //Doesn't exist at this level, make it
                if (!tree.children[name]) {
                    tree.children[name] = {
                        isRoot: (i == 0),
                        children: {},
                        types: []
                    }
                }
                tree = tree.children[name];
                i++;
            }
            return tree;
        }
        private static putTypeInTree(type: IOutputtable, moduleName: string, root: ITSModule): boolean {
            if (moduleName == null) {
                root.types.push(type);
                return true;
            } else {
                if (ModuleUtils.isAMD(moduleName)) {
                    //No nesting required for AMD modules
                    if (!root.children[moduleName]) {
                        root.children[moduleName] = {
                            isRoot: true,
                            children: {},
                            types: []
                        }
                    }
                    root.children[moduleName].types.push(type);
                    return true;
                } else {
                    //Explode this module name and see how many levels we need to go
                    var moduleNameParts = moduleName.split(".");
                    var tree = TsdGenerator.ensureModuleTree(root, moduleNameParts);
                    tree.types.push(type);
                    return true;
                }
            }
        }
        /**
         * This method groups all of our collected TS types according to their parent module
         */
        private assembleModuleTree(): ITSModule {
            var root: ITSModule = {
                isRoot: null,
                children: {},
                types: []
            };
            for (var typedef of this.userTypeAliases) {
                var moduleName = typedef.getParentModule();
                if (TsdGenerator.putTypeInTree(typedef, moduleName, root) === true)
                    this.stats.typedefs.user++;
            }
            for (var iface of this.userInterfaces) {
                var moduleName = iface.getParentModule();
                if (TsdGenerator.putTypeInTree(iface, moduleName, root) === true)
                    this.stats.ifaces++;
            }
            for (var typeName in this.classes) {
                console.log(`Processing class: ${typeName}`);
                var cls = this.classes[typeName];
                var moduleName = cls.getParentModule();
                if (TsdGenerator.putTypeInTree(cls, moduleName, root) === true)
                    this.stats.classes++;
            }
            for (var typeName in this.typedefs) {
                console.log(`Processing typedef: ${typeName}`);
                var tdf = this.typedefs[typeName];
                var moduleName = tdf.getParentModule();
                if (TsdGenerator.putTypeInTree(tdf, moduleName, root) === true)
                    this.stats.typedefs.gen++;
            }
            return root;
        }
        
        public process(doclets: IDoclet[], streamFactory: (fileName: string) => any, logger: ILogger): void {
            var fileName = `${this.config.outDir}/${this.config.rootModuleName}.d.ts`;
            var output = new IndentedOutputStream(streamFactory(fileName));
            
            //1st pass
            this.parseClassesAndTypedefs(doclets);
            
            console.log(`Parsed ${Object.keys(this.classes)} classes`);
            
            //2nd pass
            this.processTypeMembers(doclets);
            //Process user-defined types
            this.processUserDefinedTypes();
            
            var tree = this.assembleModuleTree();
            ModuleUtils.outputTsd(tree, output, this.config, logger);
            
            output.close(() => {
                console.log("Wrote:");
                console.log(`  ${this.stats.typedefs.user} user-specified typedefs`);
                console.log(`  ${this.stats.ifaces} user-specified interfaces`);
                console.log(`  ${this.stats.typedefs.gen} scanned typedefs`);
                console.log(`  ${this.stats.classes} scanned classes`);
                console.log(`Saved TypeScript definition file to: ${fileName}`);
            });
        }
    }
}