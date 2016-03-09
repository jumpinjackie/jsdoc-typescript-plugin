/**
 * @constructor
 */
SomeType = function() { };

/**
 * @constructor
 */
SomeOtherType = function() { };

/**
 * @constructor
 * @classdesc 
 * A generic class
 * @template T
 */
Foo = function() { };

/**
 * @description A generic method
 * @template TArg
 * @param {TArg} arg An argument of a generic type
 * @return {string} A string value
 */
Foo.prototype.bar = function(arg) { return "foo"; };

/**
 * @description Another generic method
 * @template TArg
 * @param {T} arg The class generic type
 * @param {TArg} arg2 An argument of a generic type
 * @return {string} A string value
 */
Foo.prototype.setBar = function(arg, arg2) { };

/**
 * @description Yet another generic method
 * @return {T} THe class generic type
 */
Foo.prototype.getBar = function() { return null; };

/**
 * @return {Foo.<SomeType|SomeOtherType>}
 */
function returnFoo() {
    return null;
}

/**
 * @return {Foo.<SomeType[]>}
 */
function returnFoo2() {
    return null;
}