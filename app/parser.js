// parser.js
'use strict';

process.title = 'XLS_ITP_2_XLS_prom.ua';
const scriptName = 'XLS_ITP_2_XLS_prom.ua';
const lastEdit='2019.10.03'

var config = require('../configs/config');

var express = require('express'),
    path = require('path'),
    fs = require('fs'),
    formidable = require('formidable'),
    XLSX = require('xlsx'),
    bodyParser = require("body-parser"),
    unzip = require('unzip');

var app = express();

var name='', desc='', type='u', prcRozn='', currency='', is_present='', itemID='', groupName='', izmerenie='шт.', prcOpt='', prc='', minZakazOpt=5, kurs;



app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {

    res.sendFile(__dirname+ '/html/index.html');
});

app.get("/js/:file", function (request, response) {
    response.sendFile(__dirname + "/html/js/" + request.params["file"]);
    //else return response.sendStatus(404);

});

app.get("/uploads/:file", function (request, response) {
    response.sendFile(__dirname + "/uploads/" + request.params["file"]);
    //else return response.sendStatus(404);

});

app.get("/tmp_uploads/:file", function (request, response) {
    response.sendFile(__dirname + "/tmp_uploads/" + request.params["file"]);
    //else return response.sendStatus(404);

});

app.get("/favicon.ico", function (request, response) {
    response.sendFile(__dirname + "/html/favicon.ico");
  // return response.sendStatus(404);

});

app.post('/upload_file', function (req, res) {
    // console.log(req.fields)
    // console.log(req.files)
    //cleanDIR(path.join(__dirname, 'tmp_uploads'))

    var filesInput = [], formFields={},
        form = new formidable.IncomingForm();

    // Tells formidable that there will be multiple files sent.
    form.multiples = true;
    // Upload directory for the files
    form.uploadDir = path.join(__dirname, 'tmp_uploads');

    form.on('field', function(name, value) {
        formFields[name]=value

    });

    // Invoked when a file has finished uploading.
    form.on('file', function (name, file) {
        // Allow only 3 files to be uploaded.
        if (filesInput.length === 3) {
            fs.unlink(file.path,  function (err){if (err) throw err;});
            return true;
        }

        let buffer = null,
            type = null,
            filename = '',
            status=false;


        type=filetypeChk(file.name)
        filename = 'tmp_file.'+type//Date.now() + '-' + file.name;

            // Move the file with the new file name
            if(type) {
                fs.renameSync(file.path, path.join(__dirname, 'tmp_uploads/' + filename),  function (err){if (err) throw err;});
                status=true;
            }


            // Add to the list of filesInput
            filesInput.push({
                status: status,
                filename: filename,
                origName: file.name,
                type: type,
                publicPath: 'tmp_uploads/' + filename,
                size:0,
                results:0,
            });
        // } else {
        //     filesInput.push({
        //         status: false,
        //         filename: file.name,
        //         message: 'Invalid file type'
        //     });
        //     fs.unlink(file.path);
        // }



    });

    form.on('error', function(err) {
        console.log('Error occurred during processing - ' + err);
    });

    // Invoked when all the fields have been processed.
    form.on('end', async function(err) {


    });

    // Parse the incoming form fields.
    form.parse(req,async function (err, fields, files) {

        console.log('Form parsed. Begin to parse file...');
        let inFile=path.join(__dirname, 'tmp_uploads/' + filesInput[0]['filename'])
        let outFile=path.join(__dirname, 'tmp_uploads/out.xlsx')

        if(filesInput[0]['status']===false) return;
        let rows=0

        if(rows=await parseITPlanet (inFile, outFile, formFields['kurs'].replace(',','.'), formFields['category'], filesInput[0]['origName'])) {
            filesInput[0]['size']=getFilesizeInKBytes(outFile)
            filesInput[0]['filename'] = 'out.xlsx';
            filesInput[0]['publicPath'] = 'tmp_uploads/out.xlsx';
            filesInput[0]['results']=rows
            configWrite({categories:formFields['category']}, 'categories')
        }

        res.status(200).json(filesInput);  //filesInput
    });


});

