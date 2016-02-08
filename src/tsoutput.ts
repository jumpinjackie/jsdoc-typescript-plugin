/// <reference path="../typings/tsd.d.ts" />
/// <reference path="./doclet.ts" />
/// <reference path="./config.ts" />

module TsdPlugin {
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
    
    export class TypeUtil {
        
        public static isPrivateDoclet(doclet: IDoclet, conf: ITypeScriptPluginConfiguration): boolean {
            //If the configuration defines a particular annotation as a public API marker and it
            //exists in the doclet's tag list, the doclet is considered part of the public API
            if (conf.publicAnnotation) {
                var found = (doclet.tags || []).filter(tag => tag.originalTitle == conf.publicAnnotation);
                if (found.length == 1) //tag found
                    return false;
                
                //In this mode, absence of the tag means not public
                return true;
            }
            
            return doclet.access == "private" ||
                   doclet.undocumented == true;
        }
        
        public static getTypeReplacement(typeName: string, conf: ITypeScriptPluginConfiguration, logger: ILogger): string {
            //Look in user configured overrides
            if (conf.typeReplacements.hasOwnProperty(typeName)) {
                return conf.typeReplacements[typeName];
            } else {
                //Before returning, see if the type annotation matches known patterns
                //
                //NOTE: Regex-based checks take precedence as we want to check for specific
                //patterns first before trying to look for things like array or union type
                //notation
                
                //Array - Array.<type>
                var rgxm = typeName.match(/(Array\.)\<(.+)>/); 
                if (rgxm) {
                    return TypeUtil.getTypeReplacement(rgxm[2].trim(), conf, logger) + "[]";
                }
                //Array - type[]
                rgxm = typeName.match(/(.+)\[\]$/);
                if (rgxm) {
                    return TypeUtil.getTypeReplacement(rgxm[1].trim(), conf, logger) + "[]";
                }
                //kvp - Object.<TKey, TValue> -> { [key: TKey]: TValue; }
                rgxm = typeName.match(/(Object\.)\<(.+)\,(.+)\>/);
                if (rgxm) {
                    var keyType = TypeUtil.getTypeReplacement(rgxm[2].trim(), conf, logger);
                    var valueType = TypeUtil.getTypeReplacement(rgxm[3].trim(), conf, logger);
                    return "{ [key: " + keyType + "]: " + valueType + "; }";
                }
                //Some generic type - SomeGenericType.<AnotherType>
                rgxm = typeName.match(/(.+)(.\<)(.+)\>/);
                if (rgxm) {
                    var genericType = TypeUtil.getTypeReplacement(rgxm[1], conf, logger);
                    var genericTypeArgs = rgxm[3].split(",")
                                                 .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger));
                    return genericType + "<" + genericTypeArgs.join(",") + ">";
                }
                //Anonymous function
                rgxm = typeName.match(/function\((.+)\)/);
                if (rgxm) {
                    var typeArgs = rgxm[1].split(",")
                                          .map(tn => TypeUtil.getTypeReplacement(tn.trim(), conf, logger));
                    var funcParams = [];
                    for (var i = 0; i < typeArgs.length; i++) {
                        funcParams.push("arg" + i + ": " + typeArgs[i]);
                    }
                    return "(" + funcParams.join(", ") + ") => any";
                }
                //Array - untyped
                if (typeName.toLowerCase() == "array") {
                    //TODO: Include symbol context
                    logger.warn("Encountered untyped array. Treating as 'any[]'");
                    return "any[]";
                }
                //Union-type - typeA|typeB
                if (typeName.indexOf("|") >= 0) {
                    var types = typeName.split("|");
                    var replTypes = [];
                    for (var i = 0; i < types.length; i++) {
                        replTypes.push(TypeUtil.getTypeReplacement(types[i].trim(), conf, logger));
                    }
                    return replTypes.join("|");
                }
                //No other replacement suggestions, return as is
                return typeName;
            }
        }
        
        public static parseAndConvertTypes(typeAnno: IDocletType, conf: ITypeScriptPluginConfiguration, logger: ILogger): string[] {
            var utypes = [];
            if (typeAnno.names.length > 0) {
                for (var j = 0; j < typeAnno.names.length; j++) {
                    var typeName = TypeUtil.getTypeReplacement(typeAnno.names[j], conf, logger);
                    //Is this a valid JSDoc annotated type? Either way, I don't know what the equivalent to use for TypeScript, so skip
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
            var genericTypeTags = tags.filter(tag => tag.originalTitle == "template");
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
        output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void;
    }

    export abstract class TSMember implements IOutputtable {
        protected doclet: IDoclet;
        constructor(doclet: IDoclet) {
            this.doclet = doclet;
        }
        
        protected writeExtraDescriptionParts(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            
        }
        
        protected writeDescription(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            //Description as comments
            stream.writeln("/**");
            if (this.doclet.description != null) {
                var descParts = this.doclet.description.split("\n");
                for (var i = 0; i < descParts.length; i++) {
                    stream.writeln(" * " + descParts[i]);
                }
            } else if (conf.fillUndocumentedDoclets) {
                logger.warn(`The ${kind} (${this.doclet.name}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                stream.writeln(` * TODO: This ${kind} has no documentation. Contact the library author if this ${kind} should be documented`);
            }
            this.writeExtraDescriptionParts(kind, stream, conf, logger);
            stream.writeln(" */");
        }
        
        public abstract output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void;
    }

    export class TSProperty extends TSMember {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            stream.writeln(`//TODO: Output property ${this.doclet.longname}`);
        }
    }

    export class TSMethod extends TSMember {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        
        protected outputReturnType(): boolean { return true; }
        
        protected getMethodName(): string { return this.doclet.name; }
        
        protected writeExtraDescriptionParts(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            //If we have args, document them. Because TypeScript is ... typed, the {type}
            //annotation is not necessary in the documentation
            if (this.doclet.params != null && this.doclet.params.length > 0) {
                var forceNullable = false;
                for (var arg of this.doclet.params) {
                    var req = "";
                    if (forceNullable || arg.nullable == true) {
                        // You can't have non-nullable arguments after a nullable argument. So by definition
                        // everything after the nullable argument has to be nullable as well
                        forceNullable = true;
                        req = " (Optional)";
                    } else {
                        req = " (Required)";
                    }
                    var argDesc = arg.description || "";
                    if (argDesc == "" && conf.fillUndocumentedDoclets) {
                        //TODO: Include symbol context
                        logger.warn(`Argument (${arg.name}) of ${kind} (${this.doclet.longname}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                        argDesc = "TODO: This parameter has no description. Contact this library author if this parameter should be documented\n";
                    }
                    stream.writeln(` * @param ${arg.name} ${req} ${argDesc}`);
                }
            }
        }
        
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            this.writeDescription("method", stream, conf, logger);
            var methodDecl = (this.doclet.scope == "static" ? "static " : "");
            methodDecl += this.getMethodName();
            var genericTypes = TypeUtil.extractGenericTypesFromDocletTags(this.doclet.tags);
            if (genericTypes && genericTypes.length > 0) {
                methodDecl += "<" + genericTypes.join(", ") + ">";
            }
            methodDecl += "(";
            //Output args
            var argVals = [];
            if (this.doclet.params != null && this.doclet.params.length > 0) {
                var forceNullable = false;
                for (var arg of this.doclet.params) {
                    var argStr = arg.name;
                    if (forceNullable || arg.nullable == true) {
                        // In TypeScript (and most compiled languages), you can't have non-nullable arguments after a nullable argument. 
                        // So by definition everything after the nullable argument has to be nullable as well
                        forceNullable = true;
                        argStr += "?: ";
                    } else {
                        argStr += ": ";
                    }
                    if (arg.type != null) {
                        //Output as TS union type
                        var utypes = TypeUtil.parseAndConvertTypes(arg.type, conf, logger);
                        argStr += utypes.join("|");
                    } else {
                        logger.warn(`Argument '${arg.name}' of method (${this.doclet.longname}) has no type annotation. Defaulting to 'any'`);
                        //Fallback to any
                        argStr += "any";
                    }
                    argVals.push(argStr);
                }
            }
            methodDecl += argVals.join(", ") + ")";
            
            //Determine return type
            var retTypes = [];
            if (this.doclet.returns != null) {
                for (var retDoc of this.doclet.returns) {
                    var rts = TypeUtil.parseAndConvertTypes(retDoc.type, conf, logger);
                    for (var r of rts) {
                        retTypes.push(r);
                    }
                }
            }
            var retType = retTypes.join("|"); //If multiple, return type is TS union
            
            if (this.outputReturnType()) {
                if (retType != null && retType != "") {
                    methodDecl += ": " + retType;
                } else {
                    logger.warn(`No return type specified on (${this.doclet.longname}). Defaulting to '${conf.defaultReturnType}'`);
                    methodDecl += ": " + conf.defaultReturnType;
                }
            }
            
            methodDecl += ";";
            stream.writeln(methodDecl);
        }
    }

    export class TSConstructor extends TSMethod {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        
        protected outputReturnType(): boolean { return false; }
        
        protected getMethodName(): string { return "constructor"; }
        
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            super.output(stream, conf, logger);
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
        
        protected writeDescription(kind: string, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            //Description as comments
            if (this.doclet.description != null) {
                stream.writeln("/**");
                var descParts = this.doclet.description.split("\n");
                for (var i = 0; i < descParts.length; i++) {
                    stream.writeln(" * " + descParts[i]);
                }
                stream.writeln(" */");
            } else if (conf.fillUndocumentedDoclets) {
                logger.warn(`The ${kind} (${this.doclet.name}) has no description. If fillUndocumentedDoclets = true, boilerplate documentation will be inserted`);
                stream.writeln("/**");
                stream.writeln(` * TODO: This ${kind} has no documentation. Contact the library author if this ${kind} should be documented`);
                stream.writeln(" */");
            }
        }
        
        public abstract output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void;
    }

    /**
     * A TS type that has child members
     */
    export abstract class TSComposable extends TSOutputtable {
        public members: TSMember[];
        constructor(doclet: IDoclet) {
            super(doclet);
            this.members = [];
        }
    }

    /**
     * A TS typedef. This could be a type alias or an interface
     */
    export class TSTypedef extends TSComposable {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for typedef");
                stream.writeln(JSON.stringify(this.doclet, JsDocletStringifyFilter, 4));
                stream.writeln(" */");
            }
            
            this.writeDescription(DocletKind.typedef, stream, conf, logger);
            
            //If it has methods and/or properties, treat this typedef as an interface
            if (this.members.length > 0) {
                stream.writeln(`interface ${this.doclet.name} {`);
                stream.indent();
                for (var member of this.members) {
                    member.output(stream, conf, logger);
                }
                stream.unindent();
                stream.writeln("}");
            } else {
                var typeDecl = `type ${this.doclet.name}`;
                if (this.doclet != null && this.doclet.type != null) {
                    var types = TypeUtil.parseAndConvertTypes(this.doclet.type, conf, logger);
                    typeDecl += " = " + types.join("|") + ";\n";
                } else { //Fallback
                    typeDecl += " = any; //TODO: Could not determine underlying type for this typedef. Falling back to 'any'\n";
                }
                stream.writeln(typeDecl);
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
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            if (conf.outputDocletDefs) {
                stream.writeln("/* doclet for typedef");
                stream.writeln(JSON.stringify(this.doclet, JsDocletStringifyFilter, 4));
                stream.writeln(" */");
            }
            
            this.writeDescription(DocletKind.class, stream, conf, logger);
            
            var clsDecl = "class " + this.doclet.name;
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
                this.ctor.output(stream, conf, logger);
            }
            for (var member of this.members) {
                member.output(stream, conf, logger);
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
        private outputDecl(stream: IndentedOutputStream): void {
            if (this.getParentModule() == null)
                stream.writeln(`declare type ${this.typeAlias} = ${this.type};`);
            else
                stream.writeln(`type ${this.typeAlias} = ${this.type};`);
        }
        public output(stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger): void {
            this.outputDecl(stream);
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
         * Types defined at this level
         */
        types: IOutputtable[];
    }
}