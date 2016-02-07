module TsdPlugin {
    /**
     * Constants for different kinds of doclets
     */
    export class DocletKind {
        /**
         * Doclet for a function
         */
        public static get function(): string { return "function"; }
        /**
         * Doclet for a typedef
         */
        public static get typedef(): string { return "typedef"; }
        /**
         * Doclet for a class
         */
        public static get class(): string { return "class"; }
        /**
         * Doclet for a member
         */
        public static get member(): string { return "member"; }
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
        description: string;
    }

    /**
     * Describes a method parameter
     */
    export interface IDocletParameter extends IDocletTypeInfo {
        name: string;
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