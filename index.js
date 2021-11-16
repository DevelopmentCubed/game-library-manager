const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const fs = require('fs');
const Conf = require('conf');
const acfParser = require('steam-acf2json');
const path = require('path');
const numeral = require('numeral');
const Progress = require('progress');

const questions = require('./lib/questions');
const config = new Conf({
	schema: {
		libraries: {
			type: 'array',
			items: {
				type: 'string',
			},
		},
	},
});

if (!config.get('libraries')) config.set('libraries', []);

async function mainMenu(doClear = false) {
	if (doClear) {
		clear();
		console.log(chalk.blueBright(figlet.textSync('GLM', { horizontalLayout: 'full' })));
	}

	const option = await questions.main();

	switch (option.option) {
		case 'Copy a game': {
			const libraries = config.get('libraries');
			if (!libraries.length) {
				console.log(`${chalk.redBright('X')} There are no libraries setup. Set one up and try again.\n`);
				return mainMenu();
			}

			if (libraries.length < 2) {
				console.log(`${chalk.redBright('X')} You need at least 2 libraries setup.\n`);
				return mainMenu();
			}

			const paths = await questions.select(libraries);

			if (paths.source === paths.destination) {
				console.log(`${chalk.redBright('X')} Source and destination can't be the same library.\n`);
				return mainMenu();
			}

			const sourceFiles = fs.readdirSync(path.join(paths.source, 'steamapps'));

			const acfs = [];
			const acfRegex = /appmanifest_\d+\.acf/g;
			for (const file of sourceFiles) {
				try {
					if (!file.match(acfRegex)?.length) continue;
					const acf = acfParser.decode(fs.readFileSync(path.join(paths.source, 'steamapps', file), 'utf-8'));
					acfs.push({
						file,
						name: acf.AppState.name,
						dir: acf.AppState.installdir,
					});
				} catch (_) {}
			}

			const gameQuestion = await questions.selectGame(acfs.map((a) => a.name).sort());
			const [game] = acfs.filter((a) => a.name === gameQuestion.option);

			let gameFiles = 0;
			let gameSize = 0;
			let copySize = 0;

			function exploreDirectory(base, directory, destination) {
				const files = fs.readdirSync(path.join(base, directory));
				const tree = {};

				for (const file of files) {
					const filePath = path.join(base, directory, file);
					const destPath = path.join(destination, file);
					const stat = fs.statSync(filePath);
					if (stat.isDirectory()) {
						tree[file] = {
							type: 'dir',
							source: filePath,
							destination: destPath,
							files: exploreDirectory(path.join(base, directory), file, destPath),
						};
					} else {
						gameSize += stat.size;
						if (fs.existsSync(destPath)) {
							const dest = fs.statSync(destPath);
							if (stat.size === dest.size) continue;
						}
						copySize += stat.size;
						gameFiles++;
						tree[file] = {
							type: 'file',
							source: filePath,
							destination: destPath,
							size: stat.size,
						};
					}
				}

				return tree;
			}

			let filesCopied = 0;

			function exploreTree(object) {
				return new Promise(async (resolve) => {
					for (const key in object) {
						const prop = object[key];
						const exists = fs.existsSync(prop.destination);
						if (prop.type === 'dir') {
							if (!exists) {
								fs.mkdirSync(prop.destination);
							}
							await exploreTree(prop.files);
						} else {
							filesCopied++;
							if (exists) {
								const stat = fs.statSync(prop.destination);
								if (stat.size === prop.size) continue;
							}
							await CopyFile(prop);
						}
					}

					resolve(true);
				});
			}

			const destinationBase = path.join(paths.destination, 'steamapps', 'common', game.dir);

			const tree = exploreDirectory(path.join(paths.source, 'steamapps', 'common'), game.dir, destinationBase);

			const progress = new Progress(`[:bar] :percent - :rate MB/s - ETA :etas - :pos :size :file`, {
				complete: chalk.greenBright('='),
				incomplete: ' ',
				width: 20,
				total: copySize / 1024 / 1024,
				clear: true,
			});

			function CopyFile(file) {
				const size = numeral(file.size).format('0,0.00b');
				const name = file.destination.split(/\\|\//g).pop();
				return new Promise((resolve) => {
					const readStream = fs.createReadStream(file.source);
					const writeStream = fs.createWriteStream(file.destination);

					readStream.on('data', function (buffer) {
						progress.tick(buffer.length / 1024 / 1024, {
							pos: `${filesCopied}/${gameFiles}`,
							file: name,
							size,
						});
					});

					readStream.on('end', function () {
						resolve(true);
					});

					readStream.pipe(writeStream);

					readStream.on('error', (error) => {
						console.error(error);
						process.exit(1);
					});

					writeStream.on('error', (error) => {
						console.error(error);
						process.exit(1);
					});
				});
			}

			const confirm = await questions.confirm(game.name, numeral(gameSize).format('0,0.00b'));

			if (confirm.option === 'no') {
				return mainMenu();
			}

			if (!fs.existsSync(destinationBase)) fs.mkdirSync(destinationBase);

			tree[game.file] = {
				type: 'file',
				source: path.join(paths.source, 'steamapps', game.file),
				destination: path.join(paths.destination, 'steamapps', game.file),
				size: 0,
			};
			await exploreTree(tree);
			progress.update(1);

			console.log(chalk.greenBright(`Finished copying ${game.name}`));
			mainMenu();
			break;
		}
		case 'List libraries': {
			const libraries = config.get('libraries');
			console.log(libraries.map((l, i) => `${chalk.blueBright(`${i + 1}.`)} ${l}`).join('\n'));
			mainMenu();
			break;
		}
		case 'Add library': {
			const dir = await questions.directory();
			const libraries = config.get('libraries');
			if (!libraries.includes(dir.path)) {
				libraries.push(dir.path);
				if (!fs.existsSync(path.join(dir.path, 'steamapps', 'common'))) fs.mkdirSync(path.join(dir.path, 'steamapps', 'common'));
			}
			config.set('libraries', libraries);
			mainMenu();
			break;
		}
		case 'Remove library': {
			const libraries = config.get('libraries');
			if (!libraries.length) {
				console.log(`${chalk.redBright('X')} There are no libraries setup. Set one up and try again.\n`);
				return mainMenu();
			}
			const library = await questions.removeLibrary(libraries);
			libraries.splice(libraries.indexOf(library.option), 1);
			config.set('libraries', libraries);
			mainMenu();
			break;
		}
		case 'Exit': {
			break;
		}
		default:
			mainMenu();
	}
}

mainMenu(true);
