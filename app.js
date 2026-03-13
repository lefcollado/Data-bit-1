const BZR_ID_FIELD = "BZR_ID";
const PLANUNGSRAUM_BZR_ID_FIELD = "BZR_ID";
const BZR_NAME_FIELD = "BZR_Name";
const PLANUNGSRAUM_ID_FIELD = "PLR_ID";
const PLANUNGSRAUM_NAME_FIELD = "PLR_Name";

const FIRESTATION_BZR_ID_FIELD = "BZR_ID";
const FIRESTATION_NAME_FIELD = "wach_name";

const STAT_TOTAL_MISSIONS = "tot_m_25";
const STAT_CEMS_PERCENT = "cems_perc";
const STAT_FIRE_PERCENT = "fire_perc";
const STAT_CEMS_1000P = "cems_1000p";
const STAT_CEMS_MED_MIN = "cems_med_min";


// ----------- PAGE / UI ELEMENTS -----------
const mapScreen = document.getElementById("mapScreen");
const resultScreen = document.getElementById("resultScreen");
const startButton = document.getElementById("startButton");
const statusEl = document.getElementById("status");
const resultStatusEl = document.getElementById("resultStatus");
const resetBtn = document.getElementById("resetBtn");
// references to elements in the right-side info panel
const infoTitleEl = document.getElementById("infoTitle");
const infoContentEl = document.getElementById("infoContent");
// citywide thematic map switches
const toggleTotMissions = document.getElementById("toggleTotMissions");
const toggleMis1000p = document.getElementById("toggleMis1000p");
const toggleCemsMedian = document.getElementById("toggleCemsMedian");
// citywide legend elements
const citywideLegendTitle = document.getElementById("citywideLegendTitle");
const citywideLegendItems = document.getElementById("citywideLegendItems");
const citywideLegendNote = document.getElementById("citywideLegendNote");

startButton.addEventListener("click", () => {
  mapScreen.scrollIntoView({ behavior: "smooth" });

  setTimeout(() => {
    mainMap.invalidateSize();
  }, 500);
});

// ----------- MAIN MAP -----------
const mainMap = L.map("map");

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(mainMap);

// ----------- RESULT MAP -----------
const resultMap = L.map("resultMap", {
  zoomControl: true,
  attributionControl: false
});

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20
  }
).addTo(resultMap);

// light basemap without labels for result map

// ----------- DATA STORAGE -----------
let allBezirksregionen;
let allPlanungsraeume;
let allFirestations;

let bezirksregionenLayer;
let planungsraeumeLayer;

let resultBzrLayer;
let resultSelectedPlanungsraumLayer;
let resultFirestationsLayer;

let selectedBzrFeature = null;
let selectedPlanungsraumFeature = null;

let plrStatsData;

// ---------- CITYWIDE MAP STATE ----------
// layer holding all Planungsräume for the thematic map
let citywidePlrLayer;

// currently selected variable for the thematic map
let activeCitywideMetric = "tot_m_25";


// ----------- LOAD DATA -----------
async function loadData() {
  const [
    bezirksregionenRes,
    planungsraeumeRes,
    firestationsRes,
    plrStatsRes
  ] = await Promise.all([
    fetch("data/bezirksregionen.geojson"),
    fetch("data/planungsraeume.geojson"),
    fetch("data/feuerwehr_standorte.geojson"),
    fetch("data/plr_stats_2025.geojson")
  ]);

  allBezirksregionen = await bezirksregionenRes.json();
  allPlanungsraeume = await planungsraeumeRes.json();
  allFirestations = await firestationsRes.json();
  plrStatsData = await plrStatsRes.json();

  // temporary debug check
  console.log("Bezirksregionen loaded:", allBezirksregionen);
  console.log("Planungsraeume loaded:", allPlanungsraeume);
  console.log("Firestations loaded:", allFirestations);
  console.log("PLR stats loaded:", plrStatsData);

  drawBezirksregionen();
  drawCitywideMap();
  // activate the citywide thematic map switches
  setupCitywideSwitches();

  // ensure Leaflet recalculates map size after rendering
setTimeout(() => {
  citywideMap.invalidateSize();
}, 300);
}

