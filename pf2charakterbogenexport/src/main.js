(function () {
  "use strict";

  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const dropZoneText = document.getElementById("drop-zone-text");
  const jsonPaste = document.getElementById("json-paste");
  const generateBtn = document.getElementById("generate-btn");
  const sampleBtn = document.getElementById("sample-btn");
  const printBtn = document.getElementById("print-btn");
  const statusMsg = document.getElementById("status-msg");
  const output = document.getElementById("sheet-output");

  let currentFileText = "";

  function setStatus(text, type) {
    statusMsg.textContent = text || "";
    statusMsg.className = "status-msg" + (type ? " " + type : "");
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      currentFileText = String(reader.result || "");
      jsonPaste.value = "";
      dropZoneText.textContent = `Geladen: ${file.name}`;
      setStatus("Datei geladen. Klicke auf „Bogen erzeugen“.", "ok");
    };
    reader.onerror = () => setStatus("Datei konnte nicht gelesen werden.", "error");
    reader.readAsText(file, "utf-8");
  }

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) readFile(file);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  function generateFromText(text) {
    if (!text || !text.trim()) {
      setStatus("Bitte zuerst eine JSON-Datei laden oder JSON einfügen.", "error");
      return;
    }
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      setStatus("Die Datei ist kein gültiges JSON: " + e.message, "error");
      return;
    }
    try {
      const model = window.PF2_PARSER.parseFoundryActor(raw);
      const html = window.PF2_RENDER.render(model);
      output.innerHTML = html;
      printBtn.disabled = false;
      const warnCount = model.warnings.length;
      setStatus(
        warnCount
          ? `Bogen erzeugt (${warnCount} Hinweis${warnCount === 1 ? "" : "e"} – siehe gelben Kasten oben auf dem Bogen).`
          : "Bogen erfolgreich erzeugt.",
        warnCount ? "error" : "ok"
      );
      output.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      console.error(e);
      setStatus("Fehler beim Verarbeiten der Daten: " + e.message, "error");
    }
  }

  generateBtn.addEventListener("click", () => {
    const pasted = jsonPaste.value.trim();
    generateFromText(pasted || currentFileText);
  });

  printBtn.addEventListener("click", () => window.print());

  sampleBtn.addEventListener("click", async () => {
    try {
      setStatus("Lade Beispiel-Charakter…", "");
      const res = await fetch("sample/beispiel-charakter.json");
      const text = await res.text();
      currentFileText = text;
      jsonPaste.value = "";
      dropZoneText.textContent = "Beispiel-Charakter geladen";
      generateFromText(text);
    } catch (e) {
      setStatus("Beispiel konnte nicht geladen werden (nur über einen lokalen Webserver verfügbar, nicht bei file://). Alternativ Datei per Drag & Drop laden.", "error");
    }
  });
})();
