
declare module "jsdoc/env" {
    class Environment {
        public static conf: any;
    }
    export = Environment;
}

declare module "jsdoc/util/logger" {
    class Logger {
        public warn(msg: string);
        public error(msg: string);
        public fatal(msg: string);
    }
    export = Logger;
}

declare module jsdoc {
    /**
     * The event passed on a JsDoc newDoclet event
     */
    export interface IJsDocNewDocletEvent {

        /**
         * The processed doclet
         */
        doclet: IDoclet;
    }
    
    /**
     * The event passed on a JsDoc processingComplete event
     */
    export interface IJsDocProcessingCompleteEvent {

        /**
         * The processed doclets
         */
        doclets: IDoclet[];
    }

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

        /**
         * Indicates if this doclet is an enum
         */
        isEnum?: boolean;

        /**
         * If isEnum == true, contains the members of this enum. Note that other libraries may define enums differently (eg. A typedef with members)
         */
        properties?: IDoclet[];
    }

    /**
     * Type name
     */
    export interface IDocletType {
        names: string[];
    }

    /**
     * Type information
     */
    export interface IDocletTypeInfo {
        type: IDocletType;
        description?: string;
    }

    /**
     * Describes a method parameter
     */
    export interface IDocletParameter extends IDocletTypeInfo {

        /**
         * The name of this parameter
         */
        name: string;

        /**
         * Indicates of this parameter is optional. Alias for optional
         */
        nullable?: boolean;

        /**
         * Indicates of this parameter is optional. Alias for nullable
         */
        optional?: boolean;

        /**
         * Indicates if this parameter is a variable argument list
         */
        variable?: boolean;
    }

    /**
     * Describes a tag (annotation)
     */
    export interface IDocletTag {
        originalTitle: string;
        title: string;
        text: string;
        value?: string;
    }
}
