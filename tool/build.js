#!/usr/bin/env node

const showdown = require('showdown');
const fs = require('fs');

const readme = fs.readFileSync('README.md','utf-8');
const template = fs.readFileSync('tool/template.html','utf-8');

const converter = new showdown.Converter();


fs.writeFileSync('index.html',
	template.replace('{{content}}',converter.makeHtml(readme))
);