app.post('/cmd', function (req, res) {
    if(req.body.cmd=='cat'&&req.body.act=='get'){
        let cat=configRead('categories')
        res.status(200).json(cat);  //filesInput
    }

});



app.listen(app.get('port'), function() {
    console.log('Express started at port ' + app.get('port'));
});

async function  parseITPlanet (filenameIn, filenameOut, kurs, categories='', origName=''){
    try{
        let delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        var cats={}
        let groupName=''
        let groupNameDefault='Прочее'
        console.log('parsing provider price...')

        //unzip input file, if needed
        if(filetypeChk(filenameIn)=='zip'){
            //unzip file
            console.log('unziping file...')
            let deleteOrig=0
            let origFile=filenameIn
            let basename=origName.replace('.zip', '')//path.basename(filenameIn, 'zip')
            let dir=path.dirname(filenameIn)
            let newName=path.join(dir, basename)
            //console.log(newName)

            fs.createReadStream(filenameIn).pipe(unzip.Extract({ path: dir }));
            //wait for unzipping
            for(let i=0; i<10; i++){
                if (await fs.existsSync(newName+'.xls')) {
                    fs.renameSync(newName+'.xls', path.join(dir, 'tmp_file.xls'),  function (err){if (err) throw err;});
                    filenameIn=path.join(dir, 'tmp_file.xls')
                    break;
                }
                if (await fs.existsSync(newName+'.xlsx')) {
                    fs.renameSync(newName+'.xlsx', path.join(dir, 'tmp_file.xlsx'),  function (err){if (err) throw err;});
                    filenameIn=path.join(dir, 'tmp_file.xlsx')
                    break;
                }
                if(i<9) await delay(500)
                else return false
            }



            if(deleteOrig) await fs.unlinkSync(origFile)
        }

        //forming categories list
        if(categories){
            let tmp=categories.split("\n")
            for(let num in tmp){
                let t=tmp[num].split('=')
                if(t[1]) cats[t[0].trim()]=t[1].trim()
            }

        }


        //get sheet from provider price
        let excelBufferProvider = await fs.readFileSync(filenameIn);

        var rowsOut=0


        // parsing data
        //result.SheetNames - names of sheets
        //result.Sheets['sheet1']['!ref'] - диапазон используемых ячеек на листе, например 'B4:D19'
        //result.Sheets['sheet1']['A1'] - возвращает ячейку А1 в виде объекта:
        // А1 { t: 's', // Cell type
        //     v: 'Условия поставки EXW Ужгород',  //Source data (unprocessed data)
        //     r: '<t>Условия поставки EXW Ужгород</t>', //Decoded rich text (if it can be decoded)
        //     w: 'Условия поставки EXW Ужгород', //Formatted text (if formatted)
        //      f: 'F2*D3' //formula (if specified)
        // }
        //example: result.Sheets['DSC']['C7'].v - вернет значение ячейки С7
        let resultProvider = XLSX.read(excelBufferProvider,{
            type:'buffer',
            cellHTML:false,
        });
        //console.log(result)  //['B12']
        // return 0;

        excelBufferProvider={}
        let targetSheetProvider=resultProvider.Sheets[config.sheetNameProvider] //example: targetSheetProvider['A1']
        let targetSheetProviderMaxRow=parseInt(targetSheetProvider['!ref'].split(':')[1].replace(/[a-z]/gi, ''))


        //create new workbook
        var wbNew = XLSX.utils.book_new();
        var sheetNamenew='Export Products Sheet';
        // create header for new workbook
        var data_out = [
            [ "Название_позиции", "Описание", "Тип_товара", "Цена", "Валюта", "Наличие", "Код_товара", "Идентификатор_товара", "Название_группы", "Единица_измерения", "Оптовая_цена", "Минимальный_заказ_опт" ]
        ];

        if(targetSheetProvider['A1']) kurs=parseFloat(targetSheetProvider['A1']['v'])


        //parse every row in provider price
        //name='', desc='', type='', prcRozn='', currency='', is_present='', itemID='', groupName='', izmerenie='', prcOpt='';
        for(let i=12; i<=targetSheetProviderMaxRow; i++){
            let prcOk=0

            //normal parsing
            if(targetSheetProvider['A'+i]) {
                //console.log(targetSheetProvider['A'+i].v)
                if(targetSheetProvider['A'+i].w=='g') groupName=targetSheetProvider['B'+i] //если это строка с названием группы товара
                else {
                    itemID=targetSheetProvider['A'+i]['w'].trim()+config.skuMod;
                    name=targetSheetProvider['B'+i]['w'].trim()
                    desc=targetSheetProvider['B'+i].w
                    //если стоит цена в долл. колонке
                    if(targetSheetProvider['C'+i]){
                        prcOk=1
                        currency='USD'
                        prc=targetSheetProvider['C'+i]['v'].toString()
                        //console.log(prc)
                        if(prc.match(/ожид/i)){//если товар ожидается
                            prc=prc.split('(')[1].replace(')','')
                            is_present='&'
                        }
                        else {
                            is_present='+'

                        }

                    }
                    //если стоит цена в грн. колонке
                    else if(targetSheetProvider['D'+i]){
                        prcOk=1
                        currency='UAH'
                        prc=targetSheetProvider['D'+i]['v'].toString()
                        if(prc.match(/ожид/i)){//если товар ожидается
                            prc=prc.split('(')[1].replace(')','')
                            is_present='&'
                        }
                        else {
                            is_present='+'

                        }
                    }
                }
            }

            if(prcOk==1) {
                let categoryFound=0
                prc=parseFloat(prc)
                if(config.convertToUAH&&kurs&&currency=='USD') {prc=prc*kurs; currency='UAH'}
                prcRozn=prc+prc*config.prcntRozn/100
                prcOpt=prc+prc*config.prcntOpt/100
                rowsOut++

                //group names
                //if(!groupName){
                    for(let search in cats){

                        let regEx=new RegExp(/*'^'+*/search/*.replace(' ', '.+')*/, 'i') //  ('^'+pair+'_.+\\.zip$', 'i');
                        //console.log(`${regEx} - ${cats[search]} - ${name}: `)
                        if(regEx.test(name)) {
                            groupName=cats[search]
                           // console.log(`${groupName}`)
                            categoryFound=1
                            break
                        }
                        else groupName=groupNameDefault
                    }
                //}

                if((config.loadOnlySelectedCategories&&categoryFound)||!config.loadOnlySelectedCategories)
                    data_out.push([name, desc, type, prcRozn.toString(), currency, is_present, itemID, itemID, groupName,  izmerenie, prcOpt.toString(), minZakazOpt])
                //groupName=''
            }

        }

        var ws = XLSX.utils.aoa_to_sheet(data_out);
        XLSX.utils.book_append_sheet(wbNew, ws, sheetNamenew);

        await XLSX.writeFile(wbNew, filenameOut);   //config.outFile

        console.log('XLS parsing complete')

        return rowsOut


    }
    catch(e){
        // console.log(e.message)
        throw (e)
    }


}

