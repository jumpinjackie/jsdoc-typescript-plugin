/// <reference path="./doclettypes.ts" />

module TsdPlugin {
    /**
     * Represents a JsDoc doclet, a parsed piece of documentation for a type, function
     * or member
     */
    export interface IDoclet {
        /**
         * The full raw comment of the doclet
         */
        comment?: string;
        /**
         * Declared access
         */
        access?: string;
        /**
         * The description of the doclet (extracted from raw comments)
         */
        description: string;
        /**
         * The description of the class doclet (extracted from raw comments)
         */
        classdesc?: string;
        /**
         * Parameter information
         */
        params?: IDocletParameter[];
        /**
         * Return type information
         */
        returns?: IDocletTypeInfo[];
        /**
         * Data about custom annotations applied on this doclet
         */
        tags?: IDocletTag[];
        /**
         * The name of this identifier
         */
        name: string;
        /**
         * The full name of this identifier
         */
        longname: string;
        /**
         * The kind of doclet
         */
        kind: string;
        /**
         * Denotes the full name of the parent identifier that this doclet is a child of
         */
        memberof: string;
        /**
         * The scope of the doclet
         */
        scope: string;
        /**
         * Indicates of any documentation was found while parsing the doclet for this identifier
         */
        undocumented?: boolean;
        /**
         * The type of this identifier. Not applicable for functions
         */
        type?: IDocletType;
        /**
         * If this is a class doclet, denotes the types that this class inherits from
         */
        augments?: string[];
        /**
         * Indicates of this identifier is nullable. Applicable for properties and module/global-scoped vars 
         */
        nullable?: boolean;
        /**
         * Indicates if this doclet inherits documentation from a parent type member of the same name
         */
        inheritdoc?: boolean;
        /**
         * Arbitrary JSDoc metadata
         */
        meta?: any;
    }
}