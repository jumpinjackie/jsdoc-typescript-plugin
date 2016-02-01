//http://usejsdoc.org/howto-commonjs-modules.html
//Document a Function that returns a RequireJS Module
//The RequireJS library provides a define method that allows you to write a function to return a module object. Use the @exports tag to document that all the members of an object literal should be documented as members of a module.
//The color property and the Turtleneck class are documented as members of the "my/shirt" module.
define('my/shirt', function () {
   /** 
    * A module representing a shirt.
    * @exports my/shirt
    * @version 1.0
    */
    var shirt = {
    
        /** A property of the module. */
        color: "black",
        
        /** @constructor */
        Turtleneck: function(size) {
            /** A property of the class. */
            this.size = size;
        }
    };

    return shirt;
});
