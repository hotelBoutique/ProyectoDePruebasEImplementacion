/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [1.0, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "GET - Productos"], "isController": false}, {"data": [1.0, 500, 1500, "POST - Login"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Mi perfil"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Categorías de productos"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Reservaciones"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Check-ins pendientes"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Dashboard recepción"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Habitaciones"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Comprobantes"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Health"], "isController": false}, {"data": [1.0, 500, 1500, "GET - Check-outs pendientes"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 110, 0, 0.0, 28.9181818181818, 0, 287, 6.0, 42.50000000000014, 247.0, 287.0, 3.242924528301887, 3.935328069722877, 1.2492053913620282], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["GET - Productos", 10, 0, 0.0, 6.6, 5, 10, 6.0, 9.9, 10.0, 10.0, 0.7390983000739099, 0.8018927845528455, 0.2872667220990392], "isController": false}, {"data": ["POST - Login", 10, 0, 0.0, 255.4, 245, 287, 247.0, 287.0, 287.0, 287.0, 0.725531451788435, 1.0486196764129725, 0.20901540847420735], "isController": false}, {"data": ["GET - Mi perfil", 10, 0, 0.0, 6.0, 4, 8, 6.0, 7.9, 8.0, 8.0, 0.739863865048831, 0.9306100177567328, 0.2861192290618526], "isController": false}, {"data": ["GET - Categorías de productos", 10, 0, 0.0, 5.199999999999999, 4, 6, 5.5, 6.0, 6.0, 6.0, 0.7387161113983896, 0.8029209296742261, 0.29433220063529586], "isController": false}, {"data": ["GET - Reservaciones", 10, 0, 0.0, 6.5, 5, 9, 6.0, 8.8, 9.0, 9.0, 0.7386615452799528, 0.804304319323386, 0.28998236445560643], "isController": false}, {"data": ["GET - Check-ins pendientes", 10, 0, 0.0, 6.3999999999999995, 4, 10, 6.0, 9.8, 10.0, 10.0, 0.7416196974191634, 0.8073080827276773, 0.3034557160338179], "isController": false}, {"data": ["GET - Dashboard recepción", 10, 0, 0.0, 5.7, 3, 20, 4.0, 18.600000000000005, 20.0, 20.0, 0.7400281210686006, 0.9597239695108414, 0.29485495448827054], "isController": false}, {"data": ["GET - Habitaciones", 10, 0, 0.0, 6.1, 5, 8, 6.0, 7.9, 8.0, 8.0, 0.7394808844191378, 1.260872679878725, 0.2852489739702729], "isController": false}, {"data": ["GET - Comprobantes", 10, 0, 0.0, 13.1, 8, 45, 9.5, 41.60000000000001, 45.0, 45.0, 0.7389890629618682, 0.8940035656222288, 0.29588429278746675], "isController": false}, {"data": ["GET - Health", 10, 0, 0.0, 1.1, 0, 2, 1.0, 2.0, 2.0, 2.0, 0.7407956144899622, 0.7379018816208608, 0.28069208830283726], "isController": false}, {"data": ["GET - Check-outs pendientes", 10, 0, 0.0, 6.0, 4, 8, 6.0, 7.9, 8.0, 8.0, 0.7415647015202076, 0.8071033787541714, 0.3041573971078977], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 110, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
