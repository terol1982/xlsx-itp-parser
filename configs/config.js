// config.js
var config = {
 providerFile:'xlsx/prov.xls', //прайс поставщика (.xlsx)
 outFile:'xlsx/out.xlsx', //наш прайс (.xlsx)

 sheetNameProvider:'TDSheet',    //используй 'TDSheet' если всего 1 лист и без названия

 skuMod:'_itzp',

    prcntRozn: 10,
    prcntOpt: 7,
    convertToUAH: true,
    loadOnlySelectedCategories: true,
 

  }

module.exports = config;

