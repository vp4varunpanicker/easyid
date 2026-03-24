const fs = require('fs');
const content = fs.readFileSync('src/components/admin/IDCardDesigner.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let returnActive = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('return (')) {
        returnActive = true;
        console.log(`--- START OF RETURN AT LINE ${i + 1} ---`);
    }
    if (!returnActive) continue;

    // Match <Tag, </Tag, <>, </>
    // Regex explanation:
    // < : opening bracket
    // (\/?[a-zA-Z0-9_\-.]*) : group 1: optional / followed by tag name (or empty for фрагмент)
    // (\s*[^>]*?) : group 2: attributes (ignored)
    // (\/?) : group 3: optional / for self-closing
    // > : closing bracket
    let regex = /<(\/?[a-zA-Z0-9_\-.]*)(\s*[^>]*?)(\/?)>/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        let tag = match[1];
        let selfClosingChar = match[3];

        if (tag === '') { // Opening Fragment <>
            stack.push('FRAGMENT');
            // console.log(`[${i+1}] OPEN  <> | Stack: ${stack.join(' > ')}`);
        } else if (tag === '/') { // Closing Fragment </>
            if (stack.length === 0) {
                console.log(`[${i + 1}] ERROR Unexpected </>`);
            } else {
                let last = stack.pop();
                if (last !== 'FRAGMENT') {
                    console.log(`[${i + 1}] MISMATCH! Expected </${last}> but found </>`);
                }
            }
        } else if (tag.startsWith('/')) { // Closing Tag </Tag>
            let tagName = tag.substring(1);
            if (stack.length === 0) {
                console.log(`[${i + 1}] ERROR Unexpected </${tagName}>`);
            } else {
                let last = stack.pop();
                if (last !== tagName) {
                    console.log(`[${i + 1}] MISMATCH! Expected </${last}> but found </${tagName}>`);
                }
            }
        } else { // Opening Tag <Tag>
            let isSelfClosing = selfClosingChar === '/' || ['input', 'img', 'br', 'hr', 'canvas'].includes(tag.toLowerCase());
            if (!isSelfClosing) {
                stack.push(tag);
            }
        }
    }
    if (line.includes(');')) {
        console.log(`--- END OF RETURN AT LINE ${i + 1}. Remaining Stack: ${stack.join(', ')} ---`);
        // returnActive = false; // Don't stop, might be other returns (unlikely but safe)
    }
}
