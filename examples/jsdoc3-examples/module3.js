// http://usejsdoc.org/tags-module.html
//Defining exported symbols as a member of 'module.exports' or 'exports'

/** @module color/mixer */
module.exports = {
    /** Blend two colours together. */
    blend: function (color1, color2) {}
};
/** Darkens a color. */
exports.darken = function (color, shade) {};
