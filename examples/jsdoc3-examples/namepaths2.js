//http://usejsdoc.org/about-namepaths.html
//Use a documentation tag to describe your code.
/** @constructor */
namepath2Person = function() {
    /** @constructor */
    this.Idea = function() {
        this.consider = function(){
            return "hmmm";
        }
    }
}

var p = new namepath2Person();
var i = new p.Idea();
i.consider();