async function  cleanDIR(dir) {
    try {
        let qty=0
        let filesToClean=[]
        let allFiles= await fileList(dir )
        for(let i=0; i<allFiles.length; i++){

                 console.log(dir+allFiles[i])
                //await fs.unlinkSync(dir+allFiles[i])
                qty++


        }
        return qty;

    } catch (e) {
        console.log('cleanDIR(): '+e.name + ': ' + e.message)
        return false
    }
}

function fileList (directory) {
    try {
        if (typeof directory == 'undefined' || directory === 'undefined') {
            console.log('fileList(): wrong parameters');
            return false;
        }
        //let dir = __dirname +'/'+directory
        let files = fs.readdirSync(directory);
        let list=[]
        for (var i in files){
            var name = directory + '/' + files[i];
            if (!fs.statSync(name).isDirectory()) list.push(files[i]);
        }

        return list;


    } catch (e) {
        console.log('fileList(): '+e.name + ': ' + e.message)
        return false
    }

}

function getFilesizeInKBytes(filename) {
    try{
        const stats = fs.statSync(filename);
        const fileSizeInBytes = stats.size;
        return fileSizeInBytes/1000;
    }
    catch(e){
        console.log(e)
    }


}

function filetypeChk(filename, types=['xlsx', 'xls', 'zip']){
    let tmp=filename.split('.')
    let type=tmp[tmp.length-1]
    if(types.includes(type)) return type
    else return false
}

