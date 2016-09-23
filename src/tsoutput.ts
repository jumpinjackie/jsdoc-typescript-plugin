
module TsdPlugin {
    /**
     * Defines the type of TypeScript element
     */
    export enum TSOutputtableKind {
        Typedef,
        Class,
        Method,
        Property,
        UserInterface,
        UserTypeAlias
    }
    
    function CamelCase(name: string) {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    /**
     * The default filter function for any JSON.stringify calls
     */
    function JsDocletStringifyFilter(key: string, value: any): any { 
        if (key === "comment") { 
            return undefined; 
        }
        if (key == "meta") {
            return undefined;
        }
        return value; 
    }
    
    export function DumpDoclet(doclet: jsdoc.IDoclet) {
        return JSON.stringify(doclet, JsDocletStringifyFilter, 4);
        //return JSON.stringify(doclet, null, 4);
    }
    
    /**
     * Allows for additional typedefs to be registered during the pre-processing phase
     */
    export interface ITypeRegistrar {
        registerTypedef(name: string, item: IOutputtable): boolean;
    }
    
    //TODO: Generic placeholder parameters are being added, which may trip up the type hoisting afterwards
    //TODO: It would be nice to filter out built-in types (ie. types in TypeScript's lib.d.ts)
    export class TypeVisibilityContext {
        protected types = new Set<string>();
        private ignore = new Set([
            "number",
            "Number",
            "undefined",
            "null",
            "string",
            "String",
            "boolean",
            "Boolean"
        ]);

        constructor(private reg: ITypeRegistrar) {}
        public registerTypedef(name: string, typedef: IOutputtable): string {
            let registeredName = name;
            if (this.reg != null) {
                let bRegistered = this.reg.registerTypedef(name, typedef);
                //TODO: Handle the case of name collision (bRegistered = false)
            }
            return registeredName;
        }
        public removeType(typeName: string): void {
            if (this.hasType(typeName)) {
                this.types.delete(typeName);
            }
        }
        public hasType(typeName: string): boolean {
            return this.types.has(typeName);
        }
        public addType(typeName: string, conf: IPluginConfig, logger: ILogger) {
            this.addTypes([ typeName ], conf, logger);
        }
        private shouldIgnoreType(typeName: string): boolean {
            return this.ignore.has(typeName);
        }
        public addTypes(typeNames: string[], conf: IPluginConfig, logger: ILogger) {
            for (let type of typeNames) {
                if (!this.shouldIgnoreType(type)) {
                    this.types.add(type);
                }
            }
        }
        public isEmpty(): boolean { return this.types.size === 0; }
        public getTypes(): string[] { return Array.from(this.types.keys()); }
    }
    
    //This is bit of a hack, but we want fixStringEnumTypes to be available in
    //a class that quacks like a TypeVisibilityContext, so we have the opportunity
    //to fix keys in a kvp during type replacement
    
    class ReadOnlyTypeVisibilityContext extends TypeVisibilityContext {
        private publicTypes: Map<string, IOutputtable>;
        constructor(reg: ITypeRegistrar, publicTypes: Map<string, IOutputtable>) {
            super(reg);
            this.publicTypes = publicTypes;
        }
        public fixEnumTypes(typeNames: string[], conf: IPluginConfig): void {
            TypeUtil.fixEnumTypes(typeNames, this.publicTypes, conf);
        }
        public addTypes(typeNames: string[], conf: IPluginConfig, logger: ILogger) {}
        public addType(typeName: string, conf: IPluginConfig, logger: ILogger) {}
    }
    
    export class TypeUtil {
        
        /**
         * Returns a clean version of the given type name, stripped of whatever JSDoc-isms
         */
        public static cleanTypeName(name: string, bQualified = false): string {
            let parts = name.replace("module:", "").split("~");
            let qualifiedName = parts[parts.length - 1];
            if (!qualifiedName) {
                let nParts = qualifiedName.split(".");
                return nParts[nParts.length - 1];
            }
            return qualifiedName;
        }
        
        public static isTsElementNotPublic(type: IOutputtable): boolean {
            if (type instanceof TSMethod) {
                return !type.getIsPublic();
            }
            if (type instanceof TSComposable) {
                return !type.getIsPublic();
            }
            return false;
        }
        
        public static isEnumDoclet(doclet: jsdoc.IDoclet): boolean {
            return (doclet.kind == DocletKind.Member &&
                   doclet.isEnum === true &&
                   (doclet.properties || []).length > 0) || (doclet.comment || "").indexOf("@enum") >= 0;
        }
        
        /**
         * Fixes any references to class-type "enums"
         */
        public static fixEnumTypeReferences(
          typeNames: string[],
          conf:      IPluginConfig
        ): string[] {
            return typeNames.map(rt => {
                if (conf.processAsEnums.classes[rt]) {
                    return conf.processAsEnums.classes[rt];
                }
                return rt;
            });
        }
        
        public static fixEnumTypes(
          typeNames:   string[],
          publicTypes: Map<string,
          IOutputtable>,
          conf:        IPluginConfig
        ): void {
            //If we encounter any string enum typedefs, replace type with 'string'
            for (let i = 0; i < typeNames.length; i++) {
                let ot = publicTypes.get(typeNames[i]);
                if (ot != null) {
                    if (ot.getKind() == TSOutputtableKind.Typedef) {
                        let tdf = <TSTypedef>ot;
                        if (tdf.getEnumType() == TSEnumType.String) {
                            typeNames[i] = "string";
                        }
                    } else {
                        let doc = ot.getDoclet();
                        if (doc != null) {
                            let longname = doc.longname;
                            if (conf.processAsEnums.classes[longname]) {
                                typeNames[i] = conf.processAsEnums.classes[longname];
                            }
                        }
                    }
                }
            }
        }
        
        public static isPrivateDoclet(doclet: jsdoc.IDoclet, conf: IPluginConfig = null): boolean {
            //If the configuration defines a particular annotation as a public API marker and it
            //exists in the doclet's tag list, the doclet is considered part of the public API
            if (conf != null && conf.publicAnnotation) {
                let found = (doclet.tags || []).filter(tag => tag.originalTitle == conf.publicAnnotation);
                if (found.length == 1) //tag found
                    return false;
                
                //In this mode, absence of the tag means not public
                return true;
            }
            
            return doclet.access == "private" ||
                   doclet.access == "protected" ||
                   doclet.undocumented == true;
        }
        
        private static stripOuterParentheses(part: string): string {
            if (part.length > 2 && part[0] == "(" && part[part.length - 1] == ")") {
                return part.substring(1, part.length - 1).trim();
            }
            return part.trim();
        }
        
        public static getTypeReplacement(typeName: string, conf: IPluginConfig, logger: ILogger, context?: TypeVisibilityContext): string {
            let tn = typeName;
            //Strip off nullability qualifier if it exists
            if (tn.charAt(0) == "!")
                tn = tn.substring(1);
                
            //Look in user configured overrides
            if (conf.typeReplacements.hasOwnProperty(tn)) {
                return conf.typeReplacements[tn];
            } else {
                //Before returning, see if the type annotation matches known patterns
                //
                //NOTE: Regex-based checks take precedence as we want to check for specific
                //patterns first before trying to look for things like array or union type
                //notation
                
                //Anonymous function with return type
                let rgxm = tn.match(/function\((.+)\):\s+(.+)/);
                if (rgxm) {
                    //console.log("is anon function with return type");
                    let typeArgs = rgxm[1].split(",")
                                          .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger, context));
                    let funcParams = [];
                    for (let i = 0; i < typeArgs.length; i++) {
                        let typeArg = typeArgs[i];
                        //Check if it's of the form: "param:value"
                        let rgxp = typeArg.match(/(.+)\:(.+)/);
                        if (rgxp && rgxp.length == 3) {
                            //TODO: We can keep the param if we can be sure if it is not a reserved keyword
                            funcParams.push("arg" + i + ": " + rgxp[2]);
                        } else {
                            funcParams.push("arg" + i + ": " + typeArgs[i]);
                        }
                    }
                    return "(" + funcParams.join(", ") + ") => " + TypeUtil.getTypeReplacement(rgxm[2].trim(), conf, logger, context).trim();
                }
                //Anonymous function with no return type
                rgxm = tn.match(/function\((.+)\)/);
                if (rgxm) {
                    //console.log("is anon function with no return type");
                    let typeArgs = rgxm[1].split(",")
                                          .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger, context));
                    let funcParams = [];
                    for (let i = 0; i < typeArgs.length; i++) {
                        let typeArg = typeArgs[i];
                        //Check if it's of the form: "param:value"
                        let rgxp = typeArg.match(/(.+)\:(.+)/);
                        if (rgxp && rgxp.length == 3) {
                            //TODO: We can keep the param if we can be sure if it is not a reserved keyword
                            funcParams.push("arg" + i + ": " + rgxp[2]);
                        } else {
                            funcParams.push("arg" + i + ": " + typeArgs[i]);
                        }
                    }
                    return "(" + funcParams.join(", ") + ") => any";
                }
                //Array - type[]
                rgxm = tn.match(/(.+)\[\]$/);
                if (rgxm) {
                    //console.log("is array");
                    //Don't strip parentheses here as that would indicate an array of unioned types
                    return TypeUtil.getTypeReplacement(rgxm[1], conf, logger, context) + "[]";
                }
                //Array - Array.<type>
                rgxm = tn.match(/(^Array\.)\<(.+)>/); 
                if (rgxm) {
                    //console.log("is array");
                    //Don't strip parentheses here as that would indicate an array of unioned types
                    return TypeUtil.getTypeReplacement(rgxm[2], conf, logger, context) + "[]";
                }
                //kvp - Object.<TKey, TValue> -> { [key: TKey]: TValue; }
                rgxm = tn.match(/(^Object\.)\<(.+)\,(.+)\>/);
                if (rgxm) {
                    //console.log("is kvp");
                    let keyType = TypeUtil.getTypeReplacement(TypeUtil.stripOuterParentheses(rgxm[2]), conf, logger, context);
                    
                    //Need to ensure this is string or number. In the event we find a string enum
                    //class, we must replace it with string
                    if (context != null) {
                        //NOTE: Unlike other cases where we need to fix string enum types, this one is
                        //unconditional as TypeScript does not support enums as KVP keys, even though
                        //their underlying type is string|number
                        //
                        //See: https://github.com/Microsoft/TypeScript/issues/2491
                        if (context instanceof ReadOnlyTypeVisibilityContext) {
                            let toFix = [ keyType ];
                            context.fixEnumTypes(toFix, conf);
                            keyType = toFix[0];
                        }
                    }
                    
                    let valueType = TypeUtil.getTypeReplacement(TypeUtil.stripOuterParentheses(rgxm[3]), conf, logger, context);
                    return "{ [key: " + keyType + "]: " + valueType + "; }";
                }
                //Some generic type - SomeGenericType.<AnotherType>
                rgxm = tn.match(/(.+)(.\<)(.+)\>/);
                if (rgxm) {
                    //console.log("is generic type");
                    let genericType = TypeUtil.getTypeReplacement(rgxm[1], conf, logger, context);
                    let part = TypeUtil.stripOuterParentheses(rgxm[3]);
                    let genericTypeArgs = part.split(",")
                                              .map(tn => TypeUtil.getTypeReplacement(TypeUtil.stripOuterParentheses(tn), conf, logger, context));
                    return genericType + "<" + genericTypeArgs.join(",") + ">";
                }
                //Array - untyped
                if (tn.toLowerCase() == "array") {
                    //console.log("is untyped array");
                    //TODO: Include symbol context
                    logger.warn("Encountered untyped array. Treating as 'any[]'");
                    return "any[]";
                }
                //Union-type - typeA|typeB
                if (tn.indexOf("|") >= 0) {
                    //console.log("union type");
                    let types = tn.split("|");
                    let replTypes = [];
                    for (let i = 0; i < types.length; i++) {
                        replTypes.push(TypeUtil.getTypeReplacement(TypeUtil.stripOuterParentheses(types[i]), conf, logger, context));
                    }
                    return replTypes.join("|");
                }
                
