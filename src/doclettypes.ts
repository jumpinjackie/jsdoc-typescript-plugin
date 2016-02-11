module TsdPlugin {
    /**
     * Constants for different kinds of doclets
     */
    export class DocletKind {
        /**
         * Doclet for a function
         */
        public static get Function(): string { return "function"; }
        /**
         * Doclet for a typedef
         */
        public static get Typedef(): string { return "typedef"; }
        /**
         * Doclet for a class
         */
        public static get Class(): string { return "class"; }
        /**
         * Doclet for a member
         */
        public static get Member(): string { return "member"; }
        /**
         * Doclet for a property
         */
        public static get Value(): string { return "value"; }
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
        nullable?: boolean;
        optional?: boolean;
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