function configWrite  (conf, type, simple=1) {
    try {
        if (typeof conf == 'undefined' || conf === 'undefined' || typeof type == 'undefined' || type === 'undefined') {
            console.log('configWrite(): wrong parameters');
            return false;
        }
        let fullName = __dirname +'/../configs/' + type+'.js'
        let txt=''
        if(simple) txt=JSON.stringify(conf, null, 4)
        else txt="var "+type+" = "+JSON.stringify(conf, null, 4)+";\n module.exports = "+type+";";

        let res = fs.writeFile(fullName, txt, { "encoding": "utf8"}, function (err) { //, { "encoding": "utf8"}
            if (err) {
                console.log('configWrite(): error writing config file: ' + err.name + ': ' + err.message);
                return false;
            }
            else return true;
        });

        return true;
    } catch (e) {
        console.log('configWrite(): ' + e.message)
        // throw e;
        return false
    }

}

function configRead   (type) {
    try {
        if (typeof type == 'undefined' || type === 'undefined') {
            console.log('configRead(): wrong parameters');
            return false;
        }
        let fullName = __dirname +'/../configs/' + type+'.js'
        if(!fs.existsSync(fullName)) return {}
        let json = fs.readFileSync(fullName,{ "encoding": "utf8"});  //JSON.parse(fs.readFileSync(fullName, 'utf8').toString());   //,{ "encoding": "utf8"}
        return JSON.parse(json);


    } catch (e) {
        console.log('configRead(): ' + e.message)
        return {}
    }

}

