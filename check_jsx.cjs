const fs = require('fs');

const content = fs.readFileSync('src/components/admin/IDCardDesigner.jsx', 'utf8');
const lines = content.split('\n');
const startLine = 2176;

let stack = [];
let results = [];

for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];

    // Simplistic regex for tags and fragments
    // Handles <div, </div, <>, </>
    let regex = /<(\/?[a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
        let tag = match[1];
        let isClosing = tag.startsWith('/');
        let isSelfClosing = match[3] === '/' || ['input', 'img', 'br', 'hr', 'canvas'].includes(tag.toLowerCase());

        // React fragments
        if (tag === '') {
            stack.push('FRAGMENT');
            continue;
        }
        if (tag === '/') {
            if (stack.length > 0) {
                stack.pop();
            } else {
                results.push(`Line ${i + 1}: Unexpected closing fragment </>`);
            }
            continue;
        }

        if (!isSelfClosing) {
            if (isClosing) {
                let actualTag = tag.substring(1);
                if (stack.length === 0) {
                    results.push(`Line ${i + 1}: Unexpected closing tag </${actualTag}>`);
                } else {
                    let expected = stack.pop();
                    if (expected !== actualTag) {
                        results.push(`Line ${i + 1}: Mismatch! Expected </${expected}> but found </${actualTag}>`);
                        // Put it back to try to recover? No, just report.
                    }
                }
            } else {
                stack.push(tag);
            }
        }
    }
}

console.log('Final Stack:', stack.join(', '));
if (results.length > 0) {
    console.log('Errors found:');
    results.forEach(res => console.log(res));
}
