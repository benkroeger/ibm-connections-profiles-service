'use strict';

const path = require('path');
const gulp = require('gulp');
const eslint = require('gulp-eslint');
const excludeGitignore = require('gulp-exclude-gitignore');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const nsp = require('gulp-nsp');
const plumber = require('gulp-plumber');

gulp.task('static', () => gulp.src('**/*.js')
    .pipe(excludeGitignore())
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError()));

gulp.task('nsp', (cb) => {
  nsp({ package: path.resolve('package.json') }, cb);
});

gulp.task('pre-test', () => gulp.src('lib/**/*.js')
    .pipe(istanbul({
      includeUntested: true,
    }))
    .pipe(istanbul.hookRequire()));

gulp.task('test', ['pre-test'], (cb) => {
  let mochaErr;

  gulp.src('test/**/*.js')
    .pipe(plumber())
    .pipe(mocha({ reporter: 'spec' }))
    .on('error', (err) => {
      mochaErr = err;
    })
    .pipe(istanbul.writeReports())
    .on('end', () => {
      cb(mochaErr);
    });
});

gulp.task('prepublish', ['nsp']);
gulp.task('default', ['static', 'test']);
