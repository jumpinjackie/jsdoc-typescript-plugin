/// <reference path="../typings/tsd.d.ts" />
/**
 * @overview Generates a TypeScript definition file from assembled JSDoc doclets
 * @module plugins/typescript
 * @author Jackie Ng <jumpinjackie@gmail.com>
 */
'use strict';

var CLS_DESC_PLACEHOLDER = "%TYPENAME%";

var fs = require('fs');
var env = require('jsdoc/env');
var config = env.conf.typescript || {};
var moduleName = env.conf.typescript.rootModuleName || "generated";
var outDir = env.conf.typescript.outDir || ".";
var defaultCtorDesc = env.conf.typescript.defaultCtorDesc || ("Constructor for " + CLS_DESC_PLACEHOLDER);
var fileName = outDir + "/" + moduleName + ".d.ts";
var indentLevel = 0;

var TS_ALIASES = {
    "Object": "any",
    "Function": "() => any"
};

function JsDocletStringifyFilter(key, value) { 
    if (key === "comment") { 
        return undefined; 
    }
    if (key == "meta") {
        return undefined;
    }
    return value; 
}

function str_repeat(pattern, count) {
    if (count < 1) return '';
    var result = '';
    while (count > 1) {
        if (count & 1) result += pattern;
        count >>= 1, pattern += pattern;
    }
    return result + pattern;
}

function indent() {
    return str_repeat(" ", indentLevel * 4);
}

function ensureClassDef(classes, longname) {
    var clsDef = null;
    if (!classes.hasOwnProperty(longname)) {
        clsDef = {
            name: null,
            fullname: longname,
            ctor: null,
            extends: null,
            description: null,
            methods: [],
            properties: [],
            docletRef: null
        };
        classes[longname] = clsDef; 
    } else {
        clsDef = classes[longname];
    }
    return clsDef;
}

function outputSignature(name, desc, sig) {
    var content = "";
    if (desc != null) {
        var descParts = desc.split("\n");
        content += indent() + "/**\n";
        for (var i = 0; i < descParts.length; i++) {
            content += indent() + " * " + descParts[i] + "\n";
        }
        //If we have args, document them
        if (sig != null && sig.length > 0) {
            for (var i = 0; i < sig.length; i++) {
            var arg = sig[i];
            content += indent() + " * @param " + arg.name + " " + arg.description + "\n";
            }
        }
        content += indent() + " */\n"
    }
    content += indent() + name + "(";
    //Output args
    if (sig != null && sig.length > 0) {
        for (var i = 0; i < sig.length; i++) {
            var arg = sig[i];
            if (i > 0) {
                content += ", ";
            }
            content += arg.name + ": ";
            if (arg.type != null) {
                //Output as TS union type
                var utypes = [];
                if (arg.type.names.length > 0) {
                    for (var j = 0; j < arg.type.names.length; j++) {
                        var typeName = arg.type.names[j];
                        if (TS_ALIASES.hasOwnProperty(typeName)) {
                            utypes.push(TS_ALIASES[typeName]);
                        } else {
                            utypes.push(typeName);
                        }
                    }
                }
                content += utypes.join("|");
            } else {
                //Fallback to any
                content += "any";
            }
        }
    }
    content += ")\n";
    return content; 
}

function outputClass(cls) {
    //Case not handled. Class with ':' in its name
    if (cls.name.indexOf(":") >= 0)
        return indent() + "//Skipped class (" + cls.name + "). Case not handled yet: ':' in class name";
        
    var content = ""; 
    
    if (cls.docletRef != null) {
        content += "/* doclet for class\n";
        content += JSON.stringify(cls.docletRef, JsDocletStringifyFilter, 4);
        content += "\n */\n";
    }
    
    if (cls.description != null) {
        content += indent() + "/**\n";
        var descParts = cls.description.split("\n");
        for (var i = 0; i < descParts.length; i++) {
            content += indent() + " * " + descParts[i] + "\n";
        }
        content += indent() + " */\n";
    }
    content += indent() + "export class " + cls.name;
    if (cls.extends != null) {
        content += " extends " + cls.extends.fullname;
    }
    content += " {\n";
    
    indentLevel++; //Start class members
    if (cls.ctor != null) {
        content += outputSignature("constructor", (cls.ctor.description || defaultCtorDesc.replace(CLS_DESC_PLACEHOLDER, cls.name)), cls.ctor.signature);
    }
    if (cls.methods.length > 0) {
        content += indent() + "//Methods\n\n";
    }
    for (var i = 0; i < cls.methods.length; i++) {
        var method = cls.methods[i];
        content += outputSignature(method.name, method.signature, method.description);
    }
    indentLevel--; //End class members
    
    content += indent() + "}\n";
    return content;
}

function process(doclets) {
    
    var classes = {};
    var functions = {};
    
    var content = "/**";
    content += "\n * " + fileName
    content += "\n * ";
    content += "\n * This file was automatically generated by the typescript JSDoc plugin";
    content += "\n * Do not edit this file unless you know what you're doing";
    content += "\n */"
    
    var modName = "\"" + moduleName + "\"";
    
    //Begin module
    content += "\ndeclare module " + modName + " {\n";
    
    //Process classes
    for (var i = 0; i < doclets.length; i++) {
        var doclet = doclets[i];
        if (doclet.kind == "class") {
            //Key class definition on longname
            var cls = ensureClassDef(classes, doclet.longname);
            cls.docletRef = doclet;
            cls.name = doclet.name;
            if (doclet.params) {
                cls.ctor = {
                    description: null,
                    signature: doclet.params
                };
            }
            if (doclet.description)
                cls.description = doclet.description;
        }
    }
    
    indentLevel++;
    for (var qClsName in classes) {
        content += "\n" + indent() + "// ================= " + qClsName;
        content += "\n";
        content += outputClass(classes[qClsName]);
    }
    indentLevel--;
    
    content += "}\n"; //End module
    
    fs.writeFile(fileName, content, function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log("Saved TypeScript definition file to: " + fileName);
        }
    });
}

exports.handlers = {
    processingComplete: function(e) {
        process(e.doclets);
    }
};