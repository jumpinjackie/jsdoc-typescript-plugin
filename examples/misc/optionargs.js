/**
 * @constructor
 * @classdesc 
 * A class that takes an options argument
 * @param {Object} options Object with the following properties:
 * @param {String} options.url The URL of the service.
 * @param {String} [options.token] The authorization token to use to connect to the service.
 * @param {Object} [options.proxy] A proxy to use for requests. This object is expected to have a getURL function which returns the proxied URL, if needed.
 * @param {String=} options.arg An optional string argument
 */
Optionable = function(options) { };

/**
 * @constructor
 * @classdesc 
 * A class that takes an options argument
 * @param {String} options.url The URL of the service.
 * @param {String} [options.token] The authorization token to use to connect to the service.
 * @param {Object} [options.proxy] A proxy to use for requests. This object is expected to have a getURL function which returns the proxied URL, if needed.
 * @param {String=} options.arg An optional string argument
 */
ImproperlyDocumentedOptionable = function(options) { };

/**
 * @constructor
 * @classdesc 
 * A class that takes an options array argument
 * @param {Object[]} employees - The employees who are responsible for the project.
 * @param {string} employees[].name - The name of an employee.
 * @param {string} employees[].department - The employee's department.
 */
ArrayOptionable = function(employees) {
    // ...
};