// http://usejsdoc.org/tags-exports.html
//AMD module that exports an object literal
define(function() {

    /**
     * A module that whispers hello!
     * @module hello/world3
     */
    var exports = {};
    
    /** say hello. */
    exports.sayHello = function() {
        return 'hello world';
    };

    return exports;
});
