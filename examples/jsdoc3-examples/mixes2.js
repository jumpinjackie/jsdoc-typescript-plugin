// http://usejsdoc.org/tags-mixes.html
//Using the @mixes tag

/**
 * @constructor Mixes2FormButton
 * @mixes Mixes1Eventful
 */
var Mixes2FormButton = function() {
    // code...
};
Mixes2FormButton.prototype.press = function() {
  this.fire('press', {});
}
mix(Mixes1Eventful).into(Mixes2FormButton.prototype);
