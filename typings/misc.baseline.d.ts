/**
 */
declare function returnFoo(): Foo<SomeType|SomeOtherType>;
/**
 */
declare function returnFoo2(): Foo<Array<SomeType>>;
/**
 * @param value  (Optional) Somebody's name
 */
declare function optionalFunc(value?: string): any;
/**
 * @param value  (Optional) Somebody's name
 */
declare function optionalFunc2(value?: string): any;
/**
 * @param value  (Optional) Somebody's name
 */
declare function defaultArgFunc(value?: string): any;
/**
 * @param value  (Required) A series of numbers
 */
declare function varArgsFunc(...value: number[]): any;
declare class SomeType {
}
declare class SomeOtherType {
}
/**
 * A generic class
 */
declare class Foo<T> {
    /**
     * A generic method
     * @param arg  (Required) An argument of a generic type
     */
    bar<TArg>(arg: TArg): string;
    /**
     * Another generic method
     * @param arg  (Required) The class generic type
     * @param arg2  (Required) An argument of a generic type
     */
    setBar<TArg>(arg: T, arg2: TArg): string;
    /**
     * Yet another generic method
     */
    getBar(): T;
}
/**
 * A class that takes an options argument
 */
declare class Optionable {
    /**
     * @param options  (Required) Object with the following properties:
     */
    constructor(options: IOptionableOptions);
}
/**
 * A class that takes an options argument
 */
declare class ImproperlyDocumentedOptionable {
    /**
     * @param options  (Required) An object with the following properties
     */
    constructor(options: IImproperlyDocumentedOptionableOptions);
}
/**
 * A class that takes an options array argument
 */
declare class ArrayOptionable {
    /**
     * @param employees  (Required) The employees who are responsible for the project.
     */
    constructor(employees: IArrayOptionableOptions[]);
}
declare class ClassWithOptionProperty {
    /**
     */
    constructor();
    /**
     * Name
     */
    name: String;
    /**
     * Foo
     */
    foo: IClassWithOptionPropertyOptions;
}
interface IOptionableOptions {
    /**
     * The URL of the service.
     */
    url: String;
    /**
     * The authorization token to use to connect to the service.
     */
    token?: String;
    /**
     * A proxy to use for requests. This object is expected to have a getURL function which returns the proxied URL, if needed.
     */
    proxy?: any;
    /**
     * An optional string argument
     */
    arg?: String;
}
interface IImproperlyDocumentedOptionableOptions {
    /**
     * The URL of the service.
     */
    url: String;
    /**
     * The authorization token to use to connect to the service.
     */
    token?: String;
    /**
     * A proxy to use for requests. This object is expected to have a getURL function which returns the proxied URL, if needed.
     */
    proxy?: any;
    /**
     * An optional string argument
     */
    arg?: String;
}
interface IArrayOptionableOptions {
    /**
     * The name of an employee.
     */
    name: string;
    /**
     * The employee's department.
     */
    department: string;
}
interface IClassWithOptionPropertyOptions {
    /**
     * Bar of Foo
     */
    bar: string;
    /**
     * Foo of Foo
     */
    foo: number;
}
declare module olx {
    module foo {
        interface Bar {
            /**
             */
            a: string;
            /**
             */
            b: number;
        }
    }
}
declare module coolmodule {
    interface ICoolmoduleDoFooOptions {
        /**
         * The ID
         */
        id: string;
    }
    /**
     * Lorem ipsum
     * @param params  (Required) Blub
     */
    function doFoo(params: coolmodule.ICoolmoduleDoFooOptions): any;
}
