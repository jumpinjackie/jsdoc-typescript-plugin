/// <reference path="../typings/tsd.d.ts" />
/// <reference path="./doclet.ts" />
/// <reference path="./config.ts" />

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
    
    export function DumpDoclet(doclet: IDoclet) {
        return JSON.stringify(doclet, JsDocletStringifyFilter, 4);
        //return JSON.stringify(doclet, null, 4);
    }
    
    //TODO: Generic placeholder parameters are being added, which may trip up the type hoisting afterwards
    //TODO: It would be nice to filter out built-in types (ie. types in TypeScript's lib.d.ts)
    export class TypeVisibilityContext {
        private types: Dictionary<string>;
        private ignore: Dictionary<string>;
        constructor() {
            this.types = {};
            this.ignore = {
                "number": "number",
                "Number": "Number",
                "undefined": "undefined",
                "null": "null",
                "string": "string",
                "String": "String",
                "boolean": "boolean",
                "Boolean": "Boolean",
            };
        }
        public removeType(typeName: string): void {
            if (this.hasType(typeName)) {
                delete this.types[typeName];
            }
        }
        public hasType(typeName: string): boolean {
            return this.types[typeName] != null;
        }
        public addType(typeName: string, conf: ITypeScriptPluginConfiguration, logger: ILogger) {
            this.addTypes([ typeName ], conf, logger);
        }
        private ignoreType(typeName: string): boolean {
            return this.ignore[typeName] != null;
        }
        public addTypes(typeNames: string[], conf: ITypeScriptPluginConfiguration, logger: ILogger) {
            for (var type of typeNames) {
                if (!this.ignoreType(type)) {
                    this.types[type] = type;
                }
            }
        }
        public isEmpty(): boolean { return Object.keys(this.types).length == 0; }
        public getTypes(): string[] { return Object.keys(this.types); }
    }
    
    export class TypeUtil {
        
        public static isTsElementNotPublic(type: IOutputtable): boolean {
            if (type instanceof TSMethod) {
                return !type.getIsPublic();
            }
            if (type instanceof TSComposable) {
                return !type.getIsPublic();
            }
            return false;
        }
        
        public static isEnumDoclet(doclet: IDoclet): boolean {
            return (doclet.kind == DocletKind.Member &&
                   doclet.isEnum === true &&
                   (doclet.properties || []).length > 0) || (doclet.comment || "").indexOf("@enum") >= 0;
        }
        
        public static fixStringEnumTypes(typeNames: string[], publicTypes: Dictionary<IOutputtable>): void {
            //If we encounter any string enum typedefs, replace type with 'string'
            for (let i = 0; i < typeNames.length; i++) {
                let ot = publicTypes[typeNames[i]];
                if (ot != null && ot.getKind() == TSOutputtableKind.Typedef) {
                    let tdf = <TSTypedef>ot;
                    if (tdf.getEnumType() == TSEnumType.String) {
                        typeNames[i] = "string";
                    }
                }
            }
        }
        
        public static isPrivateDoclet(doclet: IDoclet, conf: ITypeScriptPluginConfiguration = null): boolean {
            //If the configuration defines a particular annotation as a public API marker and it
            //exists in the doclet's tag list, the doclet is considered part of the public API
            if (conf != null && conf.publicAnnotation) {
                var found = (doclet.tags || []).filter(tag => tag.originalTitle == conf.publicAnnotation);
                if (found.length == 1) //tag found
                    return false;
                
                //In this mode, absence of the tag means not public
                return true;
            }
            
            return doclet.access == "private" ||
                   doclet.undocumented == true;
        }
        
        public static getTypeReplacement(typeName: string, conf: ITypeScriptPluginConfiguration, logger: ILogger, context?: TypeVisibilityContext): string {
            //Look in user configured overrides
            if (conf.typeReplacements.hasOwnProperty(typeName)) {
                return conf.typeReplacements[typeName];
            } else {
                //Before returning, see if the type annotation matches known patterns
                //
                //NOTE: Regex-based checks take precedence as we want to check for specific
                //patterns first before trying to look for things like array or union type
                //notation
                
                //Anonymous function with return type
                var rgxm = typeName.match(/function\((.+)\):\s+(.+)/);
                if (rgxm) {
                    //console.log("is anon function with return type");
                    var typeArgs = rgxm[1].split(",")
                                          .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger, context));
                    var funcParams = [];
                    for (var i = 0; i < typeArgs.length; i++) {
                        var typeArg = typeArgs[i];
                        //Check if it's of the form: "param:value"
                        var rgxp = typeArg.match(/(.+)\:(.+)/);
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
                rgxm = typeName.match(/function\((.+)\)/);
                if (rgxm) {
                    //console.log("is anon function with no return type");
                    var typeArgs = rgxm[1].split(",")
                                          .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger, context));
                    var funcParams = [];
                    for (var i = 0; i < typeArgs.length; i++) {
                        var typeArg = typeArgs[i];
                        //Check if it's of the form: "param:value"
                        var rgxp = typeArg.match(/(.+)\:(.+)/);
                        if (rgxp && rgxp.length == 3) {
                            //TODO: We can keep the param if we can be sure if it is not a reserved keyword
                            funcParams.push("arg" + i + ": " + rgxp[2]);
                        } else {
                            funcParams.push("arg" + i + ": " + typeArgs[i]);
                        }
                    }
                    return "(" + funcParams.join(", ") + ") => any";
                }
                //Array - Array.<type>
                rgxm = typeName.match(/(Array\.)\<(.+)>/); 
                if (rgxm) {
                    //console.log("is array");
                    return TypeUtil.getTypeReplacement(rgxm[2].trim(), conf, logger, context) + "[]";
                }
                //Array - type[]
                rgxm = typeName.match(/(.+)\[\]$/);
                if (rgxm) {
                    //console.log("is array");
                    return TypeUtil.getTypeReplacement(rgxm[1].trim(), conf, logger, context) + "[]";
                }
                //kvp - Object.<TKey, TValue> -> { [key: TKey]: TValue; }
                rgxm = typeName.match(/(Object\.)\<(.+)\,(.+)\>/);
                if (rgxm) {
                    //console.log("is kvp");
                    var keyType = TypeUtil.getTypeReplacement(rgxm[2].trim(), conf, logger, context);
                    var valueType = TypeUtil.getTypeReplacement(rgxm[3].trim(), conf, logger, context);
                    return "{ [key: " + keyType + "]: " + valueType + "; }";
                }
                //Some generic type - SomeGenericType.<AnotherType>
                rgxm = typeName.match(/(.+)(.\<)(.+)\>/);
                if (rgxm) {
                    //console.log("is generic type");
                    var genericType = TypeUtil.getTypeReplacement(rgxm[1], conf, logger, context);
                    var genericTypeArgs = rgxm[3].split(",")
                                                 .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger, context));
                    return genericType + "<" + genericTypeArgs.join(",") + ">";
                }
                //Array - untyped
                if (typeName.toLowerCase() == "array") {
                    //console.log("is untyped array");
                    //TODO: Include symbol context
                    logger.warn("Encountered untyped array. Treating as 'any[]'");
                    return "any[]";
                }
                //Union-type - typeA|typeB
                if (typeName.indexOf("|") >= 0) {
                    //console.log("union type");
                    var types = typeName.split("|");
                    var replTypes = [];
                    for (var i = 0; i < types.length; i++) {
                        replTypes.push(TypeUtil.getTypeReplacement(types[i].trim(), conf, logger, context));
                    }
                    return replTypes.join("|");
                }
                
                //When referenced, tildefied types should be dotted
                typeName = typeName.replace("~", ".");
                
                if (context != null) {
                    context.addType(typeName, conf, logger);
                }
                
                //No other replacement suggestions, return as is
                return typeName;
            }
        }
        
        public static replaceFunctionTypes(parsedReturnTypes: string[], doclet: IDoclet, conf: ITypeScriptPluginConfiguration, logger: ILogger, context?: TypeVisibilityContext): void {
            for (let i = 0; i < parsedReturnTypes.length; i++) {
                if (parsedReturnTypes[i] == "Function") {
                    //console.log(`Parsing function return type for ${doclet.longname} from @return in comments`);
                    //Try to parse return type from comment
                    var matches = (doclet.comment || "").match(/@return \{(.*)\}/);
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
        
        public static parseAndConvertTypes(typeAnno: IDocletType, conf: ITypeScriptPluginConfiguration, logger: ILogger, context?: TypeVisibilityContext): string[] {
            var utypes = [];
            if (typeAnno.names.length > 0) {
                for (var anno of typeAnno.names) {
                    var typeName = TypeUtil.getTypeReplacement(anno, conf, logger, context);
                    //This is an optionality hint for TypeScript but in terms of signature, it should not be emitted
                    if (typeName == "undefined" || typeName == "null")
                        continue;
                    utypes.push(typeName);
                }
            }
            return utypes;
        }
        
        public static extractGenericTypesFromDocletTags(tags: IDocletTag[]): string[] {
            var genericTypes = [];
            //@template is non-standard, but the presence of this annotation conveys
            //generic type information that we should capture
            var genericTypeTags = (tags || []).filter(tag => tag.originalTitle == "template");
            if (genericTypeTags.length > 0) {
                for (var genericTypeTag of genericTypeTags) {
                    var gts = genericTypeTag.value.split(",");
                    for (var gt of gts) {
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
        output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void;
        visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void;
    }

    export abstract class TSMember implements IOutputtable {
        protected doclet: IDoclet;
        protected isPublic: boolean;
        constructor(doclet: IDoclet) {
            this.doclet = doclet;
            this.isPublic = true;
        }
        
        public getDoclet(): IDoclet { return this.doclet; }
        
        public inheritsDoc(): boolean { return this.doclet.inheritdoc === true; }
        
        public setIsPublic(value: boolean): void { this.isPublic = value; }
        
        public getIsPublic(): boolean { return this.isPublic; }
        
        public getFullName(): string { return this.doclet.longname; }
        
        public abstract getKind(): TSOutputtableKind;
        
        protected writeExtraDescriptionParts(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void { }
        
        protected getDescription(): string { return this.doclet.description; }
        
        protected writeDescription(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
            //Description as comments
            stream.writeln("/**");
            var desc = this.getDescription();
            if (desc != null) {
                var descParts = desc.split("\n");
                for (var i = 0; i < descParts.length; i++) {
                    stream.writeln(" * " + descParts[i]);
                }
            } else if (conf.fillUndocumentedDoclets) {
                //logger.warn(`The ${kind} (${this.doclet.name}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                stream.writeln(` * TODO: This ${kind} has no documentation. Contact the library author if this ${kind} should be documented`);
            }
            this.writeExtraDescriptionParts(kind, stream, conf, logger, publicTypes);
            stream.writeln(" */");
        }
        
        public abstract output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void;
        
        public abstract visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void;
    }

    export enum TSEnumType {
        String,
        Number,
        Invalid
    }

    export class TSProperty extends TSMember {
        private isModule: boolean;
        private allowOptional: boolean;
        constructor(doclet: IDoclet, allowOptional: boolean) {
            super(doclet);
            this.isModule = false;
            this.allowOptional = allowOptional;
        }
        public getKind(): TSOutputtableKind { return TSOutputtableKind.Property; }
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
        private isOptional(publicTypes: Dictionary<IOutputtable>): boolean {
            if (this.allowOptional) {
                //If the argument is a typedef, it will (and should) be the only argument type
                if (this.doclet.type.names.length == 1) {
                    var outputtable = publicTypes[this.doclet.type.names[0]];
                    if (outputtable != null) {
                        var kind = outputtable.getKind();
                        if (TSOutputtableKind.Typedef == kind) {
                            var tdf = <TSTypedef>outputtable;
                            if (tdf.isOptional())
                                return true;
                        }
                        if (TSOutputtableKind.UserTypeAlias == kind) {
                            var utdf = <TSUserTypeAlias>outputtable;
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
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
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
                var propDecl = "";
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
                if (this.doclet.type != null) {
                    var types = TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger);
                    TypeUtil.fixStringEnumTypes(types, publicTypes);
                    TypeUtil.replaceFunctionTypes(types, this.doclet, conf, logger);
                    propDecl += types.join("|") + ";";
                } else {
                    logger.warn(`Property ${this.doclet.name} of ${this.doclet.memberof} has no return type defined. Defaulting to "any"`);
                    propDecl += "any;";
                }
                stream.writeln(propDecl);
            }
        }
        
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            if (this.doclet.type != null) {
                TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger, context);
            }
        }
    }
    
    interface IDocletParameterContainer { members: IDocletParameter[], param: IDocletParameter }
    
    interface ITsMemberContainer { members: TSMember[], member: TSMember }

    export class TSMethod extends TSMember {
        private isModule: boolean;
        private isTypedef: boolean;
        constructor(doclet: IDoclet) {
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
        
        private isArgOptional(arg: IDocletParameter, publicTypes: Dictionary<IOutputtable>): boolean {
            //If the argument is a typedef, it will (and should) be the only argument type
            if (arg.type != null && arg.type.names.length > 0) {
                if (arg.type.names.length == 1) {
                    var outputtable = publicTypes[arg.type.names[0]];
                    if (outputtable != null) {
                        var kind = outputtable.getKind();
                        if (TSOutputtableKind.Typedef == kind) {
                            var tdf = <TSTypedef>outputtable;
                            if (tdf.isOptional())
                                return true;
                        }
                        if (TSOutputtableKind.UserTypeAlias == kind) {
                            var utdf = <TSUserTypeAlias>outputtable;
                            if (utdf.isOptional())
                                return true;
                        }
                    }
                } else {
                    //Any type ending with '=' or starting with '?' denotes optionality to the whole
                    var matches1 = arg.type.names.filter(t => t.indexOf("=") == t.length - 1);
                    var matches2 = arg.type.names.filter(t => t.indexOf("?") == 0);
                    if (matches1.length > 0 || matches2.length > 0) {
                        return true;
                    }
                }
            }
            return arg.nullable == true ||
                   arg.optional == true ||
                   arg.type.names.indexOf("undefined") >= 0;
        }
        
        protected writeExtraDescriptionParts(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
            //If we have args, document them. Because TypeScript is ... typed, the {type}
            //annotation is not necessary in the documentation
            let params = this.studyParameters(null, conf, logger);
            if (params.length > 0 && !this.isTypedef) {
                var forceNullable = false;
                for (var arg of params) {
                    var req = "";
                    if (forceNullable || this.isArgOptional(arg, publicTypes)) {
                        // You can't have non-nullable arguments after a nullable argument. So by definition
                        // everything after the nullable argument has to be nullable as well
                        forceNullable = true;
                        req = " (Optional)";
                    } else {
                        req = " (Required)";
                    }
                    var argDesc = arg.description || "";
                    if (argDesc == "" && conf.fillUndocumentedDoclets) {
                        //logger.warn(`Argument (${arg.name}) of ${kind} (${this.doclet.longname}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                        argDesc = "TODO: This parameter has no description. Contact this library author if this parameter should be documented\n";
                    }
                    stream.writeln(` * @param ${arg.name} ${req} ${argDesc}`);
                }
            }
        }
        
        protected outputScope(): boolean { return true; }
        
        protected outputGenericTypes(): boolean { return true; }
        
        /**
         * Studies the doclet parameters and returns a normalized set.
         * 
         * When visiting this instance, a TypeVisibilityContext is provided, otherwise it is null
         */
        private studyParameters(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): IDocletParameter[] {
            let params: IDocletParameter[] = [];
            let paramMap: Dictionary<IDocletParameterContainer> = {};
            
            let methodParams = this.doclet.params || [];
            
            if (methodParams.length > 0) {
                for (let arg of methodParams) {
                    if (arg.type != null) {
                        TypeUtil.parseAndConvertTypes(arg.type, conf, logger, context);
                        if (arg.name.indexOf(".") >= 0) { //If it's dotted is a member of the options argument
                            let parts = arg.name.split(".");
                            let parm = paramMap[parts[0]];
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
                            paramMap[arg.name] = {
                                members: [],
                                param: arg
                            };
                        }
                    }
                }
            }
            
            //Since there is no guarantee of object keys being insertion order 
            //(http://stackoverflow.com/questions/5525795/does-javascript-guarantee-object-property-order)
            //we'll loop the original doclet params and pick up the keyed parameter along the way 
            for (let arg of methodParams) {
                if (arg.type != null) {
                    var p = paramMap[arg.name];
                    if (p != null) {
                        params.push(p.param);
                        if (p.members.length > 0 && context != null) {
                            //TODO: Define a new options interface and register it
                            //with the context
                        }
                    }
                }
            }
            
            return params;
        }
        
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            this.studyParameters(context, conf, logger);
            if (this.outputReturnType()) {
                if (this.doclet.returns != null) {
                    for (var retDoc of this.doclet.returns) {
                        if (retDoc.type != null) {
                            var parsedTypes = TypeUtil.parseAndConvertTypes(retDoc.type, conf, logger, context);
                            TypeUtil.replaceFunctionTypes(parsedTypes, this.doclet, conf, logger, context);
                        }
                    }
                }
            }
        }
        
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
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
                    if (this.doclet.memberof == null && conf.doNotDeclareTopLevelElements == false) {
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
                            let utypes = TypeUtil.parseAndConvertTypes(arg.type, conf, logger);
                            TypeUtil.fixStringEnumTypes(utypes, publicTypes);
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
                
                //Determine return type
                let retTypes = [];
                if (this.doclet.returns != null) {
                    for (let retDoc of this.doclet.returns) {
                        if (retDoc.type != null) {
                            let rts = TypeUtil.parseAndConvertTypes(retDoc.type, conf, logger);
                            for (let r of rts) {
                                retTypes.push(r);
                            }
                        }
                    }
                }
                
                TypeUtil.fixStringEnumTypes(retTypes, publicTypes);
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
                
                methodDecl += ";";
                stream.writeln(methodDecl);
            }
        }
    }

    export class TSConstructor extends TSMethod {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        
        // We're re-using the class doclet here, so any generic types would've
        // already been written out
        protected outputGenericTypes(): boolean { return false; }
        
        // There is no need to specify scope of constructors
        protected outputScope(): boolean { return false; }
        
        // Constructors need not specify a return type
        protected outputReturnType(): boolean { return false; }
        
        protected getMethodName(): string { return "constructor"; }
        
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            super.visit(context, conf, logger);
        }
        
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
            super.output(stream, conf, logger, publicTypes);
        }
    }

    /**
     * Defines a TS type that resides within a module
     */
    export abstract class TSChildElement {
        protected parentModule: string;
        constructor() {
            
        }
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
        protected doclet: IDoclet;
        constructor(doclet: IDoclet) {
            super();
            this.doclet = doclet;
        }
        
        public getDoclet(): IDoclet { return this.doclet; }
        
        public getFullName(): string { return this.doclet.longname; }
        
        public abstract getKind(): TSOutputtableKind;
        
        protected getDescription(): string { return this.doclet.description; }
        
        protected writeDescription(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            //Description as comments
            var desc = this.getDescription();
            if (desc != null) {
                stream.writeln("/**");
                var descParts = desc.split("\n");
                for (var i = 0; i < descParts.length; i++) {
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
        
        public abstract output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void;
        
        public abstract visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void;
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
        constructor(doclet: IDoclet) {
            super(doclet);
            this.members = [];
            this.isPublic = false;
        }
        public addMember(member: TSMember): void {
            this.members.push(member);
        }
        public findMember(name: string, kind: string): TSMember {
            var matches = this.members.filter(m => {
                var doclet = m.getDoclet();
                return doclet.name == name && doclet.kind == kind;
            });
            if (matches.length == 1)
                return matches[0];
            else
                return null;
        }
        public getParentTypeNames(): string[] { return this.doclet.augments; }
        /**
         * Finds a matching member from any of the current member's types inheritance hierarchy that doesn't inherit documentation
         */
        public getInheritedMember(memberDoclet: IDoclet, parents: string[], publicTypes: Dictionary<IOutputtable>): TSMemberResult {
            for (var parentTypeName of parents) {
                var type = publicTypes[parentTypeName];
                //Parent type is a known TSComposable
                if (type != null && (type.getKind() == TSOutputtableKind.Class || type.getKind() == TSOutputtableKind.Typedef)) {
                    var comp = <TSComposable>type;
                    //console.log(`Checking if ${comp.getFullName()} has member ${memberDoclet.name} (${memberDoclet.kind})`);
                    var member = comp.findMember(memberDoclet.name, memberDoclet.kind);
                    var parentTypeNames = comp.getParentTypeNames() || [];
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
        constructor(doclet: IDoclet) {
            super(doclet);
            this.enumType = this.determineEnumType();
            this.alreadyAddedEnumMembers = false;
            //This is a non-typedef kind of enum
            if (this.enumType != TSEnumType.Invalid &&
                this.doclet.isEnum === true &&
                (this.doclet.properties || []).length > 0) {
                for (var prop of this.doclet.properties) {
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
        public getEnumType(): TSEnumType { return this.enumType; }
        public getKind(): TSOutputtableKind { return TSOutputtableKind.Typedef; }
        public isOptional(): boolean {
            return this.members.length == 0 //Must be a type-alias typedef
                && this.doclet.type != null
                && this.doclet.type.names != null
                && this.doclet.type.names.indexOf("undefined") >= 0;
        }
        public getQualifiedName(): string {
            var mod = this.getParentModule();
            if (mod == null)
                return this.doclet.name;
            else
                return `${mod}.${this.doclet.name}`;
        }
        /**
         * Studies the members of this doclet and returns a normalized set.
         * 
         * When visiting this instance, a TypeVisibilityContext is provided, otherwise it is null
         */
        private studyMembers(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): TSMember[] {
            let studiedMembers: TSMember[] = [];
            let paramMap: Dictionary<ITsMemberContainer> = {};
            
            let members = this.members || [];
            
            if (members.length > 0) {
                for (let member of members) {
                    let memberDoclet = member.getDoclet();
                    if (memberDoclet.type != null) {
                        TypeUtil.parseAndConvertTypes(memberDoclet.type, conf, logger, context);
                        if (memberDoclet.name.indexOf(".") >= 0) { //If it's dotted is a member of the options property
                            let parts = memberDoclet.name.split(".");
                            let parm = paramMap[parts[0]];
                            //If we get 'foo.bar', we should have already processed argument 'foo'
                            if (parm == null) {
                                //Only want to error when not visiting (ie. context is null)
                                if (context == null) {
                                    logger.error(`In method ${this.doclet.longname}: Argument (${memberDoclet.name}) is a dotted member of argument (${parts[0]}) that either does not exist, or does not precede this argument`);
                                }
                            } else {
                                parm.members.push(member);
                            }
                        } else {
                            paramMap[memberDoclet.name] = {
                                members: [],
                                member: member
                            };
                        }
                    }
                }
            }
            
            //Since there is no guarantee of object keys being insertion order 
            //(http://stackoverflow.com/questions/5525795/does-javascript-guarantee-object-property-order)
            //we'll loop the original doclet params and pick up the keyed parameter along the way 
            for (let member of members) {
                let memberDoclet = member.getDoclet();
                if (memberDoclet.type != null) {
                    let p = paramMap[memberDoclet.name];
                    if (p != null) {
                        studiedMembers.push(p.member);
                        if (p.members.length > 0 && context != null) {
                            //TODO: Define a new options interface and register it
                            //with the context
                        }
                    }
                }
            }
            
            return studiedMembers;
        }
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
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
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for typedef");
                stream.writeln(DumpDoclet(this.doclet));
                stream.writeln(" */");
            }
            
            this.writeDescription(DocletKind.Typedef, stream, conf, logger);
            let hasMembers = this.members.length > 0;
            
            let declareMe = "";
            if (this.getParentModule() == null && conf.doNotDeclareTopLevelElements == false) {
                declareMe = "declare ";
            }
            
            if (this.enumType == TSEnumType.Number && hasMembers) {
                stream.writeln(`${declareMe}enum ${this.doclet.name} {`);
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
                //TODO: TypeScript 1.8 will introduce union string literals, which will let us
                //emit something like this:
                //
                //type StringEnum = "Foo" | "Bar";
                //
                //Instead of what we currently do which is:
                //
                //class StringEnum {
                //    public static get Foo(): string = "Foo";
                //    public static get Bar(): string = "Bar";
                //}
                //
                //When TS 1.8 drops, we should allow both string enum forms to be generated
                //depending on plugin configuration
                
                //Write as a class with static string members
                //NOTE: If this is referenced in a parameter or return type, must make 
                //sure to rewrite that type as 'string'. If generating union string literals
                //this is not required
                stream.writeln(`${declareMe}class ${this.doclet.name} {`);
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
            } else { //Not an enum
                //If it has methods and/or properties, treat this typedef as an interface
                if (hasMembers) {
                    stream.writeln(`interface ${this.doclet.name} {`);
                    stream.indent();
                    let members = this.studyMembers(null, conf, logger);
                    for (let member of members) {
                        member.output(stream, conf, logger, publicTypes);
                    }
                    stream.unindent();
                    stream.writeln("}");
                } else {
                    let typeDecl = `${declareMe}type ${this.doclet.name}`;
                    if (this.doclet != null && this.doclet.type != null) {
                        let types = TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger);
                        //If we find 'Function' in here, send the hint that they should use @callback to document function types
                        if (types.indexOf("Function") >= 0) {
                            logger.warn(`Type ${this.doclet.name} was aliased to the generic 'Function' type. Consider using @callback (http://usejsdoc.org/tags-callback.html) to document function types`);
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
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        
        public getKind(): TSOutputtableKind { return TSOutputtableKind.Class; }
        
        protected getDescription(): string { return this.doclet.classdesc || this.doclet.description; }
        
        public getQualifiedName(): string {
            var mod = this.getParentModule();
            if (mod == null)
                return this.doclet.name;
            else
                return `${mod}.${this.doclet.name}`;
        }
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            TypeUtil.getTypeReplacement(this.getQualifiedName(), conf, logger, context);
            if (this.doclet.augments != null) {
                for (let t of this.doclet.augments) {
                    TypeUtil.getTypeReplacement(t, conf, logger, context);
                }
            }
            if (this.ctor != null)
                this.ctor.visit(context, conf, logger);
            for (var member of this.members) {
                if (member.getIsPublic() || member.inheritsDoc())
                    member.visit(context, conf, logger);
            }
        }
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for class");
                stream.writeln(DumpDoclet(this.doclet));
                stream.writeln(" */");
            }
            
            this.writeDescription(DocletKind.Class, stream, conf, logger);
            
            var clsDecl = "";
            //If un-parented, the emitted class will be global and must be declared as a result
            if (this.getParentModule() == null && conf.doNotDeclareTopLevelElements == false) {
                clsDecl = "declare ";
            }
            clsDecl += "class " + this.doclet.name;
            var genericTypes = TypeUtil.extractGenericTypesFromDocletTags(this.doclet.tags);
            //Class generic parameters
            if (genericTypes.length > 0) {
                //As these are generic placeholders, they don't go through the
                //type replacer
                clsDecl += "<" + genericTypes.join(", ") + ">";
            }
            //Inheritance
            if (this.doclet.augments != null) {
                clsDecl += " extends " + this.doclet.augments.join(",");
            }
            clsDecl += " {";
            stream.writeln(clsDecl);
            stream.indent(); //Start class members
            if (this.ctor != null) {
                this.ctor.output(stream, conf, logger, publicTypes);
            }
            for (var member of this.members) {
                //NOTE: inheritsDoc() is tested first before public visibility as it may inherit off of something that
                //has public visibility
                if (member.inheritsDoc()) {
                    var inheritedQuery = this.getInheritedMember(member.getDoclet(), this.doclet.augments, publicTypes);
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
    export class TSUserInterface extends TSChildElement implements IOutputtableChildElement {
        private name: string;
        private members: string[];
        constructor(moduleName: string, name: string, members: string[]) {
            super();
            this.setParentModule(moduleName);
            this.name = name;
            this.members = members;
        }
        public getFullName(): string { return this.getQualifiedName(); }
        public getKind(): TSOutputtableKind { return TSOutputtableKind.UserInterface; }
        private outputDecl(stream: IndentedOutputStream): void {
            stream.writeln(`interface ${this.name} {`);
            stream.indent();
            for (var member of this.members) {
                stream.writeln(`${member};`);
            }
            stream.unindent();
            stream.writeln("}");
        }
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            this.outputDecl(stream);
        }
        public getQualifiedName(): string {
            var mod = this.getParentModule();
            if (mod == null)
                return this.name;
            else
                return `${mod}.${this.name}`;
        }
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
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
        public isOptional(): boolean {
            var types = this.type.split("|").map(t => t.trim());
            return types.indexOf("undefined") >= 0;
        }
        public getFullName(): string { return this.getQualifiedName(); }
        public getKind(): TSOutputtableKind { return TSOutputtableKind.UserTypeAlias; }
        private outputDecl(stream: IndentedOutputStream): void {
            if (this.getParentModule() == null)
                stream.writeln(`declare type ${this.typeAlias} = ${this.type};`);
            else
                stream.writeln(`type ${this.typeAlias} = ${this.type};`);
        }
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            this.outputDecl(stream);
        }
        public getQualifiedName(): string {
            var mod = this.getParentModule();
            if (mod == null)
                return this.typeAlias;
            else
                return `${mod}.${this.typeAlias}`;
        }
        public visit(context: TypeVisibilityContext, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
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
        children: Dictionary<ITSModule>;
        /**
         * Types/vars/functions defined at this level
         */
        types: IOutputtable[];
    }
}