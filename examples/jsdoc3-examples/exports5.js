// http://usejsdoc.org/tags-exports.html
//AMD module that exports an object
define(function () {

    /**
     * A module that says hello!
     * @exports hello/world5
     */
    var ns = {};
    
    /** Say hello. */
    ns.sayHello = function() {
        return 'Hello world';
    };

    return ns;
});
