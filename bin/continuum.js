#!/usr/bin/env node

var fs = require('fs'),
    inspect = require('util').inspect,
    continuum = require('../engine'),
    args = process.argv.slice(2);

if (!args.length) {
  console.log('Executing Code:');
  console.log('  contiuum <file1.js> <file2.js> ...');
  console.log('  contiuum <code>');
  console.log('Creating Bytecode:');
  console.log('  contiuum -b <file1.js> <file2.js> ...');
  console.log('  contiuum -b <code>');
  process.exit(1);
}

function log(o){
  if (o !== undefined) {
    console.log(inspect(o, null, 10));
    console.log('');
  }
}

var bytecode = false,
    execute = true;

var flags = {
  b: function(){
    bytecode = true;
    execute = false;
  }
};

var scripts = args.filter(function(arg){
  if (arg[0] === '-' && arg[1] in flags) {
    flags[arg[1]]();
  } else {
    return true;
  }
}).map(function(arg){
  if (~arg.indexOf('\n') || !fs.existsSync(arg)) {
    return arg.replace(/\\n/g, '\n').replace(/\\\n/g, '\\n');;
  } else {
    return fs.readFileSync(arg, 'utf-8');
  }
});

if (execute) {
  var realm = continuum.createRealm();
  realm.on('throw', log);
  realm.on('write', log);
  realm.on('inspect', log);
  scripts.forEach(function(script){
    realm.evaluateAsync(script, log);
  });
} else if (bytecode) {
  scripts.forEach(function(script){
    log(continuum.createCode(script));
    console.log('');
  });
}
