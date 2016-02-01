// http://usejsdoc.org/tags-lends.html
//Documented as static methods

/** @class */
var Lends2Person = makeClass(
    /** @lends Lends2Person */
    {
        initialize: function(name) {
            this.name = name;
        },
        say: function(message) {
            return this.name + " says: " + message;
        }
    }
);
