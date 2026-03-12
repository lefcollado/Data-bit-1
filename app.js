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

  statusEl.textContent = "Step 1: Click your Bezirksregion.";
  resetBtn.hidden = true;

  if (bezirksregionenLayer) {
    mainMap.removeLayer(bezirksregionenLayer);
  }

  if (planungsraeumeLayer) {
    mainMap.removeLayer(planungsraeumeLayer);
  }

  bezirksregionenLayer = L.geoJSON(allBezirksregionen, {
    style: {
      color: "#333",
      weight: 2,
      fillColor: "#5dade2",
      fillOpacity: 0.45
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
      color: "#1f2d3d",
      weight: 3,
      fillColor: "#85c1e9",
      fillOpacity: 0.25
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
      color: "#b03a2e",
      weight: 2,
      fillColor: "#f5b7b1",
      fillOpacity: 0.55
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

  statusEl.textContent = `Step 2: Click your Planungsraum inside ${selectedBzrName}.`;
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

  // Filter fire stations to those in the selected + neighboring Bezirksregionen
  const filteredFirestations = {
    type: "FeatureCollection",
    features: allFirestations.features.filter((feature) =>
      neighboringBzrIds.includes(String(feature.properties?.[FIRESTATION_BZR_ID_FIELD]))
    )
  };

  // Clear old result layers
  if (resultBzrLayer) {
    resultMap.removeLayer(resultBzrLayer);
  }
  if (resultSelectedPlanungsraumLayer) {
    resultMap.removeLayer(resultSelectedPlanungsraumLayer);
  }
  if (resultFirestationsLayer) {
    resultMap.removeLayer(resultFirestationsLayer);
  }

  // Draw neighboring Bezirksregionen
  resultBzrLayer = L.geoJSON(neighboringBzrCollection, {
    style: (feature) => {
      const isSelected =
        String(feature.properties?.[BZR_ID_FIELD]) === selectedBzrId;

      return {
        color: isSelected ? "#1f2d3d" : "#666",
        weight: isSelected ? 3 : 2,
        fillColor: isSelected ? "#aed6f1" : "#e5e7e9",
        fillOpacity: isSelected ? 0.45 : 0.35
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
      color: "#c0392b",
      weight: 4,
      fillColor: "#f1948a",
      fillOpacity: 0.85
    },
    onEachFeature: (feature, layer) => {
      const name =
        feature.properties?.[PLANUNGSRAUM_NAME_FIELD] || "Planungsraum";
      layer.bindPopup(`<strong>${name}</strong>`);
    }
  }).addTo(resultMap);

  // Draw fire stations
  resultFirestationsLayer = L.geoJSON(filteredFirestations, {
    pointToLayer: (feature, latlng) => {
      return L.circleMarker(latlng, {
        radius: 6,
        color: "#7d3c98",
        weight: 2,
        fillColor: "#af7ac5",
        fillOpacity: 0.9
      });
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.[FIRESTATION_NAME_FIELD] || "Fire station";
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

  infoContentEl.innerHTML = `
    <div class="statBlock">
      <div class="statLabel">Total number of missions</div>
      <div class="statValue">${formatInteger(stats[STAT_TOTAL_MISSIONS])}</div>
    </div>

    <div class="statBlock">
      <div class="statLabel">Percentage of critical EMS missions</div>
      <div class="statValue">${formatPercent(stats[STAT_CEMS_PERCENT])}</div>
    </div>

    <div class="statBlock">
      <div class="statLabel">Percentage of fire missions</div>
      <div class="statValue">${formatPercent(stats[STAT_FIRE_PERCENT])}</div>
    </div>

    <div class="statBlock">
      <div class="statLabel">Critical EMS missions per 1000 people</div>
      <div class="statValue">${formatDecimal(stats[STAT_CEMS_1000P])}</div>
    </div>
  `;
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