/*(async function (params) {
try{
    //get sheet from provider price
    console.log('parsing provider price...')
    let excelBufferProvider = await fs.readFileSync(config.providerFile);


    // parsing data
    //result.SheetNames - names of sheets
    //result.Sheets['sheet1']['!ref'] - диапазон используемых ячеек на листе, например 'B4:D19'
    //result.Sheets['sheet1']['A1'] - возвращает ячейку А1 в виде объекта:
    // А1 { t: 's', // Cell type
    //     v: 'Условия поставки EXW Ужгород',  //Source data (unprocessed data)
    //     r: '<t>Условия поставки EXW Ужгород</t>', //Decoded rich text (if it can be decoded)
    //     w: 'Условия поставки EXW Ужгород', //Formatted text (if formatted)
    //      f: 'F2*D3' //formula (if specified)
    // }
    //example: result.Sheets['DSC']['C7'].v - вернет значение ячейки С7
    let resultProvider = XLSX.read(excelBufferProvider,{
        type:'buffer',
        cellHTML:false,
    });
    //console.log(result)  //['B12']
   // return 0;

    excelBufferProvider={}
    let targetSheetProvider=resultProvider.Sheets[config.sheetNameProvider] //example: targetSheetProvider['A1']
    let targetSheetProviderMaxRow=parseInt(targetSheetProvider['!ref'].split(':')[1].replace(/[a-z]/gi, ''))


    //create new workbook
     var wbNew = XLSX.utils.book_new();
     var sheetNamenew='Export Products Sheet';
    // create header for new workbook
    var data_out = [
        [ "Название_позиции", "Описание", "Тип_товара", "Цена", "Валюта", "Наличие", "Идентификатор_товара", "Название_группы", "Единица_измерения", "Оптовая_цена", "Минимальный_заказ_опт" ]
    ];

    if(targetSheetProvider['A1']) kurs=parseFloat(targetSheetProvider['A1']['v'])


    //parse every row in provider price
    //name='', desc='', type='', prcRozn='', currency='', is_present='', itemID='', groupName='', izmerenie='', prcOpt='';
    for(let i=12; i<=targetSheetProviderMaxRow; i++){
        let prcOk=0
        if(targetSheetProvider['A'+i]) {
            //console.log(targetSheetProvider['A'+i].v)
            if(targetSheetProvider['A'+i].v=='g') groupName=targetSheetProvider['B'+i] //если это строка с названием группы товара
            else {
                itemID=targetSheetProvider['A'+i]['v'].trim()+config.skuMod;
                name=targetSheetProvider['B'+i]['v'].trim()
                desc=targetSheetProvider['B'+i].v
                //если стоит цена в долл. колонке
                if(targetSheetProvider['C'+i]){
                    prcOk=1
                    currency='USD'
                    prc=targetSheetProvider['C'+i]['v'].toString()
                    //console.log(prc)
                    if(prc.match(/ожид/i)){//если товар ожидается
                        prc=prc.split('(')[1].replace(')','')
                        is_present='&'
                    }
                    else {
                        is_present='+'

                    }

                }
                //если стоит цена в грн. колонке
                else if(targetSheetProvider['D'+i]){
                    prcOk=1
                    currency='UAH'
                    prc=targetSheetProvider['D'+i]['v'].toString()
                    if(prc.match(/ожид/i)){//если товар ожидается
                        prc=prc.split('(')[1].replace(')','')
                        is_present='&'
                    }
                    else {
                        is_present='+'

                    }
                }
            }
        }

        if(prcOk==1) {
            prc=parseFloat(prc)
            if(config.convertToUAH&&kurs&&currency=='USD') {prc=prc*kurs; currency='UAH'}
            prcRozn=prc+prc*config.prcntRozn/100
            prcOpt=prc+prc*config.prcntOpt/100
            data_out.push([name, desc, type, prcRozn.toString(), currency, is_present, itemID, groupName,  izmerenie, prcOpt.toString(), minZakazOpt])
        }
        // if(targetSheetProvider[namesColumnProvider+i]&&targetSheetProvider[pricesColumnProvider+i]) {
        //     let name=(targetSheetProvider[namesColumnProvider + i].v).trim()
        //     if(config.useFilterDahua) name=filterDahua(name)
        //     if(config.useFilterHikvision) name=filterHikvision(name)
        //     if(config.useFilterLun) name=filterLun(name)
        //     providerObj[name] = [targetSheetProvider[pricesColumnProvider + i].v, namesColumnProvider+i]
        // }

    }

    var ws = XLSX.utils.aoa_to_sheet(data_out);
    XLSX.utils.book_append_sheet(wbNew, ws, sheetNamenew);

    await XLSX.writeFile(wbNew, config.outFile);

    console.log('parsing complete')




}
catch(e){
      // console.log(e.message)
    throw (e)
}

})();*/

// function filterDahua(str){
//     return str.replace(/^dh[i]*-/gi, '').replace(',', '').split(' ')[0]
//
// }
//
// function filterHikvision(str){
//     return str.replace(/^[i]*ds-/gi, '').replace(',', '').split(' ')[0]
//
// }
//
// function filterLun(str){
//     return str.replace(/\"/gi, '').replace("'", '').replace("«", '').replace("»", '')
//
// }



return 0;