// http://usejsdoc.org/tags-lends.html
//Example class

// We want to document this as being a class
var Lends1Person = makeClass(
    // We want to document these as being methods
    {
        initialize: function(name) {
            this.name = name;
        },
        say: function(message) {
            return this.name + " says: " + message;
        }
    }
);
