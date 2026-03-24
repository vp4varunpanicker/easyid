const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if(file === 'node_modules') return;
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('.jsx') || file.endsWith('.js')) results.push(file);
        }
    });
    return results;
}
const files = walk('src');
for(let f of files){
    let content = fs.readFileSync(f, 'utf8');
    if(content.includes('default-avatar.svg')){
        content = content.replace(/'\/default-avatar\.svg'/g, "import.meta.env.BASE_URL + 'default-avatar.svg'");
        content = content.replace(/\`\/default-avatar\.svg\`/g, "import.meta.env.BASE_URL + 'default-avatar.svg'");
        fs.writeFileSync(f, content);
        console.log('Fixed', f);
    }
}
