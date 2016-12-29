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
    	if (name === "Array") {
          return {
              kind: "array",
              type: params[0]
          } 	
        } else {
          return {
              kind: "generic",
              name: name,
              types: params
          }
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
	= name:Ident {
    	if (name === "Array") {
          return {
              kind: "array",
              type: {kind: "simple", name:"*"}
          } 	
        } else {
          return {
              kind: "simple",
              name: name
          };
        }
    }

ArrayType
    = type:NonArrayType arr:"[]"+ {
        return arr.reduce((previousValue) => {
          let obj = { 
            kind: "array", 
            type: previousValue !== null ? previousValue : type
          }; 
          return obj;
        }, null);
    }

Ident
  = "*"
  / [\\.a-zA-Z0-9$_-]* {
    let txt = text();
    if (txt.endsWith(".")) {return txt.slice(0,-1);}
    return txt;
  }

_ "whitespace"
  = [ \t\n\r]*