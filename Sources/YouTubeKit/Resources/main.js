import fs from 'fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// Read player.js file
const code = fs.readFileSync("yt-player.js", "utf-8");
const ast = acorn.parse(code, { ecmaVersion: "latest" });

Extract the obfuscation array string
const aArray = (() => {
  // match var{space}{any chars}={any string}.split({any string})
  const match = code.match(/var\s[a-zA-Z]+=.+\.split\("."\)/);
  if (!match) {
    console.error("Obfuscation array not found.");
    process.exit(1);
  }
  //console.log("Found " + match)
  //const varName = match.slice(4).split("=", 2)[0]
  //const rawString = match.split(".split(\"")[0]

  //console.log("Found global var name of: " + varName)
  //console.log("Found raw string of: " + rawString)
  const smallAST = acorn.parse(match, { ecmaVersion: 2020 });
  let result = null;

  walk.simple(smallAST, {
    VariableDeclarator(node) {
      if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee &&
          node.init.callee.type === 'MemberExpression' &&
          node.init.callee.property.name === 'split' &&
          node.init.callee.object.type === 'Literal'
      ) {
        result = {
          varName: node.id.name,
          rawValue: node.init.callee.object.value
        };
      }
    }
  });

  console.log(result);
  return { name: result.varName, values: result.rawValue.split("}") };
})();

function resolveA(node) {
  if (
      node.type === "MemberExpression" &&
      node.object.name === aArray.name &&
      node.property.type === "Literal"
  ) {
    const index = node.property.value;
    return aArray.values[index];
  }
  return null;
}

// Heuristic keywords
const interestingOps = new Set(["split", "join", "reverse", "splice", "slice", "push", "pop", "unshift"]);

const candidates = [];

walk.simple(ast, {
  FunctionExpression(node) {
    if (node.end - node.start > 10000) return

    const usedOps = new Set();
    walk.simple(node.body, {
      MemberExpression(inner) {
        const op = resolveA(inner);
        if (interestingOps.has(op)) usedOps.add(op);
      },
    });

    if (usedOps.size >= 2) {
      candidates.push({ node, usedOps: Array.from(usedOps) });
    }
  },
});

if (candidates.length === 0) {
  console.log("No decipher-like functions found.");
} else {
  //console.log(`\nFound ${candidates.length} candidate function(s).\n`);
  const sorted_candidates = candidates.sort((a, b) => b.usedOps.length - a.usedOps.length);

  const most_likely_function = sorted_candidates[0]
  console.log(code.slice(most_likely_function.node.start, most_likely_function.node.end))
}


