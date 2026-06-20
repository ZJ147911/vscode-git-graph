const fs = require('fs');
const path = require('path');

const usedKeys = new Set();

function walk(dir, ext, cb) {
	for (const entry of fs.readdirSync(dir)) {
		const full = path.join(dir, entry);
		const st = fs.statSync(full);
		if (st.isDirectory()) walk(full, ext, cb);
		else if (full.endsWith(ext)) cb(full);
	}
}

// Keys referenced in package.json (commands / configurations / etc.)
const pkg = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
let m;
const rePct = /%([a-zA-Z0-9._-]+)%/g;
while ((m = rePct.exec(pkg))) usedKeys.add(m[1]);

// Keys referenced in TypeScript source / webview code
const strRe = /['"`]([a-zA-Z0-9._-]+)['"`]/g;
walk(path.join(__dirname, '..', 'src'), '.ts', (file) => {
	const content = fs.readFileSync(file, 'utf8');
	while ((m = strRe.exec(content))) usedKeys.add(m[1]);
});
walk(path.join(__dirname, '..', 'web'), '.ts', (file) => {
	const content = fs.readFileSync(file, 'utf8');
	while ((m = strRe.exec(content))) usedKeys.add(m[1]);
});

// Keys defined in package.nls.json
const nls = require(path.join(__dirname, '..', 'package.nls.json'));
const unused = Object.keys(nls).filter((key) => !usedKeys.has(key));

if (unused.length > 0) {
	console.error('Unused NLS keys in package.nls.json:');
	unused.forEach((key) => console.error('  ' + key));
	process.exit(1);
}

console.log('No unused NLS keys found.');
