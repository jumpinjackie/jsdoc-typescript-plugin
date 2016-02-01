//http://usejsdoc.org/about-namepaths.html
//Use a documentation tag to describe your code.
/** @constructor */
namepath1Person = function() {
    this.say = function() {
        return "I'm an instance.";
    }
    
    function say() {
        return "I'm inner.";
    }
}
namepath1Person.say = function() {
    return "I'm static.";
}

var p = new namepath1Person();
p.say();      // I'm an instance.
namepath1Person.say(); // I'm static.
// there is no way to directly access the inner function from here
