const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const DEBOUNCE_MS = 300;

const STATE = {
	src: { timer: null, running: false, command: 'npm run compile-src' },
	web: { timer: null, running: false, command: 'npm run compile-web' }
};

function log(message) {
	console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function run(name) {
	const state = STATE[name];
	if (state.running) {
		return;
	}
	state.running = true;
	log(`Compiling ${name}...`);
	cp.exec(state.command, (err, stdout, stderr) => {
		state.running = false;
		if (stdout) {
			process.stdout.write(stdout);
		}
		if (stderr) {
			process.stderr.write(stderr);
		}
		if (err) {
			log(`${name} failed.`);
		} else {
			log(`${name} done.`);
		}
	});
}

function schedule(name) {
	const state = STATE[name];
	if (state.timer) {
		clearTimeout(state.timer);
	}
	state.timer = setTimeout(() => {
		state.timer = null;
		run(name);
	}, DEBOUNCE_MS);
}

function isWatchedFile(name, fileName) {
	const ext = path.extname(fileName).toLowerCase();
	if (name === 'src') {
		return ext === '.ts';
	}
	return ext === '.ts' || ext === '.css';
}

function watchDirectory(dir, name) {
	fs.watch(dir, { recursive: true }, (eventType, fileName) => {
		if (!fileName || !isWatchedFile(name, fileName)) {
			return;
		}
		schedule(name);
	});
}

watchDirectory('./src', 'src');
watchDirectory('./web', 'web');

log('Watching ./src and ./web for changes...');

run('src');
run('web');