// ----------- STEP 1: SHOW ALL BZR -----------
function drawBezirksregionen() {
  selectedBzrFeature = null;
  selectedPlanungsraumFeature = null;

  statusEl.innerHTML = 
  "Do you want to look up where you live? Or where you work? <br>" +
  "Where your kids go to school? Anything is possible.<br>" +
  "<strong>Click on your Bezirksregion:</strong>";
  resetBtn.hidden = true;

  if (bezirksregionenLayer) {
    mainMap.removeLayer(bezirksregionenLayer);
  }

  if (planungsraeumeLayer) {
    mainMap.removeLayer(planungsraeumeLayer);
  }

  bezirksregionenLayer = L.geoJSON(allBezirksregionen, {
    style: {
      color: "#000000ff",
      weight: 2,
      fillColor: "#000000ff",
      fillOpacity: 0.10
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.[BZR_NAME_FIELD] || "Bezirksregion";
      const bzrId = feature.properties?.[BZR_ID_FIELD];

      layer.bindPopup(`<strong>${name}</strong>`);

      // when hovering one Bezirksregion, fade all the others
      layer.on("mouseover", function () {
        bezirksregionenLayer.eachLayer((otherLayer) => {
          if (otherLayer === this) {
            otherLayer.setStyle({
              color: "#000000",   // keep hovered region clearly outlined
              weight: 3,
              fillColor: "#000000",
              fillOpacity: 0.12   // keep its normal low-opacity fill
            });
          } else {
            otherLayer.setStyle({
              color: "#000000",   // keep borders visible
              weight: 0.5,
              fillColor: "#000000",
              fillOpacity: 0.01   // fade all other regions further
            });
          }
        });
      });

// when the mouse leaves, restore all Bezirksregionen to the default style
layer.on("mouseout", function () {
  bezirksregionenLayer.eachLayer((otherLayer) => {
    bezirksregionenLayer.resetStyle(otherLayer);
  });
});

      layer.on("click", function () {
        console.log("Clicked Bezirksregion:", feature.properties);
        selectedBzrFeature = feature;
        showPlanungsraeumeForBzr(feature);
      });
    }
  }).addTo(mainMap);

  mainMap.fitBounds(bezirksregionenLayer.getBounds(), { padding: [20, 20] });
}

// ----------- STEP 2: SHOW PLANUNGSRAEUME INSIDE SELECTED BZR -----------
function showPlanungsraeumeForBzr(clickedBzrFeature) {
  if (bezirksregionenLayer) {
    mainMap.removeLayer(bezirksregionenLayer);
  }

  if (planungsraeumeLayer) {
    mainMap.removeLayer(planungsraeumeLayer);
  }

  const selectedBzrId = clickedBzrFeature.properties?.[BZR_ID_FIELD];
  const selectedBzrName =
    clickedBzrFeature.properties?.[BZR_NAME_FIELD] || "selected Bezirksregion";

  // show selected BZR only
  bezirksregionenLayer = L.geoJSON(clickedBzrFeature, {
    style: {
      color: "#000000ff",
      weight: 0,
      fillColor: "#000000ff",
      fillOpacity: 0
    }
  }).addTo(mainMap);

  const filteredPlanungsraeume = {
    type: "FeatureCollection",
    features: allPlanungsraeume.features.filter(
      (feature) =>
        String(feature.properties?.[PLANUNGSRAUM_BZR_ID_FIELD]) === String(selectedBzrId)
    )
  };

  planungsraeumeLayer = L.geoJSON(filteredPlanungsraeume, {
    style: {
      color: "#E6001A",
      weight: 2,
      fillColor: "#FF1A34",
      fillOpacity: 0.1
    },
    onEachFeature: (feature, layer) => {
      const name =
        feature.properties?.[PLANUNGSRAUM_NAME_FIELD] || "Planungsraum";

      layer.bindPopup(`<strong>${name}</strong>`);

      // when hovering one Planungsraum, fade the others
layer.on("mouseover", function () {
  planungsraeumeLayer.eachLayer((otherLayer) => {
    if (otherLayer === this) {
      otherLayer.setStyle({
        color: "#E6001A",   // keep hovered PLR clearly outlined
        weight: 5,
        fillColor: "#FF1A34",
        fillOpacity: 0.15   // keep its normal low-opacity fill
      });
    } else {
      otherLayer.setStyle({
        color: "#E6001A",   // keep borders visible
        weight: 3,
        fillColor: "#FF1A34",
        fillOpacity: 0.05   // fade all other PLR further
      });
    }
  });
});

// when the mouse leaves, restore all PLR to the default style
layer.on("mouseout", function () {
  planungsraeumeLayer.eachLayer((otherLayer) => {
    planungsraeumeLayer.resetStyle(otherLayer);
  });
});

      layer.on("click", function () {
        console.log("Clicked Planungsraum:", feature.properties);
        selectedPlanungsraumFeature = feature;
        // draw the result map
        showResultMap(feature, clickedBzrFeature);
        // update the right-side statistics panel
        updateInfoPanel(feature);
      });
    }
  }).addTo(mainMap);

  mainMap.fitBounds(bezirksregionenLayer.getBounds(), { padding: [20, 20] });

  statusEl.textContent = `Now select your Planungsraum inside ${selectedBzrName}.`;
  resetBtn.hidden = false;
}

