var bookkeeper = function() {

    var descriptionRegex = /Sale: ([0-9]+) x ([\w ]+?) of design '((?:(?! ' on ).)+)' on ([\w \-\xae]+?) fabric to ([\w\-]+)/i;
    var bundleDescriptionRegex = /Sale: ([\w ]+?) (fat quarter) bundle of design '((?:(?! ' on ).)+)' on ([\w \-\xae]+?) fabric to ([\w\-]+)/i;
    var yardageRegex = /([0-9]+) yards?/;

    var orderDiv = $('#orders');
    var parsedData = [];
    var fabricList = [];
    var aggregateFabricData = initFabricData("Overall");
    var creditCount = 0;
    var debitCount = 0;
    var matchCount = 0;

    if (document.URL.match(/.*www.spoonflower.com\/account\/\d*\?sub_action=spoondollars/)) {
        console.log("starting bookkeeper");
        grabAllTransactions();
        //console.log("read in: " + JSON.stringify(parsedData));
        console.log("found " + creditCount + " credits, " + debitCount + " debits, "
            + matchCount + " matches, and " + parsedData.length + " rows");
        runReports();
        //console.log("aggregate fabric data: " + JSON.stringify(fabricList.sort(byRevenue)));
        fabricList.sort(byRevenue);
        console.log("adding table of " + fabricList.length + " entries to page");
        addToPage();
    }

    function grabAllTransactions() {
        orderDiv.find('tr').each(function() {
            var type = $(this).find('td:eq(1)').html();
            var isSale = false;
            var isValid = false;
            if (type && type.match(/credit/i)) {
                creditCount++;
                isSale = true;
                isValid = true;
            } else if (type && type.match(/debit/i)) {
                debitCount++;
                isValid = true;
            }
            if (isValid) {
                //var date = $(this).find('td:eq(0)').html();
                var description = $(this).find('td:eq(2)').html();
                var money = $(this).find('td:eq(3)').html();
                //var balance = $(this).find('td:eq(4)').html();
                if (isSale) {
                    parseFabricSale(description, money);
                }
            }
        });
    }

    function parseFabricSale(description, money) {
        var infoContents = descriptionRegex.exec(description);
        //console.log("parsed description: " + infoContents);
        var bundle = false;
        if (!infoContents) {
            infoContents = bundleDescriptionRegex.exec(description);
            //console.log("parsed bundle description: " + infoContents);
            if (!infoContents) {
                console.log("Unable to parse description: " + description);
                return;
            }
            bundle = true;
        }
        matchCount++;
        var quantity = bundle ? 1 : infoContents[1];
        var size = infoContents[2];
        var design = infoContents[3];
        var substrate = infoContents[4];
        var customer = infoContents[5];

        var rowData = {};

        parseSize(size, rowData);
        parseMoney(money, rowData);

        rowData.quantity = parseInt(quantity);
        rowData.design = design;
        rowData.substrate = substrate;
        rowData.customer = customer;
        parsedData.push(rowData);
    }

    function parseSize(size, rowData) {
        rowData.size = size;
        var sizeContents = yardageRegex.exec(size);
        rowData.isYardage = false;
        if (sizeContents) {
            rowData.isYardage = true;
            rowData.size = sizeContents[1];
        }
    }

    function parseMoney(money, rowData) {
        var moneyContents = monetize(money);
        if (!moneyContents || moneyContents.length != 2) {
            console.log("unable to parse money: " + money + ", result was: " + moneyContents);
            return;
        }
        moneyData = {};
        moneyData.dollars = parseInt(moneyContents[0]);
        moneyData.cents = parseInt(moneyContents[1]);
        rowData.money = moneyData;
    }

    function monetize(money) {
        return money.split(/[^0-9]/).filter(function(n){return n});
    }

    function width(substrate) {
        if (substrate.match(/performance|twill/)) return 58;
        if (substrate.match(/knit|sateen/)) return 56;
        if (substrate.match(/canvas|voile/)) return 54;
        if (substrate.match(/crepe/)) return 42;
        if (substrate.match(/silk/)) return 40;
        return 42;
    }

    function initFabricData(name) {
        var fabricData = {};
        fabricData.name = name;
        fabricData.sales = 0;
        fabricData.cents = 0;
        fabricData.swatches = 0;
        fabricData.fqs = 0;
        fabricData.yards = 0;
        fabricData.sqin = 0;
        return fabricData;
    }

    function runReports() {
        var fabricMap = {};
        for (var i = 0; i < parsedData.length; i++) {
            var sale = parsedData[i];
            var fabricData = fabricMap[sale.design];
            if (!fabricData) fabricData = initFabricData(sale.design);
            fabricData.sales++;
            fabricData.cents += sale.money.cents + (100 * sale.money.dollars);
            if (sale.isYardage) {
                var totalYards = sale.quantity * parseInt(sale.size);
                fabricData.yards += totalYards;
                fabricData.sqin += totalYards * 36 * width(sale.substrate);
            } else if (sale.size.match(/fat quarter/i)) {
                fabricData.fqs += sale.quantity;
                fabricData.sqin += sale.quantity * 18 * width(sale.substrate)/2;
            } else if (sale.size.match(/swatch/i)) {
                fabricData.swatches += sale.quantity;
                fabricData.sqin += sale.quantity * 8 * 8;
            } else {
                console.log("unable to process size described as '" + sale.size + "'");
            }
            fabricMap[sale.design] = fabricData;
         }
        fabricList = (Object.keys(fabricMap)).map(function(v) { return fabricMap[v]; });
        for (i = 0; i < fabricList.length; i++) {
            addToAggregate(fabricList[i]);
        }
    }

    function addToAggregate(fabricData) {
        aggregateFabricData.sales += fabricData.sales;
        aggregateFabricData.cents += fabricData.cents;
        aggregateFabricData.swatches += fabricData.swatches;
        aggregateFabricData.fqs += fabricData.fqs;
        aggregateFabricData.yards += fabricData.yards;
        aggregateFabricData.sqin += fabricData.sqin;
    }

    function byRevenue(a, b) {
        if (a.cents == b.cents) return byName(a, b);
        return b.cents - a.cents;
    }

    function byName(a, b) {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    }

    function addToPage() {
        if (fabricList.length < 1) {
            return;
        }
        var tableHeader = "<tr><th>Design Name</th>"
            + "<th id='revenue_header'>Total Revenue</th>"
            + "<th id='sales_header'>Total Sales</th>"
            + "<th id='sqft_header'>Total Square Feet</th>"
            + "<th>Yards</th>"
            + "<th>Fat Quarters</th>"
            + "<th>Swatches</th></tr>";
        var aggregateRow = "<tr><th></th><th>"
            + formatMoney(aggregateFabricData.cents) + "</th><th>"
            + aggregateFabricData.sales + "</th><th>"
            + formatSqft(aggregateFabricData.sqin) + "</th><th>"
            + aggregateFabricData.yards + "</th><th>"
            + aggregateFabricData.fqs + "</th><th>"
            + aggregateFabricData.swatches + "</th></tr>";
        orderDiv.after('<hr/><h2>Top Sellers</h2><div><table id=sales>' + tableHeader + aggregateRow + '</table></div>');
        addDataRows();

        var table = $('#sales');

        $('#revenue_header, #sales_header, #sqft_header')
            .wrapInner('<span title="sort this column"/>')
            .each(function() {
                var th = $(this);
                var thIndex = th.index();
                th.click(function() {
                    table.find('td').filter(function() {
                        return $(this).index() === (thIndex + 6);
                    }).sortElements(sortHiddenRow,
                        function() {
                            // parentNode is the element we want to move
                            return this.parentNode;
                        });

                    var even = true;
                    table.find('tr').each(function() {
                        $(this).attr("class", even ? "order even border" : "order odd");
                        even = !even;
                    })
                });
            });

    }

    function sortHiddenRow(a, b) {
        var textA = $.text([a]);
        var textB = $.text([b]);
        var nameA = textA.substring(0, textA.indexOf("___"));
        var nameB = textB.substring(0, textB.indexOf("___"));
        var numA = parseInt(textA.substring(textA.indexOf("___") + 3));
        var numB = parseInt(textB.substring(textB.indexOf("___") + 3));

        if (numA == numB) {
            // sort by name when numbers equal
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        }
        return numB - numA;
    }

    function addDataRows() {
        for (var i = 0; i < fabricList.length; i++) {
            var fabric = fabricList[i];
            var money = formatMoney(fabric.cents);
            var divClass = (i % 2 == 0) ? 'order even border' : 'order odd';
            $("#sales").find("tr:last").after('<tr class="' + divClass + '"><td>' + fabric.name
                + '</td><td>' + money
                + '</td><td>' + fabric.sales
                + '</td><td>' + formatSqft(fabric.sqin)
                + '</td><td>' + fabric.yards
                + '</td><td>' + fabric.fqs
                + '</td><td>' + fabric.swatches
                + '</td><td style="display:none;">' + fabric.name + '___' + fabric.cents
                + '</td><td style="display:none;">' + fabric.name + '___' + fabric.sales
                + '</td><td style="display:none;">' + fabric.name + '___' + fabric.sqin
                + '</td></tr>');
        }
    }

    function formatMoney(cents) {
        return '$' + (cents/100).toFixed(2);
    }

    function formatSqft(sqin) {
        return (sqin/144).toFixed(2);
    }

}();