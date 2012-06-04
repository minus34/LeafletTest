var restUrl = "../rest/v1/ws_geo_attributequery.php";
var currStatGroup = "b02";
var currStatId = "b109";
var currStatNames = [];
var currStatIds = [];
var currStats = [];
var maxStat = -999999999;
var minStat = 999999999;
var currBdy = "";
var bdyLayer = null;
var map = null;

function init() {
    //Add a new property for defining each bdy's appearance
    L.GeoJSON.prototype.colourStat = null;

    //Initialize the map on the "map" div
    map = new L.Map('map');

    //Create a CloudMade tile layer
    var cloudmade = new L.TileLayer('http://{s}.tile.cloudmade.com/ccb415a99d7d458c833d77eecf7a81c0/997/256/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
        maxZoom: 18
    });

    //Add the CloudMade layer to the map
    map.addLayer(cloudmade);

    //Set the view to a given center and zoom
    map.setView(new L.LatLng(-33.85, 151.15), 13);

    //Acknowledge the ABS Census Data
    map.attributionControl.addAttribution('2006 Census data © <a href="http://www.abs.gov.au/websitedbs/D3310114.nsf/Home/%C2%A9+Copyright">Australian Bureau of Statistics</a>');

    //Get a new set of boundaries when map panned or zoomed
    map.on('dragend', function (e) {
        getBoundaries();
    });

    map.on('zoomend', function (e) {
        map.closePopup();
        getBoundaries();
    });

    //Get the first set of boundaries
    getBoundaries();
}

function getBoundaries() {

    //Get map extents
    var bb = map.getBounds();
    var sw = bb.getSouthWest();
    var ne = bb.getNorthEast();
    
    //Get zoom level
    zoomLevel = map.getZoom();

    //Set ABS bdy table type
    currBdy = setBoundary(zoomLevel);

    //Set the ABS list of Census stats to use
    currStatNames = setStatNames();
    currStatIds = setStatIds();

    //Build URL with querystring - selects census bdy attributes, stats and the census boundary geometries as GeoJSON objects
    var ua = [];
    ua.push(restUrl);
    ua.push("?jsoncallback=?&fields=absid,absname,geojson,");
    ua.push(currStatIds.join(","));
    ua.push("&parameters=ST_Intersects(ST_MakeBox2D(ST_Point(");
    ua.push(sw.lng.toString());
    ua.push(",");
    ua.push(sw.lat.toString());
    ua.push("),ST_Point(");
    ua.push(ne.lng.toString());
    ua.push(",");
    ua.push(ne.lat.toString());
    ua.push(")),geom)");
    ua.push("&geotable=v");
    ua.push(currBdy);
    ua.push(zoomLevel);
    ua.push(currStatGroup);
    ua.push("&format=json");
    var reqStr = ua.join('');

    //Fire off AJAX request
    $.getJSON(reqStr, loadBdys)
}

function loadBdys(json) {
    var numStats = currStatIds.length;
    maxStat = -999999999;
    minStat = 999999999;

    //get row count    
    var numRows = parseInt(json.total_rows);
    var rows = json.rows

    //Array to hold the bdys
    var geojsons = [];
    
    for (var j = 0; j < numRows; j++) {
        //Get ABS data and the geometry
        var absid = rows[j].row.absid;
        var absname = rows[j].row.absname;
        var geom = rows[j].row.geojson;

        //Get Census stats
        currStats = [];
        var colourStat = 0;

        //Create array for concatenating the popup text
        var popupText = [];
        popupText.push("<b>");
        popupText.push(absname);
        popupText.push("</b><br/><i>Medians and Averages</i><br/>");

        //Step through the stats
        for (var k = 0; k < numStats; k++) {
            var statName = currStatNames[k];
            var statId = currStatIds[k];
            var stat = rows[j].row[statId];
            currStats.push(stat);

            //Add stat to popup text
            popupText.push("<br/>");
            popupText.push(statName);
            popupText.push(stat);

            //Determine the stats values that will determine the appearance of the bdy
            if (statId == currStatId) {
                if (stat > maxStat) maxStat = stat;
                if (stat < minStat) minStat = stat;
                colourStat = stat;
            }
        }
        
        //Create Leaflet GeoJSON object
        var geojson = new L.GeoJSON(geom);

        //Set the prototype value that will define the bdy's appearance
        geojson.colourStat = colourStat;

        //Set the popup text
        geojson.bindPopup(popupText.join(""))

        //Add to geojson layer array
        geojsons.push(geojson);

    }

    //reset boundaries
    if (bdyLayer != null) map.removeLayer(bdyLayer);
    bdyLayer = new L.LayerGroup();

    //Set bdy colours and events, and add to the bdy group layer
    for (var i = 0; i < numRows; i++) {
        var geom = geojsons[i];

        //Set appearance of bdy
        geom.setStyle({
            weight: 1,
            opacity: 0.4,
            color: "#444",
            fillColor: setColour(geom.colourStat),
            fillOpacity: 0.4
        });
        
        //Add events
        geom.on('mouseover', function (e) {
            e.target.setStyle({
                weight: 2,
                opacity: 0.9,
                color: "#444",
                fillColor: setColour(e.target.colourStat),
                fillOpacity: 0.8
            });
        });

        geom.on('mouseout', function (e) {
            e.target.setStyle({
                weight: 1,
                opacity: 0.4,
                color: "#444",
                fillColor: setColour(e.target.colourStat),
                fillOpacity: 0.4
            });
        });

        bdyLayer.addLayer(geom);
    }

    //Add layer group to map
    map.addLayer(bdyLayer);
}

//Sets the Census boundary type based on map zoom level
function setBoundary(zoomLevel) {
    switch (zoomLevel) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
            return "ste"; //States
        case 6:
        case 7:
            return "sd"; //Statistical Divisions
        case 8:
        case 9:
            return "ssd";
        case 10:
        case 11:
            return "lga"; //ABS Local Government Areas (i.e. council areas)
        case 12:
        case 13:
            return "poa"; //ABS Postcodes
        case 14:
        case 15:
            return "ssc"; //ABS Suburbs
        case 16:
        case 17:
        case 18:
            return "cd"; //Census Collection Districts (aka CCDs)
    }
}

function setStatNames() {
    //TO DO: Add more stat groups to the database and set them up here (also create a better stats object)
    switch (currStatGroup) {
        case "b02":
            return ["Age : ", "Income : $", "Family income : $", "Household income : $", "Home loan repayment : $", "Rent : $", "People per bedroom : ", "Household size : "];
    }
}

function setStatIds() {
    //TO DO: Add more stat groups to the database and set them up here (also create a better stats object)
    switch (currStatGroup) {
        case "b02":
            return ["b109", "b110", "b111", "b112", "b113", "b114", "b115", "b116"];
    }
}

//Sets the colour of each boundary
function setColour(colourStat) {
    //Calc the percentage of the value between the max and min
    var percent = 0.0;

    if (maxStat - minStat == 0) {
        percent = 0.5;
    } else {
        percent = (colourStat - minStat) / (maxStat - minStat);
    }

    //Convert to hex 3 digit colour
    return "#b" + Math.floor(percent * 255).toString(16);
}
