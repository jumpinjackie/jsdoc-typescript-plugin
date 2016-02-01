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

/**
 * JS -> TypeScript type aliases. Any such types encountered in the JSDoc
 * annotations will be replaced with the specified replacement here
 */
var TS_ALIASES = {
    "Object": "any",
    "function": "Function"
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

function ensureClassDef(classes, longname, bCreateIfNotExists) {
    var clsDef = null;
    if (!classes.hasOwnProperty(longname) && !!bCreateIfNotExists) {
        clsDef = {
            name: null,
            fullname: longname,
            ctor: null,
            extends: null,
            description: null,
            methods: [],
            properties: [],
            docletRef: null,
            parentModule: null
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
        //If we have args, document them. Becuase TypeScript is ... typed, the {type}
        //annotation is not necessary
        if (sig != null && sig.length > 0) {
            for (var i = 0; i < sig.length; i++) {
            var arg = sig[i];
            content += indent() + " * @param " + arg.name + " " + (arg.description || "") + "\n";
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
    content += ");\n";
    return content; 
}

function outputClass(cls) {
    if (cls == null)
        return "";
    if (cls.name == null)
        return "";
    
    //Case not handled. Class with ':' in its name
    if (cls.name.indexOf(":") >= 0)
        return indent() + "//Skipped class (" + cls.name + "). Case not handled yet: ':' in class name\n";
        
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
        content += outputSignature(method.name, method.description, method.signature);
    }
    indentLevel--; //End class members
    
    content += indent() + "}\n";
    return content;
}

function moduleDecl(name) {
    return "declare module \"" + name + "\"";
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
    
    //1st pass: Process classes
    for (var i = 0; i < doclets.length; i++) {
        var doclet = doclets[i];
        if (doclet.kind == "class") {
            var parentModName = null;
            if (doclet.longname.indexOf("module:") >= 0) {
                //Assuming that anything annotated "module:" will have a "." to denote end of module and start of class name
                var modLen = "module:".length;
                var dotIdx = doclet.longname.indexOf(".");
                if (dotIdx < 0)
                    dotIdx = doclet.longname.length;
                parentModName = doclet.longname.substring(modLen, dotIdx);
            }
            
            //Key class definition on longname
            var cls = ensureClassDef(classes, doclet.longname, true);
            cls.docletRef = doclet;
            cls.name = doclet.name;
            if (doclet.params) {
                cls.ctor = {
                    description: null,
                    signature: doclet.params
                };
            }
            if (parentModName != null)
                cls.parentModule = parentModName;
            if (doclet.description)
                cls.description = doclet.description;
        }
    }
    //2nd pass: Look for members
    for (var i = 0; i < doclets.length; i++) {
        var doclet = doclets[i];
        if (!doclet.memberof)
            continue;
        
        //We've keyed class definition on longname, so memberof should
        //point to it
        var cls = ensureClassDef(classes, doclet.memberof);
        if (!cls) {
            continue;
        }
        
        if (doclet.kind == "member") {
            cls.properties.push({
                name: doclet.name,
                description: doclet.description,
                docletRef: doclet
            });
        } else if (doclet.kind == "function") {
            cls.methods.push({
                name: doclet.name,
                description: doclet.description,
                signature: doclet.params,
                docletRef: doclet
            });
        }
    }
    
    for (var qClsName in classes) {
        var cls = classes[qClsName];
        //Begin module
        content += "\n" + moduleDecl(cls.parentModule || moduleName) + " {\n";
        indentLevel++;
        content += "\n" + indent() + "// ================= " + qClsName;
        content += "\n";
        content += outputClass(cls);
        indentLevel--;
        content += "}\n"; //End module
    }
    
    /*
    for (var i = 0; i < doclets.length; i++) {
        content += "\n" + JSON.stringify(doclets[i], JsDocletStringifyFilter, 4);
    }
    */
    
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