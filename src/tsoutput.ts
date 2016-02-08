/// <reference path="../typings/tsd.d.ts" />
/// <reference path="./doclet.ts" />

module TsdPlugin {
    
    
    export interface IOutputtable {
        output(stream: IndentedOutputStream): void;
    }

    export abstract class TSMember implements IOutputtable {
        protected docletRef: IDoclet;
        constructor(doclet: IDoclet) {
            this.docletRef = doclet;
        }
        public abstract output(stream: IndentedOutputStream): void;
    }

    export class TSProperty extends TSMember {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        public output(stream: IndentedOutputStream): void {
            
        }
    }

    export class TSMethod extends TSMember {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        public output(stream: IndentedOutputStream): void {
            
        }
    }

    export class TSConstructor extends TSMethod {
        constructor(doclet: IDoclet) {
            super(doclet);
        }
        public output(stream: IndentedOutputStream): void {
            
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
        public abstract output(stream: IndentedOutputStream): void;
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
        public output(stream: IndentedOutputStream): void {
            
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
        public output(stream: IndentedOutputStream): void {
            
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
            stream.writeln(`export interface ${this.name} {`);
            stream.indent();
            for (var member of this.members) {
                stream.writeln(`${member};`);
            }
            stream.unindent();
            stream.writeln("}");
        }
        public output(stream: IndentedOutputStream): void {
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
        public output(stream: IndentedOutputStream): void {
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