                //When referenced, tildefied types should be dotted
                tn = tn.replace("~", ".");
                
                //DIRTY HACK: Due to my horrible regex skills, the generic type regex currently breaks down if we
                //encounter nested generic types.
                //
                //When we fix this (https://github.com/jumpinjackie/jsdoc-typescript-plugin/issues/54), this can be removed
                //
                //In the meantime, just "patch" the incorrect output
                tn = tn.replace(".<", "<");
                
                if (context != null) {
                    context.addType(tn, conf, logger);
                }
                
                //No other replacement suggestions, return as is
                return tn;
            }
        }
        
        public static replaceFunctionTypes(parsedReturnTypes: string[], doclet: jsdoc.IDoclet, conf: IPluginConfig, logger: ILogger, context?: TypeVisibilityContext): void {
            for (let i = 0; i < parsedReturnTypes.length; i++) {
                if (parsedReturnTypes[i] == "Function") {
                    //console.log(`Parsing function return type for ${doclet.longname} from @return in comments`);
                    //Try to parse return type from comment
                    let matches = (doclet.comment || "").match(/@return \{(.*)\}/);
                    if (matches && matches.length == 2) {
                        //console.log(`    attempting replacement of ${matches[1]}`);
                        parsedReturnTypes[i] = TypeUtil.getTypeReplacement(matches[1], conf, logger, context);
                        //console.log(`     => ${parsedReturnTypes[i]}`);
                        //Warn if after replacement, the type is still "function"
                        if (parsedReturnTypes[i] == "Function" && context == null) {
                            logger.warn(`Function return type of ${doclet.longname} is still "Function" after type replacement. This may be a documentation error`);
                        }
                    }
                }
            }
        }
        
        public static parseAndConvertTypes(typeAnno: jsdoc.IType, conf: IPluginConfig, logger: ILogger, context?: TypeVisibilityContext): string[] {
            let utypes = [];
            if (typeAnno.names.length > 0) {
                for (let anno of typeAnno.names) {
                    let typeName = TypeUtil.getTypeReplacement(anno, conf, logger, context);
                    //This is an optionality hint for TypeScript but in terms of signature, it should not be emitted
                    if (typeName == "undefined" || typeName == "null")
                        continue;
                    utypes.push(typeName);
                }
            }
            return utypes;
        }
        
        public static extractGenericTypesFromDocletTags(tags: jsdoc.ITag[]): string[] {
            let genericTypes = [];
            //@template is non-standard, but the presence of this annotation conveys
            //generic type information that we should capture
            let genericTypeTags = (tags || []).filter(tag => tag.originalTitle == "template");
            if (genericTypeTags.length > 0) {
                for (let genericTypeTag of genericTypeTags) {
                    let gts = genericTypeTag.value.split(",");
                    for (let gt of gts) {
                        //No TS type replacement here as the value is the generic type placeholder
                        genericTypes.push(gt.trim());
                    }
                }
            }
            return genericTypes;
        }
    }
    
    export interface IOutputtable {
        getFullName(): string;
        getKind(): TSOutputtableKind;
        getDoclet(): jsdoc.IDoclet;
        output(
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void;
        visit(
          context: TypeVisibilityContext,
          conf:    IPluginConfig,
          logger:  ILogger
        ): void;
    }

    export abstract class TSMember implements IOutputtable {
        protected doclet: jsdoc.IDoclet;
        protected isPublic: boolean;
        protected ovReturnType: string;

        constructor(doclet: jsdoc.IDoclet) {
            this.doclet = doclet;
            this.isPublic = true;
            this.ovReturnType = null;
        }
        
        public setOverrideReturnType(typeName: string): void {
            this.ovReturnType = typeName;
        }
        
        public isStatic(): boolean {
            return this.doclet.scope == "static";
        }
        
        public getDoclet(): jsdoc.IDoclet {
            return this.doclet;
        }
        
        public inheritsDoc(): boolean {
            return this.doclet.inheritdoc === true;
        }
        
        public setIsPublic(value: boolean): void {
            this.isPublic = value;
        }
        
        public getIsPublic(): boolean {
            return this.isPublic;
        }
        
        public getFullName(): string {
            return this.doclet.longname;
        }
        
        public abstract getKind(): TSOutputtableKind;
        
        protected writeExtraDescriptionParts(
          kind:        string,
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void { }
        
        protected getDescription(): string {
            return this.doclet.description;
        }
        
        protected writeDescription(
          kind:        string,
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void {
            //Description as comments
            stream.writeln("/**");
            let desc = this.getDescription();
            if (desc != null) {
                let descParts = desc.split("\n");
                for (let i = 0; i < descParts.length; i++) {
                    stream.writeln(" * " + descParts[i]);
                }
            } else if (conf.fillUndocumentedDoclets) {
                //logger.warn(`The ${kind} (${this.doclet.name}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                stream.writeln(` * TODO: This ${kind} has no documentation. Contact the library author if this ${kind} should be documented`);
            }
            this.writeExtraDescriptionParts(kind, stream, conf, logger, publicTypes);
            stream.writeln(" */");
        }
        
        public abstract output(
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void;
        
        public abstract visit(
          context: TypeVisibilityContext,
          conf:    IPluginConfig,
          logger:  ILogger
        ): void;
    }

    export enum TSEnumType {
        String,
        Number,
        Invalid
    }

    export class TSProperty extends TSMember {
        private isModule: boolean;
        private allowOptional: boolean;
        constructor(doclet: jsdoc.IDoclet, allowOptional: boolean) {
            super(doclet);
            this.isModule = false;
            this.allowOptional = allowOptional;
        }

        public getKind(): TSOutputtableKind {
            return TSOutputtableKind.Property;
        }

        public setIsModule(value: boolean): void {
            this.isModule = value;
        }

        public tryGetEnumValue(): any {
            if (this.doclet.meta && 
                this.doclet.meta.code &&
                (this.doclet.meta.code.type == "Literal" || this.doclet.meta.code.type == "UnaryExpression")) {
                return this.doclet.meta.code.value;
            }
            return null;
        }

        private isOptional(publicTypes: Map<string, IOutputtable>): boolean {
            if (this.allowOptional) {
                //If the argument is a typedef, it will (and should) be the only argument type
                if (this.doclet.type.names.length == 1) {
                    let outputtable = publicTypes.get(this.doclet.type.names[0]);
                    if (outputtable != null) {
                        let kind = outputtable.getKind();
                        if (TSOutputtableKind.Typedef == kind) {
                            let tdf = <TSTypedef>outputtable;
                            if (tdf.isOptional())
                                return true;
                        }
                        if (TSOutputtableKind.UserTypeAlias == kind) {
                            let utdf = <TSUserTypeAlias>outputtable;
                            if (utdf.isOptional())
                                return true;
                        }
                    }
                }
                return (this.doclet.type.names.indexOf("undefined") >= 0 ||
                        this.doclet.nullable == true);
            }
            return false;
        }

        public output(
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for typedef");
                stream.writeln(DumpDoclet(this.doclet));
                stream.writeln(" */");
            }
            
            //If member override exists, it takes precedence
            if (conf.memberReplacements[this.doclet.longname] != null) {
                let memberOv = conf.memberReplacements[this.doclet.longname];
                if (memberOv.description != null) {
                    stream.writeln("/**");
                    stream.writeln(` * ${memberOv.description}`);
                    stream.writeln(" */");
                }
                stream.writeln(memberOv.declaration);
            } else {
                this.writeDescription("property", stream, conf, logger, publicTypes);
                let propDecl = "";
                if (this.isModule) {
                    propDecl += "var ";
                }
                propDecl += this.doclet.name;
                if (this.doclet.type != null && this.isOptional(publicTypes)) {
                    //The presence of undefined is a hint that this property is optional
                    propDecl += "?: ";
                } else {
                    propDecl += ": ";
                }
                if (this.ovReturnType != null) {
                    propDecl += this.ovReturnType + ";";
                } else {
                    if (this.doclet.type != null) {
                        let roContext = new ReadOnlyTypeVisibilityContext(null, publicTypes);
                        let types = TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger, roContext);
                        types = TypeUtil.fixEnumTypeReferences(types, conf);
                        if (!conf.useUnionTypeForStringEnum)
                            TypeUtil.fixEnumTypes(types, publicTypes, conf);
                        TypeUtil.replaceFunctionTypes(types, this.doclet, conf, logger);
                        propDecl += types.join("|") + ";";
                    } else {
                        logger.warn(`Property ${this.doclet.name} of ${this.doclet.memberof} has no return type defined. Defaulting to "any"`);
                        propDecl += "any;";
                    }
                }
                stream.writeln(propDecl);
            }
        }
        
        public visit(context: TypeVisibilityContext, conf: IPluginConfig, logger: ILogger): void {
            if (this.doclet.type != null) {
                TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger, context);
            }
        }
    }
    
    interface IParameterContainer {
      members: jsdoc.IParameter[];
      param:   jsdoc.IParameter;
    }
    
    interface ITsMemberContainer {
      members: TSMember[];
      member:  TSMember;
    }

    export class TSMethod extends TSMember {
        private isModule: boolean;
        private isTypedef: boolean;
        constructor(doclet: jsdoc.IDoclet) {
            super(doclet);
            this.isModule = false;
            this.isTypedef = false;
        }
        
        public getKind(): TSOutputtableKind { return TSOutputtableKind.Method; }
        
        public setIsModule(value: boolean): void {
            this.isModule = value;
        }
        
        public setIsTypedef(value: boolean): void {
            this.isTypedef = value;
        }
        
        protected outputReturnType(): boolean { return true; }
        
        protected getMethodName(): string { return this.doclet.name; }
        
        private isArgOptional(arg: jsdoc.IParameter, publicTypes: Map<string, IOutputtable>): boolean {
            //If the argument is a typedef, it will (and should) be the only argument type
            if (arg.type != null && arg.type.names.length > 0) {
                if (arg.type.names.length == 1) {
                    let outputtable = publicTypes.get(arg.type.names[0]);
                    if (outputtable != null) {
                        let kind = outputtable.getKind();
                        if (TSOutputtableKind.Typedef == kind) {
                            let tdf = <TSTypedef>outputtable;
                            if (tdf.isOptional())
                                return true;
                        }
                        if (TSOutputtableKind.UserTypeAlias == kind) {
                            let utdf = <TSUserTypeAlias>outputtable;
                            if (utdf.isOptional())
                                return true;
                        }
                    }
                } else {
                    //Any type ending with '=' or starting with '?' denotes optionality to the whole
                    let matches1 = arg.type.names.filter(t => t.indexOf("=") == t.length - 1);
                    let matches2 = arg.type.names.filter(t => t.indexOf("?") == 0);
                    if (matches1.length > 0 || matches2.length > 0) {
                        return true;
                    }
                }
            }
            return arg.nullable == true ||
                   arg.optional == true ||
                   arg.type.names.indexOf("undefined") >= 0;
        }
        
        protected writeExtraDescriptionParts(
          kind:        string,
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void {
            //If we have args, document them. Because TypeScript is ... typed, the {type}
            //annotation is not necessary in the documentation
            let params = this.studyParameters(null, conf, logger);
            if (params.length > 0 && !this.isTypedef) {
                let forceNullable = false;
                for (let arg of params) {
                    let req = "";
                    if (forceNullable || this.isArgOptional(arg, publicTypes)) {
                        // You can't have non-nullable arguments after a nullable argument. So by definition
                        // everything after the nullable argument has to be nullable as well
                        forceNullable = true;
                        req = " (Optional)";
                    } else {
                        req = " (Required)";
                    }
                    let argDesc = arg.description || "";
                    if (argDesc == "" && conf.fillUndocumentedDoclets) {
                        //logger.warn(`Argument (${arg.name}) of ${kind} (${this.doclet.longname}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                        argDesc = "TODO: This parameter has no description. Contact this library author if this parameter should be documented\n";
                    }
                    stream.writeln(` * @param ${arg.name} ${req} ${argDesc}`);
                }
            }
        }
        
        protected outputScope(): boolean {
            return true;
        }
        
        protected outputGenericTypes(): boolean {
            return true;
        }
        
        /**
         * Studies the doclet parameters and returns a normalized set.
         * 
         * When visiting this instance, a TypeVisibilityContext is provided, otherwise it is null
         */
        private studyParameters(context: TypeVisibilityContext, conf: IPluginConfig, logger: ILogger): jsdoc.IParameter[] {
            let params: jsdoc.IParameter[] = [];
            let paramMap = new Map<string, IParameterContainer>();
            
            let methodParams = this.doclet.params || [];
            let processedArgs = new Map<string, string>();
            let argCounter = 1;
            
            if (methodParams.length > 0) {
                for (let arg of methodParams) {
                    //Are we visiting?
                    if (context != null) {
                        //Must auto-rename any argument named "arguments" as that is a reserved word
                        //in TypeScript in an argument context
                        if (arg.name == "arguments") {
                            let name = `arg${argCounter}`;
                            while (processedArgs.has(arg.name)) {
                                argCounter++;
                                name = `arg${argCounter}`;
                            }
                            //Should we be rewriting the doclet here?
                            arg.name = name;
                        }
                        processedArgs.set(arg.name, arg.name);
                    }
                    
                    if (arg.type != null) {
                        TypeUtil.parseAndConvertTypes(arg.type, conf, logger, context);
                        if (arg.name.indexOf(".") >= 0) { //If it's dotted is a member of the options argument
                            let parts = arg.name.split(".");
                            let parm = paramMap.get(parts[0]);
                            //If we get 'foo.bar', we should have already processed argument 'foo'
                            if (parm == null) {
                                //Only want to error when not visiting (ie. context is null)
                                if (context == null) {
                                    logger.error(`In method ${this.doclet.longname}: Argument (${arg.name}) is a dotted member of argument (${parts[0]}) that either does not exist, or does not precede this argument`);
                                }
                            } else {
                                parm.members.push(arg);
                            }
                        } else {
                            paramMap.set(arg.name, {
                                members: [],
                                param: arg
                            });
                        }
                    }
                }
            }
            
            //Since there is no guarantee of object keys being insertion order 
            //(http://stackoverflow.com/questions/5525795/does-javascript-guarantee-object-property-order)
            //we'll loop the original doclet params and pick up the keyed parameter along the way 
            for (let arg of methodParams) {
                if (arg.type != null) {
                    let p = paramMap.get(arg.name);
                    if (p != null) {
                        params.push(p.param);
                        if (p.members.length > 0 && context != null) {
                            //Define a new options interface and register it with the context
                            let moduleName = null;
                            let typeName = this.generateOptionsInterfaceName(conf);
                            let memberDefs = [];
                            
                            for (let member of p.members) {
                                //This should be a dotted member. Split it
                                let parts = member.name.split(".");
                                let propName = parts[parts.length - 1];
                                let retType = TypeUtil.parseAndConvertTypes(member.type, conf, logger);
                                
                                memberDefs.push(`/**\n * ${member.description}\n */\n${propName}: ${retType.join("|")}`);
                            }
                            
                            let iface = new TSUserInterface(moduleName, typeName, memberDefs);
                            context.registerTypedef(typeName, iface);
                            console.log(`Registered ad-hoc interface type: ${typeName}`);
                            
                            //TODO: Hmmm, should we be modifying doclets given by JSDoc?
                            p.param.type.names = [
                                typeName
                            ];
                        }
                    }
                }
            }
            
            return params;
        }
        
        private generateOptionsInterfaceName(conf: IPluginConfig): string {
            let methodNameCamelCase = this.getMethodName();
            if (methodNameCamelCase == "constructor") {
                //This should be the class name
                methodNameCamelCase = this.doclet.name;
            } else {
                //Use ${ClassName}${MethodName} as insurance against name collision should
                //we encounter more than one options parameter for methods of the same name
                let className = TypeUtil.cleanTypeName(this.doclet.memberof);
                if (conf.globalModuleAliases.indexOf(className) >= 0) {
                    methodNameCamelCase = CamelCase(methodNameCamelCase);
                } else {
                    methodNameCamelCase = className + CamelCase(methodNameCamelCase);
                }
            }
            methodNameCamelCase = CamelCase(TypeUtil.cleanTypeName(methodNameCamelCase));
            return `I${methodNameCamelCase}Options`;
        }
        
        public visit(context: TypeVisibilityContext, conf: IPluginConfig, logger: ILogger): void {
            this.studyParameters(context, conf, logger);
            if (this.outputReturnType()) {
                if (this.doclet.returns != null) {
                    for (let retDoc of this.doclet.returns) {
                        if (retDoc.type != null) {
                            let parsedTypes = TypeUtil.parseAndConvertTypes(retDoc.type, conf, logger, context);
                            TypeUtil.replaceFunctionTypes(parsedTypes, this.doclet, conf, logger, context);
                        }
                    }
                }
            }
        }
        
        public output(
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for function");
                stream.writeln(DumpDoclet(this.doclet));
                stream.writeln(" */");
            }
            
            //If member override exists, it takes precedence
            if (conf.memberReplacements[this.doclet.longname] != null) {
                let memberOv = conf.memberReplacements[this.doclet.longname];
                if (memberOv.description != null) {
                    stream.writeln("/**");
                    stream.writeln(` * ${memberOv.description}`);
                    stream.writeln(" */");
                }
                stream.writeln(memberOv.declaration);
            } else {
                this.writeDescription(((this.isModule && this.isTypedef) ? "function typedef" : "method"), stream, conf, logger, publicTypes);
                let methodDecl = "";
                if (this.isModule) {
                    //If in global namespace, we must declare this
                    if (this.doclet.memberof == null && conf.declareTopLevelElements) {
                        methodDecl += "declare ";
                    }
                    if (this.isTypedef)
                        methodDecl += "type ";
                    else
                        methodDecl += "function ";
                } else {
                    if (this.outputScope())
                        methodDecl += (this.doclet.scope == "static" ? "static " : "");
                }
                methodDecl += this.getMethodName();
                if (this.outputGenericTypes()) {
                    let genericTypes = TypeUtil.extractGenericTypesFromDocletTags(this.doclet.tags);
                    if (genericTypes && genericTypes.length > 0) {
                        methodDecl += "<" + genericTypes.join(", ") + ">";
                    }
                }
                if (this.isTypedef) {
                    methodDecl += " = ";
                }
                methodDecl += "(";
                //Output args
                let argVals = [];
                let params = this.studyParameters(null, conf, logger);
                if (params.length > 0) {
                    let forceNullable = false;
                    for (let arg of params) {
                        let argStr = "";
                        if (arg.variable) {
                            argStr += "...";
                        }
                        argStr += arg.name;
                        if (forceNullable || this.isArgOptional(arg, publicTypes)) {
                            // In TypeScript (and most compiled languages), you can't have non-nullable arguments after a nullable argument. 
                            // So by definition everything after the nullable argument has to be nullable as well
                            forceNullable = true;
                            argStr += "?: ";
                        } else {
                            argStr += ": ";
                        }
                        if (arg.type != null) {
                            //Output as TS union type
                            let roContext = new ReadOnlyTypeVisibilityContext(null, publicTypes);
                            let utypes = TypeUtil.parseAndConvertTypes(arg.type, conf, logger, roContext);
                            utypes = TypeUtil.fixEnumTypeReferences(utypes, conf);
                            if (!conf.useUnionTypeForStringEnum)
                                TypeUtil.fixEnumTypes(utypes, publicTypes, conf);
                            argStr += utypes.join("|");
                            if (arg.variable) {
                                argStr += "[]";
                            }
                        } else {
                            //logger.warn(`Argument '${arg.name}' of method (${this.doclet.longname}) has no type annotation. Defaulting to 'any'`);
                            //Fallback to any
                            argStr += "any";
                        }
                        argVals.push(argStr);
                    }
                }
                methodDecl += argVals.join(", ") + ")";
                
                if (this.ovReturnType != null) {
                    let retToken = ": ";
                    if (this.isTypedef) {
                        retToken = " => ";
                    }
                    methodDecl += retToken + this.ovReturnType;
                } else {
                    //Determine return type
                    let retTypes = [];
                    if (this.doclet.returns != null) {
                        for (let retDoc of this.doclet.returns) {
                            if (retDoc.type != null) {
                                let roContext = new ReadOnlyTypeVisibilityContext(null, publicTypes);
                                let rts = TypeUtil.parseAndConvertTypes(retDoc.type, conf, logger, roContext);
                                for (let r of rts) {
                                    retTypes.push(r);
                                }
                            }
                        }
                    }
                    
                    retTypes = TypeUtil.fixEnumTypeReferences(retTypes, conf);
                    
                    if (!conf.useUnionTypeForStringEnum)
                        TypeUtil.fixEnumTypes(retTypes, publicTypes, conf);
                    TypeUtil.replaceFunctionTypes(retTypes, this.doclet, conf, logger);
                    let retType = retTypes.join("|"); //If multiple, return type is TS union
                    
                    let retToken = ": ";
                    if (this.isTypedef) {
                        retToken = " => ";
                    }
                    
                    if (this.outputReturnType()) {
                        if (retType != null && retType != "") {
                            methodDecl += retToken + retType;
                        } else {
                            //logger.warn(`No return type specified on (${this.doclet.longname}). Defaulting to '${conf.defaultReturnType}'`);
                            methodDecl += retToken + conf.defaultReturnType;
                        }
                    }
                }
                methodDecl += ";";
                stream.writeln(methodDecl);
            }
        }
    }

    export class TSConstructor extends TSMethod {
        constructor(doclet: jsdoc.IDoclet) {
            super(doclet);
        }
        
        // We're re-using the class doclet here, so any generic types would've
        // already been written out
        protected outputGenericTypes(): boolean {
            return false;
        }
        
        // There is no need to specify scope of constructors
        protected outputScope(): boolean {
            return false;
        }
        
        // Constructors need not specify a return type
        protected outputReturnType(): boolean {
            return false;
        }
        
        protected getMethodName(): string {
            return "constructor";
        }
        
        public visit(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): void {
            super.visit(context, conf, logger);
        }
        
        public output(
          stream:      IndentedOutputStream,
          conf:        IPluginConfig,
          logger:      ILogger,
          publicTypes: Map<string, IOutputtable>
        ): void {
            super.output(stream, conf, logger, publicTypes);
        }
    }

    /**
     * Defines a TS type that resides within a module
     */
    export abstract class TSChildElement {
        protected parentModule: string;

        public setParentModule(module: string): void {
            this.parentModule = module;
        }

        public getParentModule(): string {
            return this.parentModule;
        }

        public abstract getQualifiedName(): string;
    }

    /**
     * A TS type that resides within a module that can output its representation
     */
    export abstract class TSOutputtable extends TSChildElement implements IOutputtable {
        protected doclet: jsdoc.IDoclet;

        constructor(doclet: jsdoc.IDoclet) {
            super();
            this.doclet = doclet;
        }
        
        public getDoclet(): jsdoc.IDoclet {
            return this.doclet;
        }
        
        public getFullName(): string {
            return this.doclet.longname;
        }
        
        public abstract getKind(): TSOutputtableKind;
        
        protected getDescription(): string {
            return this.doclet.description;
        }
        
        protected writeDescription(
            kind:   string,
            stream: IndentedOutputStream,
            conf:   IPluginConfig,
            logger: ILogger
        ): void {
            //Description as comments
            let desc = this.getDescription();
            if (desc != null) {
                stream.writeln("/**");
                let descParts = desc.split("\n");
                for (let i = 0; i < descParts.length; i++) {
                    stream.writeln(" * " + descParts[i]);
                }
                stream.writeln(" */");
            } else if (conf.fillUndocumentedDoclets) {
                //logger.warn(`The ${kind} (${this.doclet.name}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                stream.writeln("/**");
                stream.writeln(` * TODO: This ${kind} has no documentation. Contact the library author if this ${kind} should be documented`);
                stream.writeln(" */");
            }
        }
        
        public abstract output(
            stream:      IndentedOutputStream,
            conf:        IPluginConfig,
            logger:      ILogger,
            publicTypes: Map<string, IOutputtable>
        ): void;
        
        public abstract visit(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): void;
    }

    interface TSMemberResult {
        member: TSMember;
        isPublic: boolean;
    } 

    /**
     * A TS type that has child members
     */
    export abstract class TSComposable extends TSOutputtable {
        protected members: TSMember[];
        protected isPublic: boolean;

        constructor(doclet: jsdoc.IDoclet) {
            super(doclet);
            this.members = [];
            this.isPublic = false;
        }

        public addMember(member: TSMember): void {
            this.members.push(member);
        }

        public findMember(name: string, kind: string): TSMember {
            let matches = this.members.filter(m => {
                let doclet = m.getDoclet();
                return doclet.name == name && doclet.kind == kind;
            });
            if (matches.length == 1)
                return matches[0];
            else
                return null;
        }

        private getDottedMemberName(doclet: jsdoc.IDoclet): string {
            if (doclet.name.indexOf(".") >= 0)
                return doclet.name;

            if ((doclet.properties || []).length == 1) {
                if (doclet.properties[0].name.indexOf(".") >= 0)
                    return doclet.properties[0].name;
            }

            return null;
        }

        /**
         * Studies the members of this doclet and returns a normalized set.
         * 
         * When visiting this instance, a TypeVisibilityContext is provided, otherwise it is null
         */
        protected studyMembers(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): TSMember[] {
            let studiedMembers: TSMember[] = [];
            let staticMemberMap = new Map<string, ITsMemberContainer>();
            let instanceMemberMap = new Map<string, ITsMemberContainer>();
            
            let members = (this.members || []).filter(m => m.getIsPublic());
            
            if (members.length > 0) {
                for (let member of members) {
                    let memberDoclet = member.getDoclet();
                    if (member instanceof TSMethod) {
                        if (member.isStatic()) {
                            staticMemberMap.set(memberDoclet.name, {
                                members: [],
                                member: member
                            });
                        } else {
                            instanceMemberMap.set(memberDoclet.name, {
                                members: [],
                                member: member
                            });
                        }
                    } else {
                        if (memberDoclet.type != null) {
                            //Only pass the context down when parsing and converting if we're currently studying a non-private doclet
                            if (!TypeUtil.isPrivateDoclet(memberDoclet))
                                TypeUtil.parseAndConvertTypes(memberDoclet.type, conf, logger, context);
                            let dottedMemberName = this.getDottedMemberName(memberDoclet);
                            if (dottedMemberName != null) { //If it's dotted is a member of the options property
                                let parts = dottedMemberName.split(".");
                                
                                //TODO: What if the part exists in both?
                                let mbr = instanceMemberMap.get(parts[0]);
                                if (mbr == null)
                                    mbr = staticMemberMap.get(parts[0]);
                                
                                //If we get 'foo.bar', we should have already processed argument 'foo'
                                if (mbr == null) {
                                    //Only want to error when not visiting (ie. context is null)
                                    if (context == null) {
                                        logger.error(`In method ${this.doclet.longname}: Argument (${dottedMemberName}) is a dotted member of argument (${parts[0]}) that either does not exist, or does not precede this argument`);
                                    }
                                } else {
                                    mbr.members.push(member);
                                }
                            } else {
                                if (member.isStatic()) {
                                    staticMemberMap.set(memberDoclet.name, {
                                        members: [],
                                        member: member
                                    });
                                } else {
                                    instanceMemberMap.set(memberDoclet.name, {
                                        members: [],
                                        member: member
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            //Since there is no guarantee of object keys being insertion order 
            //(http://stackoverflow.com/questions/5525795/does-javascript-guarantee-object-property-order)
            //we'll loop the original doclet params and pick up the keyed parameter along the way 
            for (let member of members) {
                let memberDoclet = member.getDoclet();
                if (member instanceof TSMethod) {
                    let p = member.isStatic() ? staticMemberMap.get(memberDoclet.name) : instanceMemberMap.get(memberDoclet.name);
                    if (p != null) {
                        studiedMembers.push(p.member);
                    } 
                } else {
                    if (memberDoclet.type != null) {
                        let dottedMemberName = this.getDottedMemberName(memberDoclet);
                        if (dottedMemberName == null) {
                            let p = member.isStatic() ? staticMemberMap.get(memberDoclet.name) : instanceMemberMap.get(memberDoclet.name);
                            if (p != null) {
                                studiedMembers.push(p.member);
                                if (p.members.length > 0 && context != null) {
                                    //Define a new options interface and register it with the context
                                    let moduleName = null;
                                    let typeName = this.generateOptionsInterfaceName();
                                    let memberDefs = [];
                                    
                                    for (let childMember of p.members) {
                                        let memberDoclet = childMember.getDoclet();
                                        //This should be a dotted member. Split it
                                        let parts = memberDoclet.name.split(".");
                                        let propName = parts[parts.length - 1];
                                        let retType = TypeUtil.parseAndConvertTypes(memberDoclet.type, conf, logger, context);
                                        
                                        memberDefs.push(`/**\n * ${memberDoclet.description}\n */\n${propName}: ${retType.join("|")}`);
                                    }
                                    
                                    let iface = new TSUserInterface(moduleName, typeName, memberDefs);
                                    context.registerTypedef(typeName, iface);
                                    console.log(`Registered ad-hoc interface type: ${typeName}`);
                                    
                                    p.member.setOverrideReturnType(typeName);
                                }
                            }
                        }
                    }
                }
            }
            
            return studiedMembers;
        }
        
        private generateOptionsInterfaceName(): string {
            let methodNameCamelCase = CamelCase(TypeUtil.cleanTypeName(this.doclet.name));
            return `I${methodNameCamelCase}Options`;
        }
        
        public getParentTypeNames(): string[] {
            return this.doclet.augments;
        }

        /**
         * Finds a matching member from any of the current member's types inheritance hierarchy that doesn't inherit documentation
         */
        public getInheritedMember(memberDoclet: jsdoc.IDoclet, parents: string[], publicTypes: Map<string, IOutputtable>): TSMemberResult {
            for (let parentTypeName of parents) {
                let type = publicTypes.get(parentTypeName);
                //Parent type is a known TSComposable
                if (type != null && (type.getKind() == TSOutputtableKind.Class || type.getKind() == TSOutputtableKind.Typedef)) {
                    let comp = <TSComposable>type;
                    //console.log(`Checking if ${comp.getFullName()} has member ${memberDoclet.name} (${memberDoclet.kind})`);
                    let member = comp.findMember(memberDoclet.name, memberDoclet.kind);
                    let parentTypeNames = comp.getParentTypeNames() || [];
                    //Found a member
                    if (member != null) {
                        //console.log(`   found member`);
                        //it's public doesn't pass the buck up to another parent
                        if (!member.inheritsDoc())
                            return { member: member, isPublic: member.getIsPublic() };
                        else if (parentTypeNames.length > 0) //Pass the buck up to its parents
                            return comp.getInheritedMember(memberDoclet, parentTypeNames, publicTypes);
                    } else {
                        //console.log(`   member not found`);
                        if (parentTypeNames.length > 0)
                            return comp.getInheritedMember(memberDoclet, parentTypeNames, publicTypes);
                    }
                }
            }
            return null;
        }

        public setIsPublic(isPublic: boolean): void {
            this.isPublic = isPublic;
        }

        public getIsPublic(): boolean {
            return this.isPublic;
        }
    }

    /**
     * A TS typedef. This could be a type alias or an interface
     */
    export class TSTypedef extends TSComposable {
        private enumType: TSEnumType;
        private alreadyAddedEnumMembers: boolean;

        constructor(doclet: jsdoc.IDoclet) {
            super(doclet);
            this.enumType = this.determineEnumType();
            this.alreadyAddedEnumMembers = false;
            //This is a non-typedef kind of enum
            if (this.enumType != TSEnumType.Invalid &&
                this.doclet.isEnum === true &&
                (this.doclet.properties || []).length > 0) {
                for (let prop of this.doclet.properties) {
                    if (!TypeUtil.isPrivateDoclet(prop))
                        this.addMember(new TSProperty(prop, false));
                }
                this.alreadyAddedEnumMembers = true;
            }
        }

        public addMember(member: TSMember): void {
            if (this.enumType != TSEnumType.Invalid && this.alreadyAddedEnumMembers == true) {
                console.log(`Skip adding member ${member.getDoclet().name} as the parent enum ${this.doclet.name} already has its members added`);
                return;
            }
            super.addMember(member);
        }

        private determineEnumType(): TSEnumType {
            let eType = TSEnumType.Invalid;
            let matches = (this.doclet.comment || "").match(/@enum \{(.*)\}/);
            if (matches && matches.length == 2) {
                let typeName = matches[1].toLowerCase();
                if (typeName == "string")
                    eType = TSEnumType.String;
                else if (typeName == "number")
                    eType = TSEnumType.Number;
            }
            return eType;
        }

        public getEnumType(): TSEnumType {
            return this.enumType;
        }

        public getKind(): TSOutputtableKind {
            return TSOutputtableKind.Typedef;
        }

        public isOptional(): boolean {
            return this.members.length == 0 //Must be a type-alias typedef
                && this.doclet.type != null
                && this.doclet.type.names != null
                && this.doclet.type.names.indexOf("undefined") >= 0;
        }

        public getQualifiedName(): string {
            let mod = this.getParentModule();
            if (mod == null)
                return this.doclet.name;
            else
                return `${mod}.${this.doclet.name}`;
        }

        public visit(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): void {
            TypeUtil.getTypeReplacement(this.getQualifiedName(), conf, logger, context);
            let members = this.studyMembers(context, conf, logger);
            for (let member of members) {
                if (member.getIsPublic()) // || member.inheritsDoc())
                    member.visit(context, conf, logger);
            }
            if (this.doclet.type != null) {
                TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger, context);
            }
        }

        public output(
            stream: IndentedOutputStream,
            conf:   IPluginConfig,
            logger: ILogger, publicTypes: Map<string, IOutputtable>
        ): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for typedef");
                stream.writeln(DumpDoclet(this.doclet));
                stream.writeln(" */");
            }
            
            this.writeDescription(DocletKind.Typedef, stream, conf, logger);
            let hasMembers = this.members.length > 0;
            
            let declareMe = "";
            if (this.getParentModule() == null && conf.declareTopLevelElements) {
                declareMe = "declare ";
            }
            
            let typeName = TypeUtil.cleanTypeName(this.doclet.name);
            
            if (this.enumType == TSEnumType.Number && hasMembers) {
                stream.writeln(`${declareMe}enum ${typeName} {`);
                stream.indent();
                let props: TSProperty[] = [];
                for (let member of this.members) {
                    if (member instanceof TSProperty) {
                        props.push(member);
                    } else { //This is a documentation error
                        logger.error(`Found non-property member ${member.getDoclet().name} in declared enum type ${this.getFullName()}`);
                    }
                }
                for (let i = 0; i < props.length; i++) {
                    let prop = props[i];
                    let eValue = prop.tryGetEnumValue();
                    let desc = prop.getDoclet().description;
                    if (desc != null) {
                        stream.writeln("/**");
                        stream.writeln(` * ${desc}`);
                        stream.writeln(" */");
                    }
                    stream.writeln(`${prop.getDoclet().name} = ${eValue}${(i < props.length - 1) ? "," : ""}`);
                }
                stream.unindent();
                stream.writeln("}");
            } else if (this.enumType == TSEnumType.String && hasMembers) {
                if (!conf.useUnionTypeForStringEnum) {
                    //Write as a class with static string members
                    //NOTE: If this is referenced in a parameter or return type, must make 
                    //sure to rewrite that type as 'string' (see: fixStringEnumTypes)
                    stream.writeln(`${declareMe}class ${typeName} {`);
                    stream.indent();
                    for (let member of this.members) {
                        if (member instanceof TSProperty) {
                            let eValue = member.tryGetEnumValue();
                            stream.writeln("/**");
                            stream.writeln(` * "${eValue}"`);
                            stream.writeln(" */");
                            stream.writeln(`public static ${member.getDoclet().name}: string;`);
                        } else { //This is a documentation error
                            logger.error(`Found non-property member ${member.getDoclet().name} in declared enum type ${this.getFullName()}`);
                        }
                    }
                    stream.unindent();
                    stream.writeln("}");
                } else {
                    //TS 1.8 string enums are simple, just make a type alias that is the union of all the string values
                    let eValues = this.members
                                      .filter(m => m instanceof TSProperty)
                                      .map(m => (<TSProperty>m).tryGetEnumValue())
                                      .map(m => `"${m}"`);
                    stream.writeln(`${declareMe}type ${this.doclet.name} = ${eValues.join(" | ")};`);
                }
            } else { //Not an enum
                //If it has methods and/or properties, treat this typedef as an interface
                if (hasMembers) {
                    stream.writeln(`interface ${typeName} {`);
                    stream.indent();
                    let members = this.studyMembers(null, conf, logger);
                    for (let member of members) {
                        member.output(stream, conf, logger, publicTypes);
                    }
                    stream.unindent();
                    stream.writeln("}");
                } else {
                    let typeDecl = `${declareMe}type ${typeName}`;
                    if (this.doclet != null && this.doclet.type != null) {
                        let types = TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger);
                        //If we find 'Function' in here, send the hint that they should use @callback to document function types
                        if (types.indexOf("Function") >= 0) {
                            logger.warn(`Type ${typeName} was aliased to the generic 'Function' type. Consider using @callback (http://usejsdoc.org/tags-callback.html) to document function types`);
                        }
                        typeDecl += " = " + types.join("|") + ";\n";
                    } else { //Fallback
                        typeDecl += " = any; //TODO: Could not determine underlying type for this typedef. Falling back to 'any'\n";
                    }
                    stream.writeln(typeDecl);
                }
            }
        }
    }

    /**
     * A TS class definition
     */
    export class TSClass extends TSComposable {
        public ctor: TSConstructor;
        
        public getKind(): TSOutputtableKind {
            return TSOutputtableKind.Class;
        }
        
        protected getDescription(): string {
            return this.doclet.classdesc || this.doclet.description;
        }
        
        public getQualifiedName(): string {
            let mod = this.getParentModule();
            if (mod == null)
                return this.doclet.name;
            else
                return `${mod}.${this.doclet.name}`;
        }

        public visit(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): void {
            TypeUtil.getTypeReplacement(this.getQualifiedName(), conf, logger, context);
            if (this.doclet.augments != null) {
                for (let t of this.doclet.augments) {
                    TypeUtil.getTypeReplacement(t, conf, logger, context);
                }
            }
            if (this.ctor != null)
                this.ctor.visit(context, conf, logger);
            let members = this.studyMembers(context, conf, logger);
            for (let member of members) {
                if (member.getIsPublic() || member.inheritsDoc())
                    member.visit(context, conf, logger);
            }
        }

        public output(
            stream:      IndentedOutputStream,
            conf:        IPluginConfig,
            logger:      ILogger,
            publicTypes: Map<string, IOutputtable>
        ): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for class");
                stream.writeln(DumpDoclet(this.doclet));
                stream.writeln(" */");
            }
            
            this.writeDescription(DocletKind.Class, stream, conf, logger);
            
            let clsDecl = "";
            //If un-parented, the emitted class will be global and must be declared as a result
            if (this.getParentModule() == null && conf.declareTopLevelElements) {
                clsDecl = "declare ";
            }
            clsDecl += "class " + this.doclet.name;
            let genericTypes = TypeUtil.extractGenericTypesFromDocletTags(this.doclet.tags);
            //Class generic parameters
            if (genericTypes.length > 0) {
                //As these are generic placeholders, they don't go through the
                //type replacer
                clsDecl += "<" + genericTypes.join(", ") + ">";
            }
            //Inheritance
            if (this.doclet.augments != null) {
                let parents = this.doclet
                                  .augments
                                  .map(p => TypeUtil.getTypeReplacement(p, conf, logger, null))
                                  .join(",");
                clsDecl += " extends " + parents;
            }
            clsDecl += " {";
            stream.writeln(clsDecl);
            stream.indent(); //Start class members
            if (this.ctor != null) {
                this.ctor.output(stream, conf, logger, publicTypes);
            }
            let members = this.studyMembers(null, conf, logger);
            for (let member of members) {
                //NOTE: inheritsDoc() is tested first before public visibility as it may inherit off of something that
                //has public visibility
                if (member.inheritsDoc()) {
                    let inheritedQuery = this.getInheritedMember(member.getDoclet(), this.doclet.augments, publicTypes);
                    if (inheritedQuery != null) {
                        //As long as this member or the inherited member is public, it needs to be output
                        if (member.getIsPublic() || inheritedQuery.isPublic) {
                            //console.log(`Outputting inherited member: ${inheritedQuery.member.getDoclet().longname}`);
                            inheritedQuery.member.output(stream, conf, logger, publicTypes);
                        } else {
                            //console.log(`Skipping non-public inherited member: ${inheritedQuery.member.getDoclet().longname}`);
                        }
                    } else {
                        if (member.getIsPublic()) //This is a bug in documentation
                            logger.warn(`Member ${member.getFullName()} has @inheritdoc annotation, but no inherited member could be found`);
                    }
                } else if (member.getIsPublic()) {
                    //console.log(`Outputting member: ${member.getDoclet().longname}`);
                    member.output(stream, conf, logger, publicTypes);
                } else {
                    //console.log(`Skipping non-public member: ${member.getDoclet().longname}`);
                }
            }
            stream.unindent(); //End class members
            stream.writeln("}");
        }
    }

    export interface IOutputtableChildElement extends IOutputtable {
        setParentModule(module: string): void;
        getParentModule(): string;
    }

    /**
     * A user-defined interface
     */
    export class TSUserInterface extends TSTypedef implements IOutputtableChildElement {
        private name: string;
        private adhocMembers: string[];

        constructor(moduleName: string, name: string, members: string[]) {
            super({
                description: "",
                name: name,
                longname: (moduleName != null ? `${moduleName}.${name}` : name),
                kind: DocletKind.Typedef,
                memberof: moduleName,
                scope: "public"
            });
            this.setParentModule(moduleName);
            this.setIsPublic(true);
            this.name = name;
            this.adhocMembers = members;
        }

        public getFullName(): string {
            return this.getQualifiedName();
        }

        public getKind(): TSOutputtableKind {
            return TSOutputtableKind.UserInterface;
        }

        public output(
            stream: IndentedOutputStream,
            conf:   IPluginConfig,
            logger: ILogger
        ): void {
            stream.writeln(`interface ${this.name} {`);
            stream.indent();
            for (let member of this.adhocMembers) {
                let lines = member.split("\n");
                lines[lines.length - 1] += ";";
                for (let line of lines) {
                    stream.writeln(line);
                }
            }
            stream.unindent();
            stream.writeln("}");
        }

        public getQualifiedName(): string {
            let mod = this.getParentModule();
            if (mod == null)
                return this.name;
            else
                return `${mod}.${this.name}`;
        }

        public visit(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): void {
            TypeUtil.getTypeReplacement(this.getQualifiedName(), conf, logger, context);
        }
    }

    /**
     * A user-defined type alias
     */
    export class TSUserTypeAlias extends TSChildElement implements IOutputtableChildElement {
        private typeAlias: string;
        private type: string;

        constructor(moduleName: string, typeAlias: string, type: string) {
            super();
            this.setParentModule(moduleName);
            this.typeAlias = typeAlias;
            this.type = type;
        }

        public getDoclet(): jsdoc.IDoclet {
            return null;
        }

        public isOptional(): boolean {
            let types = this.type.split("|").map(t => t.trim());
            return types.indexOf("undefined") >= 0;
        }

        public getFullName(): string {
            return this.getQualifiedName();
        }

        public getKind(): TSOutputtableKind {
            return TSOutputtableKind.UserTypeAlias;
        }

        private outputDecl(stream: IndentedOutputStream): void {
            if (this.getParentModule() == null)
                stream.writeln(`declare type ${this.typeAlias} = ${this.type};`);
            else
                stream.writeln(`type ${this.typeAlias} = ${this.type};`);
        }

        public output(
            stream: IndentedOutputStream,
            conf:   IPluginConfig,
            logger: ILogger
        ): void {
            this.outputDecl(stream);
        }

        public getQualifiedName(): string {
            let mod = this.getParentModule();
            if (mod == null)
                return this.typeAlias;
            else
                return `${mod}.${this.typeAlias}`;
        }

        public visit(
            context: TypeVisibilityContext,
            conf:    IPluginConfig,
            logger:  ILogger
        ): void {
            TypeUtil.getTypeReplacement(this.getQualifiedName(), conf, logger, context);
        }
    }

    /**
     * A TypeScript module definition that is ready for output
     */
    export interface ITSModule {
        /**
         * Indicates if this is the root module (true = root, false = child, unspecified = global)
         */
        isRoot?: boolean;

        /**
         * Child modules
         */
        children: Map<string, ITSModule>;

        /**
         * Types/vars/functions defined at this level
         */
        types: IOutputtable[];
    }
}
