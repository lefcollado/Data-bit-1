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
}

// ----------- STEP 1: SHOW ALL BZR -----------
function drawBezirksregionen() {
  selectedBzrFeature = null;
  selectedPlanungsraumFeature = null;

  statusEl.textContent = "Do you want to look up where you live? Or where you work? Where your kids go to school? Anything is possible. Click on your Bezirksregion.";
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

      layer.on("mouseover", function () {
        this.setStyle({
          weight: 3,
          fillOpacity: 0.7
        });
      });

      layer.on("mouseout", function () {
        bezirksregionenLayer.resetStyle(this);
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
      fillOpacity: 0.15
    },
    onEachFeature: (feature, layer) => {
      const name =
        feature.properties?.[PLANUNGSRAUM_NAME_FIELD] || "Planungsraum";

      layer.bindPopup(`<strong>${name}</strong>`);

      layer.on("mouseover", function () {
        this.setStyle({
          weight: 3,
          fillOpacity: 0.8
        });
      });

      layer.on("mouseout", function () {
        planungsraeumeLayer.resetStyle(this);
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
        color: isSelected ? "#000000ff" : "#000000ff",
        weight: isSelected ? 3 : 1,
        fillColor: isSelected ? "#000000ff" : "#e5e7e9",
        fillOpacity: isSelected ? 0.25 : 0
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
      weight: 4,
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
    `Selected Planungsraum shown inside ${selectedBzrName} and neighboring Bezirksregionen, with fire station locations.`;

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
      working fire stations.
    </p>

    <p class="statNote">As of 2025, there are 102 fire stations distributed through the city of Berlin.</p>

  </section>
`;

// activate the final reveal button after the panel HTML has been inserted
setupStationReveal();
// activate arrow navigation after panel content is created
setupStatNavigation();

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
      stationCountSentenceEl.textContent =
        `working fire stations.`;
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