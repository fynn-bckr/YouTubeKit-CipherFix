/*import { Innertube } from 'youtubei.js';

import fs from 'fs';
import https from 'https';

const yt = await Innertube.create();

const videoId = '2lAe1cqCOXo'; // Replace this with any video ID
const info = await yt.getInfo(videoId);

// Filter for .mp4 video+audio streams
const formats = info.streaming_data.formats.filter(f =>
  f.mime_type.includes('video/mp4')
);

const best = formats[0];

if (!best?.url) {
  console.log('No downloadable MP4 format found.');
  process.exit(1);
}

console.log(best.url)

// Stream video to file
const file = fs.createWriteStream(`${videoId}.mp4`);
https.get(best.url, {
}, res => {
  console.log('HTTP Status:', res.statusCode);
  res.pipe(file);
});*/

/*import fs from 'fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const code = fs.readFileSync('./yt-player.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 'latest' });

const candidateFns = [];

walk.simple(ast, {
  FunctionDeclaration(node) {
    const src = code.slice(node.start, node.end);
    if (src.includes('[4]') && src.includes('[13]') && src.includes('[27]')) {
      candidateFns.push(src);
    }
  },
  FunctionExpression(node) {
    const src = code.slice(node.start, node.end);
    if (src.includes('[4]') && src.includes('[13]') && src.includes('[27]')) {
      candidateFns.push(src);
    }
  },
});

console.log('\n🎯 Found possible signature functions:\n');
candidateFns.forEach((fn, i) => {
  console.log(`\n=== Function ${i + 1} ===\n`);
  console.log(fn.slice(0, 5000)); // Print only first 1000 chars for readability
});*/

// analyze-player.js

import fs from 'fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// Read player.js file
const code = fs.readFileSync("yt-player.js", "utf-8");
const ast = acorn.parse(code, { ecmaVersion: "latest" });

// Step 1: Extract the obfuscation array string
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
  //const [, varName, rawString] = match;
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

// Utility: Resolve a[NN] to actual string
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

// Step 2: Find candidate functions
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

// Step 3: Print results
if (candidates.length === 0) {
  console.log("No decipher-like functions found.");
} else {
  //console.log(`\nFound ${candidates.length} candidate function(s).\n`);
  const sorted_candidates = candidates.sort((a, b) => b.usedOps.length - a.usedOps.length);

  const most_likely_function = sorted_candidates[0]
  console.log(code.slice(most_likely_function.node.start, most_likely_function.node.end))
}


