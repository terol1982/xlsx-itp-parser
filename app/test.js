// parser.js
'use strict';



var express = require('express'),
    path = require('path'),
    fs = require('fs'),
    formidable = require('formidable'),
    readChunk = require('read-chunk'),
    fileType = require('file-type'),
    XLSX = require('xlsx'),
    bodyParser = require("body-parser"),
    formidableMiddleware = require('express-formidable');



let search='системный блок'
let regEx=new RegExp(search/*.replace(' ', '.+')*/, 'i')
console.log(regEx)

let str='string of words: Системный блоки'
if(regEx.test(str)) console.log('ok')
else console.log('false')