const fs = require('fs');
const content = fs.readFileSync('src/components/admin/IDCardDesigner.jsx', 'utf8');

const returnStart = content.indexOf('return (');
if (returnStart === -1) {
    console.log("No return ( found");
    process.exit(1);
}

const sub = content.substring(returnStart);
let parenStack = 0;
let returnEnd = 0;
for (let i = 0; i < sub.length; i++) {
    if (sub[i] === '(') parenStack++;
    if (sub[i] === ')') parenStack--;
    if (parenStack === 0 && i > 10) { returnEnd = i; break; }
}

const jsxBlock = sub.substring(0, returnEnd + 1);

// Better tag regex that correctly identifies openers and closers across lines
const tagRegex = /<(\/?[a-zA-Z0-9_\-.]*)(\s*[\s\S]*?)(\/?)>/g;

let stack = [];
let match;
let lastOkPos = 0;

while ((match = tagRegex.exec(jsxBlock)) !== null) {
    let tag = match[1];
    let attributes = match[2];
    let selfClosingChar = match[3];

    // Ignore tags inside JS expressions if possible (simplistic check)
    // Actually, tagRegex should only match valid looking tags

    let isSelfClosing = selfClosingChar === '/' || ['input', 'img', 'br', 'hr', 'canvas'].includes(tag.toLowerCase());

    if (tag === '') { // Opening Fragment <>
        stack.push('FRAGMENT');
    } else if (tag === '/') { // Closing Fragment </>
        if (stack.length === 0) {
            console.log("Unexpected </> at pos", match.index);
        } else {
            stack.pop();
        }
    } else if (tag.startsWith('/')) { // Closing Tag
        let name = tag.substring(1);
        if (stack.length === 0) {
            console.log(`Unexpected </${name}> at pos ${match.index}`);
        } else {
            let last = stack.pop();
            if (last !== name) {
                console.log(`Mismatch! Expected </${last}> but found </${name}> at pos ${match.index}`);
                // Try to recover for reporting other errors
            }
        }
    } else { // Opening Tag
        if (!isSelfClosing) {
            stack.push(tag);
        }
    }
    lastOkPos = match.index;
}

console.log("Final Stack:", stack);
if (stack.length > 0) {
    // Show context around last ok tag
    console.log("Context around end:", jsxBlock.substring(lastOkPos - 100, lastOkPos + 100));
}
