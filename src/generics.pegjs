Type 
    = GenericType
    / UnionType
    / ArrayType
    / SimpleType

NonUnionType
    = GenericType
    / ArrayType
    / SimpleType

NonArrayType
    = GenericType
    / "(" _ type:UnionType ")" {
        return type;
    }
    / SimpleType

UnionType
    = "("? first:NonUnionType _ rest:UnionTypeRest+ ")"? {
        return {
            kind: "union",
            types: [first].concat(rest)
        };
    }

UnionTypeRest
    = "|" _ type:NonUnionType {
        return type;
    }

GenericType
    = name:Ident "."? "<" _ params:GenericTypeParams _ ">" {
        return {
            kind: "generic",
            name: name,
            types: params
        }
    }

GenericTypeParams
    = first:Type? _ rest:GenericTypeParamsRest* {
        return first ? [first].concat(rest) : rest;
    }

GenericTypeParamsRest
    = "," _ type:Type {
        return type;
    }

SimpleType
	= "Array" (!Ident) { 
    	 //special handling of untyped array
    	return {
            kind: "generic",
            name: "Array",
            types: [{kind: "simple", name:"*"}]
        }
    }
    / name:Ident {
        return {
            kind: "simple",
            name: text()
        };
    }

ArrayType
	= type:NonArrayType "[]" {
        return {
            kind: "generic",
            name: "Array",
            types: [type]
        }
    }
    
Ident
  = [a-zA-Z$_-] [a-zA-Z0-9$_-]* {
    return text();
  }

_ "whitespace"
  = [ \t\n\r]*