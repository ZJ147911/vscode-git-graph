const fs = require('fs');
const path = require('path');

const MEDIA_DIRECTORY = path.join(__dirname, '..', 'media');
const NLS_PATH = path.join(__dirname, '..', 'package.nls.json');
const OUTPUT_PATH = path.join(MEDIA_DIRECTORY, 'i18n-defaults.js');

const packageNls = require(NLS_PATH);
const defaults = {};
for (const [key, value] of Object.entries(packageNls)) {
	if (key.startsWith('ui.') || key.startsWith('git.')) {
		defaults[key] = value;
	}
}

if (!fs.existsSync(MEDIA_DIRECTORY)) {
	fs.mkdirSync(MEDIA_DIRECTORY, { recursive: true });
}
fs.writeFileSync(OUTPUT_PATH, 'setI18nTexts(' + JSON.stringify(defaults) + ');\r\n');
console.log('Generated ' + OUTPUT_PATH + ' with ' + Object.keys(defaults).length + ' keys.');