// ----------- STEP 3: SHOW RESULT MAP -----------
function showResultMap(planungsraumFeature, selectedBzrFeature) {
  const selectedBzrId = String(selectedBzrFeature.properties?.[BZR_ID_FIELD]);
  const selectedBzrName =
    selectedBzrFeature.properties?.[BZR_NAME_FIELD] || "selected Bezirksregion";

  // Find neighboring Bezirksregionen:
  // selected one + all that touch/intersect it
  const neighboringBzrFeatures = allBezirksregionen.features.filter((feature) => {
    const featureBzrId = String(feature.properties?.[BZR_ID_FIELD]);

    if (featureBzrId === selectedBzrId) {
      return true;
    }

    try {
      return turf.booleanIntersects(selectedBzrFeature, feature);
    } catch (error) {
      console.error("Neighbor test failed for feature:", feature.properties, error);
      return false;
    }
  });

  const neighboringBzrCollection = {
    type: "FeatureCollection",
    features: neighboringBzrFeatures
  };

  const neighboringBzrIds = neighboringBzrFeatures.map((feature) =>
    String(feature.properties?.[BZR_ID_FIELD])
  );

  // Clear old result layers
  if (resultBzrLayer) {
    resultMap.removeLayer(resultBzrLayer);
  }
  if (resultSelectedPlanungsraumLayer) {
    resultMap.removeLayer(resultSelectedPlanungsraumLayer);
  }

  // Draw neighboring Bezirksregionen
  resultBzrLayer = L.geoJSON(neighboringBzrCollection, {
    style: (feature) => {
      const isSelected =
        String(feature.properties?.[BZR_ID_FIELD]) === selectedBzrId;

      return {
        color: "#000000",
        weight: isSelected ? 3 : .5,
        fillColor: "#000000",
        fillOpacity: isSelected ? .2 : 0
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.[BZR_NAME_FIELD] || "Bezirksregion";
      layer.bindPopup(`<strong>${name}</strong>`);
    }
  }).addTo(resultMap);

  // Draw selected Planungsraum highlighted
  resultSelectedPlanungsraumLayer = L.geoJSON(planungsraumFeature, {
    style: {
      color: "#e6001a",
      weight: 3,
      fillColor: "#FF1A34",
      fillOpacity: 0.45
    },
    onEachFeature: (feature, layer) => {
      const name =
        feature.properties?.[PLANUNGSRAUM_NAME_FIELD] || "Planungsraum";
      layer.bindPopup(`<strong>${name}</strong>`);
    }
  }).addTo(resultMap);

  
  resultMap.fitBounds(resultBzrLayer.getBounds(), { padding: [30, 30] });

  resultStatusEl.textContent =
    `Selected Planungsraum inside ${selectedBzrName} and neighboring Bezirksregionen.`;

  resultScreen.scrollIntoView({ behavior: "smooth" });

  setTimeout(() => {
    resultMap.invalidateSize();
    resultMap.fitBounds(resultBzrLayer.getBounds(), { padding: [30, 30] });
  }, 500);
}

// ---------- FIRE STATIONS ON RESULT MAP ----------
// Adds fire station locations to the result map after the last stat is reached
function showFireStationsOnResultMap(selectedBzrFeature) {
  const selectedBzrId = String(selectedBzrFeature.properties?.[BZR_ID_FIELD]);

  // find the selected Bezirksregion and all touching neighboring Bezirksregionen
  const neighboringBzrFeatures = allBezirksregionen.features.filter((feature) => {
    const featureBzrId = String(feature.properties?.[BZR_ID_FIELD]);

    if (featureBzrId === selectedBzrId) {
      return true;
    }

    try {
      return turf.booleanIntersects(selectedBzrFeature, feature);
    } catch (error) {
      console.error("Neighbor test failed for feature:", feature.properties, error);
      return false;
    }
  });

  // collect their IDs so we can filter fire stations
  const neighboringBzrIds = neighboringBzrFeatures.map((feature) =>
    String(feature.properties?.[BZR_ID_FIELD])
  );

  // keep only the fire stations inside the selected + neighboring Bezirksregionen
  const filteredFirestations = {
    type: "FeatureCollection",
    features: allFirestations.features.filter((feature) =>
      neighboringBzrIds.includes(String(feature.properties?.[FIRESTATION_BZR_ID_FIELD]))
    )
  };

  // clear any previous fire station layer before drawing a new one
  if (resultFirestationsLayer) {
    resultMap.removeLayer(resultFirestationsLayer);
  }

  // draw fire stations as circle markers
  resultFirestationsLayer = L.geoJSON(filteredFirestations, {
    pointToLayer: (feature, latlng) => {
      return L.circleMarker(latlng, {
        radius: 6,
        color: "#000000ff",
        weight: 2,
        fillColor: "#000000ff",
        fillOpacity: 0.9
      });
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.[FIRESTATION_NAME_FIELD] || "Fire station";
      layer.bindPopup(`<strong>${name}</strong>`);
    }
  }).addTo(resultMap);

  // return the number of visible stations so we can use it in the final stat block
  return filteredFirestations.features.length;
}

// ---------- STATS LOOKUP ----------
// Finds the matching record in plr_stats_2025.geojson for the selected Planungsraum
function findStatsForPLR(plrId) {
  return plrStatsData.features.find(
    f => String(f.properties[PLANUNGSRAUM_ID_FIELD]) === String(plrId)
  );
}

// ---------- INFO PANEL ----------
// Updates the right-side panel with statistics for the selected Planungsraum
function updateInfoPanel(planungsraumFeature) {
  const plrId = planungsraumFeature.properties[PLANUNGSRAUM_ID_FIELD];
  const plrName = planungsraumFeature.properties[PLANUNGSRAUM_NAME_FIELD];

  const statsFeature = findStatsForPLR(plrId);

  if (!statsFeature) {
    infoTitleEl.textContent = plrName;
    infoContentEl.innerHTML = "<p>No statistics found.</p>";
    return;
  }

  const stats = statsFeature.properties;

  infoTitleEl.textContent = plrName;

  // show the statistics as separate narrative blocks
infoContentEl.innerHTML = `
  <section class="statSection" id="stat-total">
    <p class="statLead">
      In 2025, a total of
    </p>

    <div class="statBigNumber">${formatInteger(stats[STAT_TOTAL_MISSIONS])}</div>

    <p class="statTrail">
      missions of services provided by the Berliner Feuerwehr were recorded in ${plrName}.
    </p>

    <p class="statNote">The city had a total of 533.072 missions.</p>
    
    <button class="nextStatBtn" data-target="stat-cems">↓</button>
    
  </section>

  <section class="statSection" id="stat-cems">
    <div class="statBigNumber">${formatPercent(stats[STAT_CEMS_PERCENT])}</div>

    <p class="statTrail">
      of all missions were classified as 
        <span class="tooltipTerm">
          critical EMS
          <span class="tooltipBox">
            EMS stands for Emergency Medical Service. It contains all mission where a person is in need of medical assistance. Critical EMS missions are EMS missions of highest priority.
            <br><br>
          </span>
        </span>
      missions.
    </p>

    <p class="statNote">In Berlin, 59,5% of all missions were critical EMS missions in 2025.</p>

    <button class="nextStatBtn" data-target="stat-fire">↓</button>
  </section>

  <section class="statSection" id="stat-fire">
    <p class="statLead">
      In this area,
    </p>

    <div class="statBigNumber">${formatPercent(stats[STAT_FIRE_PERCENT])}</div>

    <p class="statTrail">
      of all recorded missions were fire-related incidents.
    </p>

    <p class="statNote">Only 3,8% of all Berliner Feuerwehr missions in the city had fire at least as a suspected factor. This ranges from smoke detectors going off to structure fires.</p>

    <button class="nextStatBtn" data-target="stat-cems1000">↓</button>
  </section>

  <section class="statSection" id="stat-cems1000">
    <p class="statLead">
      In 2025, there were
    </p>

    <div class="statBigNumber">${formatDecimal(stats[STAT_CEMS_1000P])}</div>

    <p class="statTrail">
      critical EMS missions per 1000 people in ${plrName}.
    </p>

    <p class="statNote">The city had a total of 136,2 missions per 1000 people.</p>

    <button class="nextStatBtn revealStationsBtn">↓</button>
  </section>

  <section class="statSection" id="stat-stations">
    <p class="statLead" id="stationCountLead">
      In and around the Bezirksregion of ${selectedBzrFeature.properties[BZR_NAME_FIELD]}, there are
    </p>

    <div class="statBigNumber" id="stationCountValue">–</div>

    <p class="statTrail" id="stationCountSentence">
      working
    <span class="tooltipTerm">
          fire stations
          <span class="tooltipBox">
            There are three types of fire stations:<br>
            <b>BF:</b> professional fire brigade (Berufsfeuerwehr)<br>
            <b>FF:</b> volunteer fire brigade (Freiwillige Feuerwehr) <br>
            <b>RW or RTW:</b> ambulance/rescue station (Rettungswache)
            <br><br>
          </span>
        </span>.
    </p>

    <p class="statNote">As of 2025, there are 102 fire stations distributed through the city of Berlin.</p>

    <button class="nextStatBtn" data-target="stat-cems-median">↓</button>

  </section>

<section class="statSection" id="stat-cems-median">
  <p class="statLead">
    In ${plrName}, the 
    <span class="tooltipTerm">
      median
      <span class="tooltipBox">
       This means that half of all missions in this Planungsraum were reached in this time or less, and half took longer.
      </span>
    </span>
    response time for critical EMS missions is
  </p>

  <div class="statBigNumber">${formatDecimal(stats[STAT_CEMS_MED_MIN])}</div>

  <p class="statTrail">
    minutes.
  </p>

  <button class="nextSectionBtn" id="berlinOverviewBtn">
    ↓ What about the rest of Berlin?
  </button>

</section>

`;

// activate the final reveal button after the panel HTML has been inserted
setupStationReveal();
// activate arrow navigation after panel content is created
setupStatNavigation();
// activate the button leading to the Berlin-wide section
setupBerlinOverviewButton();

}

// ---------- FINAL REVEAL STEP ----------
// When the user clicks the last arrow, add fire stations to the map and fill the final block
function setupStationReveal() {
  const revealButton = document.querySelector(".revealStationsBtn");

  if (!revealButton) {
    return;
  }

  revealButton.addEventListener("click", () => {
    // add fire stations to the left map and get how many are shown
    const stationCount = showFireStationsOnResultMap(selectedBzrFeature);

    // fill the final stat block with the number of visible stations
    const stationCountValueEl = document.getElementById("stationCountValue");
    const stationCountSentenceEl = document.getElementById("stationCountSentence");
    const stationSectionEl = document.getElementById("stat-stations");

    if (stationCountValueEl) {
      stationCountValueEl.textContent = formatInteger(stationCount);
    }

    if (stationCountSentenceEl) {
  stationCountSentenceEl.innerHTML = `
    working
    <span class="tooltipTerm">
      fire stations
      <span class="tooltipBox">
        There are three types of fire stations:<br>
        <b>BF:</b> professional fire brigade (Berufsfeuerwehr)<br>
        <b>FF:</b> volunteer fire brigade (Freiwillige Feuerwehr)<br>
        <b>RW or RTW:</b> ambulance/rescue station (Rettungswache)<br><br>
        Click on the fire stations in the map to see which type are the ones close to you.
      </span>
    </span>.
  `;
}

    // scroll the page down to the final block
    if (stationSectionEl) {
      stationSectionEl.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}

// ---------- CITYWIDE THEMATIC MAP ----------
// full-width map for Berlin-wide PLR patterns
const citywideMap = L.map("citywideMap", {
  zoomControl: true,
  zoomSnap: 0.1,
  zoomDelta: 0.5
});


// ---------- ARROW NAVIGATION ----------
// makes the arrow buttons scroll to the next stat block
function setupStatNavigation() {

  const buttons = document.querySelectorAll(".nextStatBtn");

  buttons.forEach((button) => {

    button.addEventListener("click", () => {

      const targetId = button.dataset.target;
      const targetEl = document.getElementById(targetId);

      if (targetEl) {
        targetEl.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

    });

  });

}


// ---------- CITYWIDE THEMATIC MAP DRAWING ----------
// draws all Planungsräume using the stats GeoJSON and one active metric
function drawCitywideMap(metricField = activeCitywideMetric) {
  activeCitywideMetric = metricField;
  
  // update the side legend to match the active thematic layer
  updateCitywideLegend(metricField);

  // remove old layer before drawing a new one
  if (citywidePlrLayer) {
    citywideMap.removeLayer(citywidePlrLayer);
  }

  citywidePlrLayer = L.geoJSON(plrStatsData, {
    style: (feature) => {
      const value = feature.properties?.[metricField];

      return {
        color: "#ffffff", // keep borders dark and consistent
        weight: .5,
        fillColor: getCitywideFillColor(value, metricField),
        fillOpacity: 1
      };
    },

    onEachFeature: (feature, layer) => {
      const props = feature.properties;

  // show a metric-specific popup depending on the active layer
  let popupMetricLine = "";

  if (metricField === "tot_m_25") {
    popupMetricLine = `Total missions in 2025: ${formatInteger(props.tot_m_25)}`;
  }

  if (metricField === "mis_1000p") {
    popupMetricLine = `Missions per 1000 people: ${formatDecimal(props.mis_1000p)}`;
  }

  if (metricField === "cems_med_min") {
    popupMetricLine = `Median response time for critical EMS missions: ${formatDecimal(props.cems_med_min)} minutes`;
  }

  layer.bindPopup(`
    <strong>${props.PLR_Name}</strong><br>
    ${popupMetricLine}
  `);
    }
  }).addTo(citywideMap);

  // zoom map to all Planungsräume
  citywideMap.fitBounds(citywidePlrLayer.getBounds(), {
    padding: [20, 20]
  });

  const tighterZoom = citywideMap.getZoom() + 1;  
 

}

// ---------- CITYWIDE CHOROPLETH COLORS ----------
// returns the fill color for each PLR depending on the selected metric
function getCitywideFillColor(value, metricField) {
  // handle missing or invalid values
  if (value === null || value === undefined || isNaN(value)) {
    return "#d9d9d9";
  }

  const numericValue = Number(value);

  // total missions in 2025
  if (metricField === "tot_m_25") {
    if (numericValue <= 500) return "#f2f0f7";
    if (numericValue <= 750) return "#dadaeb";
    if (numericValue <= 1000) return "#bcbddc";
    if (numericValue <= 1250) return "#9e9ac8";
    return "#6a51a3";
  }

  // missions per 1000 people
  if (metricField === "mis_1000p") {
    if (value <= 102) return "#fde0dd";
    if (value <= 120) return "#fbb4b9";
    if (value <= 138) return "#f768a1";
    if (value <= 166) return "#c51b8a";
    return "#7a0177";
  }

  // median response time for critical EMS missions, in minutes
  if (metricField === "cems_med_min") {
    if (numericValue <= 8) return "#fff7bc";
    if (numericValue <= 9) return "#fee391";
    if (numericValue <= 10) return "#fec44f";
    if (numericValue <= 11) return "#fe9929";
    if (numericValue <= 12) return "#ef3b2c";
    return "#bd0026";
  }

  // fallback
  return "#cccccc";
}

// ---------- CITYWIDE LEGEND ----------
// updates the legend according to the selected citywide metric
function updateCitywideLegend(metricField) {
  if (!citywideLegendTitle || !citywideLegendItems) {
    return;
  }

  let title = "";
  let items = [];

  if (metricField === "tot_m_25") {
    title = "Total missions in 2025";
    items = [
      { color: "#f2f0f7", label: "up to 500" },
      { color: "#dadaeb", label: "500 – 750" },
      { color: "#bcbddc", label: "750 – 1000" },
      { color: "#9e9ac8", label: "1000 – 1250" },
      { color: "#6a51a3", label: "1250 or more" }
    ];
  }

  if (metricField === "mis_1000p") {
    title = "Missions per 1.000 people";
    items = [
      { color: "#fde0dd", label: "up to 102" },
      { color: "#fbb4b9", label: "102 – 120" },
      { color: "#f768a1", label: "120 – 138" },
      { color: "#c51b8a", label: "138 – 166" },
      { color: "#7a0177", label: "166 or more" }
    ];
  }

  if (metricField === "cems_med_min") {
    title = "Median response time for critical EMS missions";
    items = [
      { color: "#fff7bc", label: "up to 8 minutes" },
      { color: "#fee391", label: "8 – 9 minutes" },
      { color: "#fec44f", label: "9 – 10 minutes" },
      { color: "#fe9929", label: "10 – 11 minutes" },
      { color: "#ef3b2c", label: "11 – 12 minutes" },
      { color: "#bd0026", label: "12 or more minutes" }
    ];
  }

  citywideLegendTitle.textContent = title;

  citywideLegendItems.innerHTML = items.map((item) => `
    <div class="legendItem">
      <span class="legendSwatch" style="background:${item.color};"></span>
      <span class="legendLabel">${item.label}</span>
    </div>
  `).join("");

  // show explanatory note only for missions per 1000 people
  if (metricField === "mis_1000p") {
    citywideLegendNote.textContent =
      "Some areas have more residents than others. Showing missions per 1.000 people makes it easier to compare how frequent emergencies are across different parts of the city.";
  } else {
    citywideLegendNote.textContent = "";
  }
}

// ---------- CITYWIDE SECTION NAVIGATION ----------
// scrolls to the Berlin-wide section and refreshes the map size
function setupBerlinOverviewButton() {
  const berlinOverviewBtn = document.getElementById("berlinOverviewBtn");
  const citywideMapScreen = document.getElementById("citywideMapScreen");

  if (!berlinOverviewBtn || !citywideMapScreen) {
    return;
  }

  berlinOverviewBtn.addEventListener("click", () => {
    // scroll to the citywide thematic map section
    citywideMapScreen.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    // refresh Leaflet size after scrolling
    setTimeout(() => {
      citywideMap.invalidateSize();
    }, 500);
  });
}

// ---------- CITYWIDE MAP SWITCHES ----------
// only one thematic variable should be active at a time
function setupCitywideSwitches() {
  if (!toggleTotMissions || !toggleMis1000p || !toggleCemsMedian) {
    return;
  }

  // helper to activate one switch and turn the other two off
  function activateSwitch(selected) {
    toggleTotMissions.checked = selected === "tot_m_25";
    toggleMis1000p.checked = selected === "mis_1000p";
    toggleCemsMedian.checked = selected === "cems_med_min";

    // redraw map using the chosen variable
    drawCitywideMap(selected);
  }

  // total missions
  toggleTotMissions.addEventListener("change", () => {
    activateSwitch("tot_m_25");
  });

  // missions per 1000 people
  toggleMis1000p.addEventListener("change", () => {
    activateSwitch("mis_1000p");
  });

  // critical EMS median response time
  toggleCemsMedian.addEventListener("change", () => {
    activateSwitch("cems_med_min");
  });
}

// ---------- HELPER FUNCTIONS ----------
// These are utility functions used by the info panel
// They format numbers so the statistics look clean

function formatInteger(value) {
  // format numbers with thousands separators (German style)
  return Number(value).toLocaleString("de-DE");
}

function formatDecimal(value) {
  // format numbers with one decimal place
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function formatPercent(value) {
  // convert numeric percentage values into readable percent strings
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }) + "%";
}

// ----------- RESET -----------
resetBtn.addEventListener("click", () => {
  drawBezirksregionen();

  mapScreen.scrollIntoView({ behavior: "smooth" });

  setTimeout(() => {
    mainMap.invalidateSize();
  }, 500);
});

// ----------- START -----------
loadData().catch((error) => {
  console.error(error);
  statusEl.textContent =
    "Error loading files. Check filenames, paths, and GeoJSON property names.";
});