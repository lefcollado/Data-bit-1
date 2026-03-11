const map = L.map("map");

const mapScreen = document.getElementById("mapScreen");
const startButton = document.getElementById("startButton");

startButton.addEventListener("click", () => {
  mapScreen.scrollIntoView({ behavior: "smooth" });

  setTimeout(() => {
    map.invalidateSize();
  }, 500);
});

// Optional basemap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Change these to match your actual property names
const BZR_ID_FIELD = "BZR_ID";
const PLANUNGSRAUM_BZR_ID_FIELD = "BZR_ID";
const BZR_NAME_FIELD = "BZR_Name";
const PLANUNGSRAUM_NAME_FIELD = "PLR_Name";

let bezirksregionenLayer;
let planungsraeumeLayer;
let allBezirksregionen;
let allPlanungsraeume;
let selectedBzrId = null;

const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

async function loadData() {
  const [bezirksregionenRes, planungsraeumeRes] = await Promise.all([
    fetch("data/bezirksregionen.geojson"),
    fetch("data/planungsraeume.geojson")
  ]);

  allBezirksregionen = await bezirksregionenRes.json();
  allPlanungsraeume = await planungsraeumeRes.json();

  drawBezirksregionen();
}

function drawBezirksregionen() {
  if (bezirksregionenLayer) {
    map.removeLayer(bezirksregionenLayer);
  }
  if (planungsraeumeLayer) {
    map.removeLayer(planungsraeumeLayer);
  }

  selectedBzrId = null;
  statusEl.textContent = "Step 1: Click your Bezirksregion.";
  resetBtn.hidden = true;

  bezirksregionenLayer = L.geoJSON(allBezirksregionen, {
    style: {
      color: "#333",
      weight: 2,
      fillColor: "#5dade2",
      fillOpacity: 0.35
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties[BZR_NAME_FIELD] || "Bezirksregion";
      const bzrId = feature.properties[BZR_ID_FIELD];

      layer.bindPopup(`<strong>${name}</strong>`);

      layer.on("mouseover", function () {
        this.setStyle({
          weight: 3,
          fillOpacity: 0.55
        });
      });

      layer.on("mouseout", function () {
        if (selectedBzrId !== bzrId) {
          bezirksregionenLayer.resetStyle(this);
        }
      });

      layer.on("click", function () {
        selectedBzrId = bzrId;
        showPlanungsraeumeForBzr(feature, layer);
      });
    }
  }).addTo(map);

  map.fitBounds(bezirksregionenLayer.getBounds());
}

function showPlanungsraeumeForBzr(clickedBzrFeature, clickedBzrLayer) {
  // Keep only the clicked Bezirksregion visible
  if (bezirksregionenLayer) {
    map.removeLayer(bezirksregionenLayer);
  }

  bezirksregionenLayer = L.geoJSON(clickedBzrFeature, {
    style: {
      color: "#1f2d3d",
      weight: 3,
      fillColor: "#85c1e9",
      fillOpacity: 0.25
    }
  }).addTo(map);

  const selectedBzrId = clickedBzrFeature.properties[BZR_ID_FIELD];
  const selectedBzrName =
    clickedBzrFeature.properties[BZR_NAME_FIELD] || "selected Bezirksregion";

  const filteredPlanungsraeume = {
    type: "FeatureCollection",
    features: allPlanungsraeume.features.filter(
      (feature) =>
        feature.properties[PLANUNGSRAUM_BZR_ID_FIELD] === selectedBzrId
    )
  };

  if (planungsraeumeLayer) {
    map.removeLayer(planungsraeumeLayer);
  }

  planungsraeumeLayer = L.geoJSON(filteredPlanungsraeume, {
    style: {
      color: "#b03a2e",
      weight: 2,
      fillColor: "#f5b7b1",
      fillOpacity: 0.5
    },
    onEachFeature: (feature, layer) => {
      const name =
        feature.properties[PLANUNGSRAUM_NAME_FIELD] || "Planungsraum";
      layer.bindPopup(`<strong>${name}</strong>`);
    }
  }).addTo(map);

  map.fitBounds(clickedBzrLayer.getBounds(), { padding: [20, 20] });

  statusEl.textContent = `Step 2: Showing Planungsräume inside ${selectedBzrName}.`;
  resetBtn.hidden = false;
}

resetBtn.addEventListener("click", drawBezirksregionen);

loadData().catch((error) => {
  console.error(error);
  statusEl.textContent =
    "Error loading GeoJSON files. Check file names and property names.";
});