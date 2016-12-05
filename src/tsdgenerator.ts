module TsdPlugin {
    const CLS_DESC_PLACEHOLDER = "%TYPENAME%";

    interface IGeneratorStats {
        typedefs: {
            user: number;
            gen: number;
        },
        moduleMembers: number;
        ifaces: number;
        classes: number;
    }

    /**
     * The class that does all the grunt work
     */
    export class TsdGenerator implements ITypeRegistrar {
        private moduleMembers = new Map<string, TSMember[]>();
        private globalMembers = new Array<TSMember>();
        private moduleDoclets = new Map<string, jsdoc.IDoclet>();
        private classes = new Map<string, TSClass>();
        private typedefs = new Map<string, TSTypedef>();
        private trackedDoclets = new Map<string, jsdoc.IDoclet>();
        private userTypeAliases = new Array<TSUserTypeAlias>();
        private userInterfaces = new Array<TSUserInterface>();
        private ignoreTypes = new Set<string>();

        private stats: IGeneratorStats = {
            typedefs: {
                user: 0,
                gen: 0
            },
            moduleMembers: 0,
            ifaces: 0,
            classes: 0
        };
        
        private config: IPluginConfig;

        constructor(config: IPluginConfig) {

            const defaults: IPluginConfig = {
                rootModuleName: "generated",
                outDir: ".",
                typeReplacements: {
                    "*":        "any",
                    "?":        "any",
                    "Object":   "any",
                    "function": "Function"
                },
                defaultCtorDesc: `Constructor for ${CLS_DESC_PLACEHOLDER}`,
                fillUndocumentedDoclets: false,
                outputDocletDefs: false,
                publicAnnotation: null,
                defaultReturnType: "any",
                aliases: {
                    global: {},
                    module: {}
                },
                interfaces: {
                    global: {},
                    module: {}
                },
                ignoreTypes: [],
                makePublic: [],
                headerFile: undefined,
                footerFile: undefined,
                memberReplacements: {},
                declareTopLevelElements: true,
                ignoreModules: [],
                skipUndocumentedDoclets: true,
                initialIndentation: 0,
                globalModuleAliases: [],
                useUnionTypeForStringEnum: false,
                processAsEnums: {
                    //native: [],
                    classes: {}
                },
                classTypeAugmentations: {}
            };

            this.config = Object.assign(defaults, config, {
                aliases:          Object.assign(defaults.aliases, config.aliases),
                interfaces:       Object.assign(defaults.interfaces, config.interfaces),
                processAsEnums:   Object.assign(defaults.processAsEnums, config.processAsEnums),
                typeReplacements: Object.assign(defaults.typeReplacements, config.typeReplacements)
            });

            for (let ignoreType of this.config.ignoreTypes) {
                this.ignoreTypes.add(ignoreType);
            }
        }

        private shouldIgnoreType(fullname: string): boolean {
          return this.ignoreTypes.has(fullname);
        }
        
        private ensureClassDef(name: string, factory?: () => TSClass): TSClass {
            if (!this.classes.has(name)) {
                if (factory != null) {
                    let cls = factory();
                    this.classes.set(name, cls);
                    return cls;
                } else {
                    return null;
                }
            } else {
                return this.classes.get(name);
            }
        }

        private ensureTypedef(name: string, factory?: () => TSTypedef): TSTypedef {
            if (!this.typedefs.has(name)) {
                if (factory != null) {
                    let tdf = factory();
                    this.typedefs.set(name, tdf);
                    return tdf;
                } else {
                    return null;
                }
            } else {
                return this.typedefs.get(name);
            }
        }
        
        public registerTypedef(name: string, typedef: TSTypedef): boolean {
            if (!this.typedefs.has(name)) {
                this.typedefs.set(name, typedef);
                return true;
            }
            return false;
        }
        
        private isTSInterfaceCandidate(doclet: jsdoc.IDoclet): boolean {
            return !TsdGenerator.isCallbackType(doclet) && //Because callback types could also be through typedefs
                   (doclet.kind == DocletKind.Typedef ||
                   (doclet.comment || "").indexOf("@record") >= 0); 
        }
        
        private parseClassesAndTypedefs(doclets: jsdoc.IDoclet[]): void {
            for (let doclet of doclets) {
                //On ignore list
                if (this.shouldIgnoreType(doclet.longname))
                    continue;
                //Undocumented and we're ignoring them
                if (doclet.undocumented && this.config.skipUndocumentedDoclets)
                    continue;

                //TypeScript definition covers a module's *public* API surface, so
                //skip private classes
                let isPublic = !(TypeUtil.isPrivateDoclet(doclet, this.config));
                let parentModName = null;
                if (doclet.longname.indexOf("module:") >= 0) {
                    //Assuming that anything annotated "module:" will have a "." to denote end of module and start of class name
                    let modLen = "module:".length;
                    let dotIdx = doclet.longname.indexOf(".");
                    if (dotIdx < 0)
                        dotIdx = doclet.longname.length;
                    parentModName = doclet.longname.substring(modLen, dotIdx);
                } else if (doclet.memberof) {
                    parentModName = doclet.memberof;
                }
                let makeGlobal = this.config.globalModuleAliases.indexOf(parentModName) >= 0;
                if (doclet.kind == DocletKind.Class) {
                    //Key class definition on longname
                    let cls = this.ensureClassDef(doclet.longname, () => new TSClass(doclet));
                    cls.setIsPublic(isPublic);
                    if (parentModName != null)
                        cls.setParentModule(parentModName);
                    if (doclet.params != null)
                        cls.ctor = new TSConstructor(doclet);
                    this.trackedDoclets.set(doclet.longname, doclet);
                } else if (TsdGenerator.isCallbackType(doclet)) {
                    if (parentModName != null && !this.moduleMembers.has(parentModName))
                        this.moduleMembers.set(parentModName, []);
                    let method = new TSMethod(doclet)
                    method.setIsModule(true);
                    method.setIsTypedef(true);
                    if (parentModName != null && !makeGlobal)
                        this.moduleMembers.get(parentModName).push(method);
                    else if (makeGlobal)
                        this.globalMembers.push(method);
                    this.trackedDoclets.set(doclet.longname, doclet);
                } else if (this.isTSInterfaceCandidate(doclet)) {
                    let tdf = null;
                    if (makeGlobal)
                        tdf = new TSTypedef(doclet);
                    else
                        tdf = this.ensureTypedef(doclet.longname, () => new TSTypedef(doclet));
                    tdf.setIsPublic(isPublic);
                    if (parentModName != null && !makeGlobal)
                        tdf.setParentModule(parentModName);
                    else if (makeGlobal)
                        this.globalMembers.push(tdf);
                    this.trackedDoclets.set(doclet.longname, doclet);
                } else if (TsdPlugin.FunctionTypedefRewriter.getDocletKind(doclet) == DocletKind.Function) {
                    let parentModule = doclet.memberof;
                    if (parentModule == null) {
                        let method = new TSMethod(doclet);
                        method.setIsModule(true);
                        method.setIsPublic(isPublic);
                        method.setIsTypedef(false);
                        this.globalMembers.push(method);
                        this.trackedDoclets.set(doclet.longname, doclet);
                    }
                } else if (TypeUtil.isEnumDoclet(doclet)) {
                    let tdf = null;
                    if (makeGlobal)
                        tdf = new TSTypedef(doclet);
                    else
                        tdf = this.ensureTypedef(doclet.longname, () => new TSTypedef(doclet));
                    tdf.setIsPublic(isPublic);
                    if (parentModName != null && !makeGlobal)
                        tdf.setParentModule(parentModName);
                    else if (makeGlobal)
                        this.globalMembers.push(tdf);
                    this.trackedDoclets.set(doclet.longname, doclet);
                }
            }
        }

        private parseModules(doclets: jsdoc.IDoclet[]): void {
            for (let doclet of doclets) {
                //Already covered in 1st pass
                if (this.trackedDoclets.has(doclet.longname))
                    continue;
                //On ignore list
                if (this.shouldIgnoreType(doclet.longname))
                    continue;
                //Undocumented and we're ignoring them
                if (doclet.undocumented && this.config.skipUndocumentedDoclets)
                    continue;
                
                if (doclet.kind == DocletKind.Module) {
                    this.moduleDoclets.set(doclet.name, doclet);
                    this.trackedDoclets.set(doclet.longname, doclet);
                }
            }
        }

        private static isCallbackType(doclet: jsdoc.IDoclet): boolean {
            return doclet.kind == DocletKind.Typedef && 
                   doclet.type != null &&
                   doclet.type.names != null &&
                   doclet.type.names.indexOf("function") >= 0 &&
                   //This is to check that the function type was documented using @callback instead of @typedef
                   (doclet.comment || "").indexOf("@callback") >= 0;
        }

        private processTypeMembers(doclets: jsdoc.IDoclet[], logger: ILogger): void {
            for (let doclet of doclets) {
                //Already covered in 1st pass
                if (this.trackedDoclets.has(doclet.longname))
                    continue;
                //On the ignore list
                if (this.shouldIgnoreType(doclet.longname))
                    continue;
                //Undocumented and we're ignoring them
                if (doclet.undocumented && this.config.skipUndocumentedDoclets)
                    continue;
                            
                let isPublic = !TypeUtil.isPrivateDoclet(doclet, this.config);

                //We've keyed class definition on longname, so memberof should
                //point to it
                let cls: TSComposable = this.ensureClassDef(doclet.memberof);
                let isTypedef = false;
                let isClass = true;
                
                if (!cls) {
                    isClass = false;
                    //Failing that it would've been registered as a typedef
                    cls = this.ensureTypedef(doclet.memberof);
                    if (!cls) {
                        //Bail on this iteration here if not public
                        if (!isPublic)
                            continue;

                        //Before we bail, let's assume this is a module level member and
                        //see if it's the right doclet kind
                        let parentModule = doclet.memberof;
                        if (parentModule == null)
                            continue;

                        parentModule = ModuleUtils.cleanModuleName(parentModule);
                        
                        //HACK-ish: If we found an enum, that this is a member of, skip it if it already exists
                        let parentDoclet = this.trackedDoclets.get(doclet.memberof);
                        if (parentDoclet != null && TypeUtil.isEnumDoclet(parentDoclet)) {

                            let matches = (parentDoclet.properties || []).filter(prop => prop.name == doclet.name);
                            if (matches.length > 0)
                                continue;
                        }

                        if (doclet.kind == DocletKind.Function) {
                            if (!this.moduleMembers.has(parentModule))
                                this.moduleMembers.set(parentModule, []);
                            let method = new TSMethod(doclet)
                            method.setIsModule(true);
                            this.moduleMembers.get(parentModule).push(method);
                        } else if (doclet.kind == DocletKind.Constant || doclet.kind == DocletKind.Value || (doclet.kind == DocletKind.Member && doclet.params == null)) {
                            if (!this.moduleMembers.has(parentModule))
                                this.moduleMembers.set(parentModule, []);
                            let prop = new TSProperty(doclet, false);
                            prop.setIsModule(true);

                            this.moduleMembers.get(parentModule).push(prop);
                        }
                        continue;
                    } else {
                        isTypedef = true;
                    }
                }
                
                if (doclet.kind == DocletKind.Function) {
                    let method = new TSMethod(doclet);
                    method.setIsPublic(isPublic);
                    cls.addMember(method, logger);
                } else if (doclet.kind == DocletKind.Constant || doclet.kind == DocletKind.Value || (doclet.kind == DocletKind.Member && doclet.params == null)) {
                    let prop = new TSProperty(doclet, isTypedef);                   
                    prop.setIsPublic(isPublic);
                    cls.addMember(prop, logger);
                }
            }
        }

        private processUserDefinedTypes(): void {
            //Output user-injected type aliases
            //global
            for (let typeAlias in this.config.aliases.global) {
                let typeName = this.config.aliases.global[typeAlias];
                this.userTypeAliases.push(
                    new TSUserTypeAlias(null, typeAlias, typeName));
            }
            //module
            for (let moduleName in this.config.aliases.module) {
                for (let typeAlias in this.config.aliases.module[moduleName]) {
                    let typeName = this.config.aliases.module[moduleName][typeAlias];
                    this.userTypeAliases.push(
                        new TSUserTypeAlias(moduleName, typeAlias, typeName));
                }
            }
            //Output user-injected interfaces
            //global
            for (let typeName in this.config.interfaces.global) {
                let iface = this.config.interfaces.global[typeName];
                this.userInterfaces.push(
                    new TSUserInterface(null, typeName, iface));
            }
            //module
            for (let moduleName in this.config.interfaces.module) {
                for (let typeName in this.config.interfaces.module[moduleName]) {
                    let iface = this.config.interfaces.module[moduleName][typeName];
                    this.userInterfaces.push(
                        new TSUserInterface(moduleName, typeName, iface));
                }
            }
        }

        private hoistPubliclyReferencedTypesToPublic(logger: ILogger): Map<string, IOutputtable> {
            let publicTypes = new Map<string, IOutputtable>();
            let context = new TypeVisibilityContext(this);
            
            //First, visit all known public types and collect referenced types
            for (let typedef of this.userTypeAliases) {
                typedef.visit(context, this.config, logger);
            }
            for (let iface of this.userInterfaces) {
                iface.visit(context, this.config, logger);
            }
            this.moduleMembers.forEach((members, moduleName) => {
                for (let member of members) {
                    member.visit(context, this.config, logger);
                }
            });
            this.classes.forEach((cls, typeName) => {
                if (cls.getIsPublic())
                    cls.visit(context, this.config, logger);
            });
            this.typedefs.forEach((tdf, typeName) => {
                if (tdf.getIsPublic())
                    tdf.visit(context, this.config, logger);
            });
            
            let userTypes = {};
            for (let typedef of this.userTypeAliases) {
                userTypes[typedef.getQualifiedName()] = typedef;
            }
            for (let iface of this.userInterfaces) {
                userTypes[iface.getQualifiedName()] = iface;
            }
            
            //Now that we've collected all referenced types, see what isn't public and
            //make them public
            //
            //Each type that is encountered is checked if it is public, if it is not
            //public then the type is "promoted" to public and its referenced types are
            //added to the context. At the same time, each type that has been checked
            //is removed from the context
            //
            //We repeat this process until the context is empty
            //
            //But before we start, auto-hoist any type in the "makePublic" list 
            for (let typeName of this.config.makePublic) {
                console.log(`Checking if (${typeName}) needs to be hoisted`);
                if (this.classes.has(typeName)) {
                    let cls = this.classes.get(typeName);
                    if (!cls.getIsPublic()) {
                        //logger.warn(`class (${typeName}) is referenced in one or more public APIs, but itself is not public. Making this public`);
                        cls.setIsPublic(true);
                        console.log(`Hoisting (${typeName}) to public API`);
                        //Have to visit to we know what extra types to check for
                        cls.visit(context, this.config, logger);
                    }
                } else if (this.typedefs.has(typeName)) {
                    let tdf = this.typedefs.get(typeName);
                    if (!tdf.getIsPublic()) {
                        //logger.warn(`typedef (${typeName}) is referenced in one or more public APIs, but itself is not public. Making this public`);
                        tdf.setIsPublic(true);
                        console.log(`Hoisting (${typeName}) to public API`);
                        //Have to visit so we know what extra types to check for
                        tdf.visit(context, this.config, logger);
                    }
                }
            }

            let pass = 1;
            while (!context.isEmpty()) {
                //NOTE: This is an array copy. Any new types added in this
                //pass should not affect the iterated array
                let allTypes = context.getTypes();
                //console.log(`Pass ${pass}: ${allTypes.length} types remaining to check`);
                for (let typeName of allTypes) {
                    //console.log(`Checking type: ${typeName}`);
                    if (this.classes.has(typeName)) {
                        let cls = this.classes.get(typeName);
                        if (!cls.getIsPublic()) {
                            logger.warn(`class (${typeName}) is referenced in one or more public APIs, but itself is not public. Making this public`);
                            cls.setIsPublic(true);
                            //Have to visit to we know what extra types to check for
                            cls.visit(context, this.config, logger);
                        } else {
                            publicTypes.set(cls.getFullName(), cls);
                        }
                    } else if (this.typedefs.has(typeName)) {
                        let tdf = this.typedefs.get(typeName);
                        if (!tdf.getIsPublic()) {
                            logger.warn(`typedef (${typeName}) is referenced in one or more public APIs, but itself is not public. Making this public`);
                            tdf.setIsPublic(true);
                            //Have to visit so we know what extra types to check for
                            tdf.visit(context, this.config, logger);
                        } else {
                            publicTypes.set(tdf.getFullName(), tdf);
                        }
                    } else if (userTypes[typeName]) {
                        //If the user defines a type, it means they want said type on
                        //the public API surface already. Nothing to do here.
                        publicTypes.set(userTypes[typeName], userTypes[typeName]);
                    } else {
                        //TODO: Generate "any" type alias
                        //TODO: But only if it is not a built-in type (eg. A DOM class)
                        logger.warn(`Type (${typeName}) is referenced in one or more public APIs, but no definition for this type found`);
                    }
                    //Type has been checked, remove from context
                    context.removeType(typeName);
                }
                pass++;
            }
            
            return publicTypes;
        }

        private ensureModuleTree(root: ITSModule, moduleNameParts: string[]): ITSModule {
            let tree: ITSModule = root;
            for (let i = 0; i < moduleNameParts.length; i++) {
                let name = moduleNameParts[i];
                //Doesn't exist at this level, make it
                if (!tree.children.has(name)) {
                    tree.children.set(name, {
                        isRoot:   (i == 0),
                        children: new Map(),
                        types:    []
                    });
                }
                tree = tree.children.get(name);
            }
            return tree;
        }

        private resolveType(tree: ITSModule, typeNameParts: string[]): TSComposable|ITSModule {
            if (typeNameParts.length == 0) {
                return null;
            }
            if (typeNameParts.length == 1) {
                let matches = tree.types.filter(t => t.getDoclet().name == typeNameParts[0]);
                if (matches.length == 0) {
                    if (tree.children.has(typeNameParts[0])) {
                        return tree.children.get(typeNameParts[0]);
                    }
                }

                if (matches.length == 1) {
                    const match = matches[0];
                    const kind = match.getKind();
                    if (match instanceof TSComposable) {
                        return match;
                    }
                }
            } else {
                if (tree.children.has(typeNameParts[0])) {
                    const childTree = tree.children.get(typeNameParts[0]);
                    return this.resolveType(childTree, typeNameParts.slice(1));
                }
            }
            return null;
        }

        private putDefinitionInTree(type: IOutputtable, moduleName: string, root: ITSModule, logger: ILogger): boolean {
            if (moduleName == null) {
                if (TypeUtil.isTsElementNotPublic(type)) {
                    return false;
                }
                root.types.push(type);
                return true;
            } else {
                let moduleNameClean = ModuleUtils.cleanModuleName(moduleName);
                if (moduleNameClean.indexOf("#") >= 0) {
                    //This is an illegal module name and most likely the result of parsing an inner object property
                    //from within an AMD module (or it could be bad JSDoc documentation)
                    //
                    //NOTE: This ultimately doesn't actually do anyting at the moment. All returns will be false and 
                    //this type won't be added, but it should at least log something useful along the way
                    const parts = moduleNameClean.split("#");
                    const parentName = parts[0];
                    const memberName = parts[1];
                    const resolvedType = this.resolveType(root, parentName.split("."));
                    if (resolvedType == null) {
                        return false;
                    }
                    if (resolvedType instanceof TSComposable) {
                        const resolvedMember = resolvedType.findMember(memberName, false /* # implies instance member */);
                        if (resolvedMember == null) {
                            logger.warn(`Type or member (${type.getFullName()}) has a parent of (${moduleNameClean}) which doesn't resolve to any processed type. Skipping this type`);
                            return false;
                        } else {
                            logger.warn(`Type or member (${type.getFullName()}) has a parent of (${moduleNameClean}) which resolves to a known member, but this plugin doesn't know how to process this type yet. Skipping`);
                            return false;
                        }
                    } else { //module
                        const matchingMembers = resolvedType.types.filter(t => t.getDoclet().name == memberName);;
                        if (matchingMembers.length == 1) {
                            logger.warn(`Type or member (${type.getFullName()}) has a parent of (${moduleNameClean}) which doesn't resolve to any processed type. Skipping this type`);
                            return false;
                        } else {
                            logger.warn(`Type or member (${type.getFullName()}) has a parent of (${moduleNameClean}) which resolves to a known module member, but this plugin doesn't know how to process this type yet. Skipping`);
                            return false;
                        }
                    }
                } else {
                    //Before we put the definition in, if it is a function or constant and its parent module is private or
                    //configured to be ignored, skip it.
                    let bIgnoreThisType = (type.getKind() == TSOutputtableKind.Method || type.getKind() == TSOutputtableKind.Property) &&
                        (
                            (this.moduleDoclets.has(moduleNameClean) && TypeUtil.isPrivateDoclet(this.moduleDoclets.get(moduleNameClean), this.config)) ||
                            (this.config.ignoreModules.indexOf(moduleNameClean) >= 0)
                        );
                    if (bIgnoreThisType) {
                        return false;
                    }
                    
                    if (TypeUtil.isTsElementNotPublic(type)) {
                        return false;
                    }
                    
                    if (ModuleUtils.isAMD(moduleNameClean)) {
                        //No nesting required for AMD modules
                        if (!root.children.has(moduleNameClean)) {
                            root.children.set(moduleNameClean, {
                                isRoot:   true,
                                children: new Map(),
                                types:    []
                            });
                        }
                        root.children.get(moduleNameClean).types.push(type);
                        return true;
                    } else {
                        //Explode this module name and see how many levels we need to go
                        let moduleNameParts = moduleNameClean.split(".");
                        let tree = this.ensureModuleTree(root, moduleNameParts);
                        tree.types.push(type);
                        return true;
                    }
                }
            }
        }

        /**
         * This method groups all of our collected TS types according to their parent module
         */
        private assembleModuleTree(logger: ILogger): ITSModule {
            let root: ITSModule = {
                isRoot:   null,
                children: new Map(),
                types:    []
            };
            for (let typedef of this.userTypeAliases) {
                let moduleName = typedef.getParentModule();
                if (this.putDefinitionInTree(typedef, moduleName, root, logger))
                    this.stats.typedefs.user++;
            }
            for (let iface of this.userInterfaces) {
                let moduleName = iface.getParentModule();
                if (this.putDefinitionInTree(iface, moduleName, root, logger))
                    this.stats.ifaces++;
            }
            for (let oType of this.globalMembers) {
                //console.log(`Adding ${oType.getFullName()} to global namespace`);
                if (oType instanceof TSMember && !oType.getIsPublic())
                    continue;
                if (oType instanceof TSComposable && !oType.getIsPublic())
                    continue;
                root.types.push(oType);
            }
            this.classes.forEach((cls, typeName) => {
                if (!cls.getIsPublic())
                    return;
                console.log(`Processing class: ${typeName}`);
                let moduleName = cls.getParentModule();
                if (this.putDefinitionInTree(cls, moduleName, root, logger))
                    this.stats.classes++;
            });
            this.typedefs.forEach((tdf, typeName) => {
                if (!tdf.getIsPublic())
                    return;
                console.log(`Processing typedef: ${typeName}`);
                let moduleName = tdf.getParentModule();
                if (this.putDefinitionInTree(tdf, moduleName, root, logger))
                    this.stats.typedefs.gen++;
            });
            this.moduleMembers.forEach((members, modName) => {
                for (let member of members) {
                    if (this.putDefinitionInTree(member, modName, root, logger))
                        this.stats.moduleMembers++;
                }
            });
            return root;
        }

        public dumpDoclets(doclets: jsdoc.IDoclet[], streamFactory: IFileStreamFactory) {
            let fileName = `${this.config.outDir}/${this.config.rootModuleName}.doclets.txt`;
            let output = new IndentedOutputStream(streamFactory.createStream(fileName), streamFactory.endl);
            
            for (let doc of doclets) {
                output.writeln(DumpDoclet(doc));
            }
            
            output.close(() => {
                console.log(`Saved dumped doclets to: ${fileName}`);
            });
        }

        public process(doclets: jsdoc.IDoclet[], streamFactory: IFileStreamFactory, logger: ILogger): void {
            let fileName = `${this.config.outDir}/${this.config.rootModuleName}.d.ts`;
            let output = new IndentedOutputStream(streamFactory.createStream(fileName), streamFactory.endl);
            
            //1st pass
            this.parseClassesAndTypedefs(doclets);
            //2nd pass. We process modules in this pass instead of the 1st so that enums do not get double-registered as modules as well
            this.parseModules(doclets);
            //3rd pass
            this.processTypeMembers(doclets, logger);
            //Process user-defined types
            this.processUserDefinedTypes();
            //Raise any non-public types referenced from public types to public
            let publicTypes = this.hoistPubliclyReferencedTypesToPublic(logger);
            
            //Write custom header if specified
            if (this.config.headerFile != null) {
                let header = streamFactory.readText(this.config.headerFile);
                output.writeln(header);
            }
            
            //Write the main d.ts body
            let tree = this.assembleModuleTree(logger);
            for (let i = 0; i < this.config.initialIndentation; i++) {
                output.indent();
            }
            ModuleUtils.outputTsd(tree, output, this.config, logger, publicTypes);
            for (let i = 0; i < this.config.initialIndentation; i++) {
                output.unindent();
            }
            
            //Write custom footer if specified
            if (this.config.headerFile != null) {
                let footer = streamFactory.readText(this.config.footerFile);
                output.writeln(footer);
            }

            output.close(() => {
                console.log("Wrote:");
                console.log(`  ${this.stats.typedefs.user} user-specified typedefs`);
                console.log(`  ${this.stats.ifaces} user-specified interfaces`);
                console.log(`  ${this.stats.moduleMembers} module members`);
                console.log(`  ${this.stats.typedefs.gen} scanned typedefs`);
                console.log(`  ${this.stats.classes} scanned classes`);
                console.log(`Saved TypeScript definition file to: ${fileName}`);
            });
        }
    }
}
