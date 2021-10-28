const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

module.exports = {
	main: () => {
		const questions = [
			{
				name: 'option',
				type: 'list',
				message: 'What would you like to do?',
				choices: ['Copy a game', new inquirer.Separator(), 'List libraries', 'Add library', 'Remove library', 'Exit'],
			},
		];
		return inquirer.prompt(questions);
	},
	select: (libraries) => {
		const questions = [
			{
				name: 'source',
				type: 'list',
				message: 'Which library would you like to copy from?',
				choices: libraries,
			},
			{
				name: 'destination',
				type: 'list',
				message: 'Which library would you like to copy to?',
				choices: libraries,
			},
		];
		return inquirer.prompt(questions);
	},
	selectGame: (games) => {
		const questions = [
			{
				name: 'option',
				type: 'list',
				message: 'Which game would you like to copy?',
				choices: games,
			},
		];
		return inquirer.prompt(questions);
	},
	confirm: (g,s) => {
		const questions = [
			{
				name: 'option',
				type: 'list',
				message: `Are you sure you want to copy: ${g} (${s})?`,
				choices: ['yes', 'no'],
			},
		];
		return inquirer.prompt(questions);
	},
	directory: () => {
		const questions = [
			{
				name: 'path',
				type: 'input',
				message: 'Path to Steam library:',
				validate(value) {
					if (!fs.existsSync(path.resolve(value))) return "Directory doesn't exist";

					if (!fs.existsSync(path.join(path.resolve(value), 'steamapps'))) return 'Unable to find `steamapps` folder in that directory.';

					return true;
				},
			},
		];
		return inquirer.prompt(questions);
	},
	removeLibrary: (libraries) => {
		const questions = [
			{
				name: 'option',
				type: 'list',
				message: 'Which library would you like to remove?',
				choices: libraries,
			},
		];
		return inquirer.prompt(questions);
	},
};
