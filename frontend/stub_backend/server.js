// Das ist hier ein Stub für das Backend (für die Dauer der Entwicklung zum Testen)
// Um den Server im Hintergrund laufen zu lassen, das hier ausführen: "node frontend/stub_backend/server.js &"
// Der Server ist dann über localhost:4000 erreichbar (zum Ausprobieren im Browser localhost:4000/api/outdatedWarning eingeben)
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 4000;

app.use(cors());

app.get('/api/data/outdatedWarning', (req, res) => {
    res.json([
        {
            "title": "Emissionsfaktor Strom",
            "last_update": "2022-12-23T18:25:43.511Z"
        },
        {
            "title": "Emissionsfaktor Gas",
            "last_update": "2021-11-30T10:15:30.000Z"
        }
    ]);
});

app.get('/api/measures', (req, res) => {
    res.json([
        {
            "id": "M01",
            "title": "Kommunales Solardach-Programm",
            "popularity": "niedrig",
            "popularityComment": "Photovoltaik auf öffentlichen Gebäuden zerstört das Stadtbild.",
            "shortDescription": "Installation von PV-Anlagen auf Schulen, Rathäusern und Sporthallen.",
            "description": "Die Kommune rüstet geeignete Dachflächen öffentlicher Gebäude mit Photovoltaikanlagen aus. Der erzeugte Strom wird direkt genutzt oder ins Netz eingespeist und senkt langfristig Energiekosten sowie CO₂-Emissionen.",
            "relevantParameters": ["Dachfläche", "Sonneneinstrahlung", "Investitionskosten"],
            "furtherInfo": ["https://www.energieagentur.de", "https://www.klimaschutz.de"],
            "imageURL": "https://images.unsplash.com/photo-1509391366360-2e959784a276"
        },
        {
            "id": "M02",
            "title": "Klimafreundliche Straßenbeleuchtung",
            "popularity": "hoch",
            "popularityComment": "LED-Umrüstung spart sichtbar Energie und Geld.",
            "shortDescription": "Umstellung der Straßenbeleuchtung auf LED-Technik.",
            "description": "Durch den Austausch alter Leuchtmittel gegen moderne LED-Systeme reduziert die Kommune den Stromverbrauch erheblich. Intelligente Steuerungen ermöglichen zusätzlich eine bedarfsgerechte Dimmung.",
            "relevantParameters": ["Stromverbrauch", "Betriebszeiten", "Wartungskosten"],
            "furtherInfo": ["https://www.kommunal-led.de"],
            "imageURL": "https://images.pexels.com/photos/36070367/pexels-photo-36070367.jpeg"
        },
        {
            "id": "M03",
            "title": "Kommunales Radverkehrskonzept",
            "popularity": "hoch",
            "popularityComment": "Förderung des Radverkehrs trifft den Zeitgeist.",
            "shortDescription": "Ausbau sicherer und attraktiver Radwege.",
            "description": "Ein umfassendes Radverkehrskonzept verbessert die Infrastruktur für den Alltagsradverkehr. Neue Radwege, Abstellanlagen und sichere Kreuzungen reduzieren den motorisierten Individualverkehr.",
            "relevantParameters": ["Radwegenetz", "Unfallzahlen", "Pendleranteil"],
            "furtherInfo": ["https://www.adfc.de"],
            "imageURL": "https://images.unsplash.com/photo-1509395176047-4a66953fd231"
        },
        {
            "id": "M04",
            "title": "Energetische Sanierung kommunaler Gebäude",
            "popularity": "mittel",
            "popularityComment": "Langfristig sinnvoll, kurzfristig investitionsintensiv.",
            "shortDescription": "Verbesserung der Energieeffizienz öffentlicher Gebäude.",
            "description": "Durch Dämmung, neue Fenster und moderne Heiztechnik werden kommunale Gebäude energetisch saniert. Dies senkt den Energiebedarf und verbessert das Raumklima.",
            "relevantParameters": ["Energiebedarf", "Gebäudealter", "Sanierungskosten"],
            "furtherInfo": ["https://www.dena.de"],
            "imageURL": "https://images.unsplash.com/photo-1570129477492-45c003edd2be"
        },
        {
            "id": "M05",
            "title": "Förderprogramm für private Solaranlagen",
            "popularity": "hoch",
            "popularityComment": "Finanzielle Anreize erhöhen die Beteiligung.",
            "shortDescription": "Zuschüsse für PV-Anlagen auf privaten Dächern.",
            "description": "Die Kommune unterstützt Bürgerinnen und Bürger finanziell bei der Installation von Photovoltaik- oder Solarthermieanlagen und beschleunigt so den Ausbau erneuerbarer Energien.",
            "relevantParameters": ["Förderhöhe", "Antragszahlen", "Installierte Leistung"],
            "furtherInfo": ["https://www.bafa.de"],
            "imageURL": "https://images.unsplash.com/photo-1592833159155-c62df1b65634"
        },
        {
            "id": "M06",
            "title": "E-Ladesäulen-Netzwerk",
            "popularity": "hoch",
            "popularityComment": "E-Mobilität ist der Zukunftstrend.",
            "shortDescription": "Aufbau öffentlicher Ladeinfrastruktur für Elektrofahrzeuge.",
            "description": "Die Kommune errichtet ein flächendeckendes Netz an Ladestationen für Elektroautos. Dies fördert den Umstieg auf emissionsfreie Mobilität und verbessert die lokale Luftqualität.",
            "relevantParameters": ["Anzahl Ladepunkte", "Standorte", "Auslastung"],
            "furtherInfo": ["https://www.now-gmbh.de"],
            "imageURL": "https://images.unsplash.com/photo-1593941707882-a5bba14938c7"
        },
        {
            "id": "M07",
            "title": "Geothermie-Nahwärmenetz",
            "popularity": "niedrig",
            "popularityComment": "Hohe Anfangsinvestitionen schrecken ab.",
            "shortDescription": "Errichtung eines Nahwärmenetzes mit Geothermienutzung.",
            "description": "Ein geothermisches Nahwärmenetz versorgt mehrere Gebäude zentral mit klimaneutraler Wärme. Die hohen Initialkosten amortisieren sich durch geringe Betriebskosten.",
            "relevantParameters": ["Geologische Eignung", "Anschlussdichte", "Investitionsvolumen"],
            "furtherInfo": ["https://www.geothermie.de"],
            "imageURL": "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e"
        },
        {
            "id": "M08",
            "title": "Carsharing-Programm",
            "popularity": "mittel",
            "popularityComment": "In Städten beliebt, auf dem Land weniger.",
            "shortDescription": "Förderung kommunaler Carsharing-Angebote.",
            "description": "Die Kommune unterstützt Carsharing-Initiativen durch Bereitstellung von Parkflächen und finanziellen Zuschüssen. Dies reduziert den privaten PKW-Bestand.",
            "relevantParameters": ["Fahrzeuganzahl", "Nutzerzahlen", "Verfügbarkeit"],
            "furtherInfo": ["https://www.carsharing.de"],
            "imageURL": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d"
        },
        {
            "id": "M09",
            "title": "Begrünung öffentlicher Plätze",
            "popularity": "hoch",
            "popularityComment": "Grüne Oasen verbessern die Lebensqualität.",
            "shortDescription": "Schaffung neuer Grünflächen und Stadtbäume.",
            "description": "Durch gezielte Bepflanzung öffentlicher Plätze und Straßen verbessert die Kommune das Mikroklima, bindet CO₂ und erhöht die Aufenthaltsqualität.",
            "relevantParameters": ["Flächenverfügbarkeit", "Pflegeaufwand", "Baumbestand"],
            "furtherInfo": ["https://www.stadtgruen.de"],
            "imageURL": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09"
        },
        {
            "id": "M10",
            "title": "Kommunale Windkraftanlage",
            "popularity": "niedrig",
            "popularityComment": "Windräder stoßen oft auf Widerstand.",
            "shortDescription": "Errichtung einer Windkraftanlage im Gemeindegebiet.",
            "description": "Eine kommunale Windkraftanlage erzeugt grünen Strom und schafft Einnahmen durch Stromverkauf. Standortwahl und Bürgerbeteiligung sind entscheidend.",
            "relevantParameters": ["Windpotenzial", "Abstand zur Bebauung", "Akzeptanz"],
            "furtherInfo": ["https://www.wind-energie.de"],
            "imageURL": "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51"
        },
        {
            "id": "M11",
            "title": "Abfallvermeidungs-Kampagne",
            "popularity": "mittel",
            "popularityComment": "Bewusstseinsbildung braucht Zeit.",
            "shortDescription": "Öffentlichkeitskampagne zur Müllreduktion.",
            "description": "Mit Informationskampagnen, Repair-Cafés und Mehrwegsystemen sensibilisiert die Kommune für Abfallvermeidung und fördert die Kreislaufwirtschaft.",
            "relevantParameters": ["Restmüllmenge", "Beteiligung", "Kampagnenbudget"],
            "furtherInfo": ["https://www.nabu.de"],
            "imageURL": "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b"
        },
        {
            "id": "M12",
            "title": "Biogas-Anlage für Grünabfälle",
            "popularity": "mittel",
            "popularityComment": "Sinnvolle Verwertung, aber Standortfrage problematisch.",
            "shortDescription": "Vergärung von Bioabfällen zur Energiegewinnung.",
            "description": "Eine Biogas-Anlage verwertet kommunale Grünabfälle und erzeugt Energie. Der Gärrest dient als hochwertiger Dünger.",
            "relevantParameters": ["Abfallmenge", "Energieertrag", "Standorteignung"],
            "furtherInfo": ["https://www.biogas.org"],
            "imageURL": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449"
        },
        {
            "id": "M13",
            "title": "Smarte Verkehrssteuerung",
            "popularity": "hoch",
            "popularityComment": "Technologie-Optimismus trifft Verkehrswende.",
            "shortDescription": "Intelligente Ampelschaltungen zur Verkehrsflussoptimierung.",
            "description": "Ein smartes Verkehrsmanagementsystem passt Ampelphasen dynamisch an das Verkehrsaufkommen an und reduziert Staus sowie Emissionen.",
            "relevantParameters": ["Verkehrsdichte", "Emissionsreduktion", "Systemkosten"],
            "furtherInfo": ["https://www.smart-city.de"],
            "imageURL": "https://images.unsplash.com/photo-1502444330042-d1a1ddf9bb5b"
        },
        {
            "id": "M14",
            "title": "Regenwasser-Rückhaltesystem",
            "popularity": "mittel",
            "popularityComment": "Klimaanpassung wird wichtiger, aber teuer.",
            "shortDescription": "Bau von Zisternen und Versickerungsflächen.",
            "description": "Durch Regenwasser-Rückhaltung mindert die Kommune Überflutungsrisiken bei Starkregen und nutzt das Wasser für die Bewässerung öffentlicher Grünflächen.",
            "relevantParameters": ["Niederschlagsmenge", "Speichervolumen", "Baukosten"],
            "furtherInfo": ["https://www.regenwasser.de"],
            "imageURL": "https://images.unsplash.com/photo-1547036967-23d11aacaee0"
        },
        {
            "id": "M15",
            "title": "ÖPNV-Takterhöhung",
            "popularity": "hoch",
            "popularityComment": "Bessere Anbindung wird von allen begrüßt.",
            "shortDescription": "Verdichtung des Busfahrplans in Stoßzeiten.",
            "description": "Durch kürzere Taktzeiten im öffentlichen Nahverkehr wird die Attraktivität des ÖPNV gesteigert und der Autoverkehr reduziert.",
            "relevantParameters": ["Fahrgastzahlen", "Taktdichte", "Betriebskosten"],
            "furtherInfo": ["https://www.vdv.de"],
            "imageURL": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957"
        }
    ]);
});

app.get('/api/inputs/parameters', (req, res) => {
    res.json({
        "Allgemein": [
            {
                "id": "population",
                "title": "Bevölkerungszahl",
                "type": "number",
                "unit": "Personen",
                "description": "Lorem ipsum dolor sit amet.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "topography",
                "title": "Topographie",
                "type": "selection",
                "selectable": ["Flach", "Hügelig", "Bergig"],
                "description": "Toporem ipsum dolor sit hügelig",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "areaSize",
                "title": "Flächengröße",
                "type": "number",
                "unit": "km²",
                "description": "Gesamtfläche der Kommune.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "districts",
                "title": "Anzahl der Ortsteile",
                "type": "number",
                "unit": "Ortsteile",
                "description": "Gliederung der Kommune.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "elevation",
                "title": "Durchschnittliche Höhenlage",
                "type": "number",
                "unit": "m ü. NN",
                "description": "Mittlere Höhenlage der Kommune.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "urbanizationRate",
                "title": "Urbanisierungsgrad",
                "type": "number",
                "unit": "%",
                "description": "Anteil urbaner Fläche.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "postalCodes",
                "title": "Anzahl der Postleitzahlen",
                "type": "number",
                "unit": "PLZ",
                "description": "Postleitzahlen innerhalb der Kommune.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "climateZone",
                "title": "Klimazone",
                "type": "selection",
                "selectable": ["Gemäßigt", "Kontinental", "Maritim"],
                "description": "Klimatische Einordnung.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "avgTemperature",
                "title": "Durchschnittstemperatur",
                "type": "number",
                "unit": "°C",
                "description": "Jahresdurchschnittstemperatur.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "annualRainfall",
                "title": "Jährlicher Niederschlag",
                "type": "number",
                "unit": "mm",
                "description": "Mittlere jährliche Niederschlagsmenge.",
                "critical": false,
                "subinputs": []
            }
        ],
        "Energie": [
            {
                "id": "nuclearReactorExists",
                "title": "Kernkraftwerk in der Nähe",
                "type": "bool",
                "description": "Lorem nukleardolor sit amkraft",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "solarCapacity",
                "title": "Installierte Solarleistung",
                "type": "number",
                "unit": "MW",
                "description": "Gesamtleistung der PV-Anlagen.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "windTurbines",
                "title": "Anzahl der Windkraftanlagen",
                "type": "number",
                "unit": "Anlagen",
                "description": "Installierte Windkraftanlagen.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "hydroPlants",
                "title": "Wasserkraftwerke",
                "type": "number",
                "unit": "Anlagen",
                "description": "Anzahl der Wasserkraftwerke.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "biomassPlants",
                "title": "Biomasseanlagen",
                "type": "number",
                "unit": "Anlagen",
                "description": "Installierte Biomasseanlagen.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "annualConsumption",
                "title": "Jährlicher Stromverbrauch",
                "type": "number",
                "unit": "MWh",
                "description": "Gesamtstromverbrauch pro Jahr.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "renewableShare",
                "title": "Anteil erneuerbarer Energien",
                "type": "number",
                "unit": "%",
                "description": "Anteil erneuerbarer Energien am Gesamtmix.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "storageCapacity",
                "title": "Speicherkapazität",
                "type": "number",
                "unit": "MWh",
                "description": "Installierte Energiespeicher.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "districtHeatingExists",
                "title": "Fernwärmenetz vorhanden",
                "type": "bool",
                "description": "Existiert ein kommunales Fernwärmenetz?",
                "critical": false,
                "subinputs": []
            }
        ],
        "Mobilität": [
            {
                "id": "numBusses",
                "title": "Anzahl der Busse im kommunalen Fuhrpark",
                "type": "number",
                "unit": "Busse",
                "description": "Lorem busdolor sit amkommune",
                "critical": false,
                "subinputs": [
                    {
                    "id": "numEletricBusses",
                    "title": "Anzahl der elektrischen Busse",
                    "type": "number",
                    "unit": "Busse",
                    "description": "Lorem elektrum sit ambus",
                    "critical": false
                    },
                    {
                    "id": "numDieselBusses",
                    "title": "Anzahl der Diesel-Busse im kommunalen Fuhrpark",
                    "type": "number",
                    "unit": "Busse",
                    "description": "Lorem diesor sit amet",
                    "critical": false
                    }
                ]
            },
            {
                "id": "tramLines",
                "title": "Straßenbahnlinien",
                "type": "number",
                "unit": "Linien",
                "description": "Anzahl der Straßenbahnlinien.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "trainStations",
                "title": "Bahnhöfe",
                "type": "number",
                "unit": "Bahnhöfe",
                "description": "Anzahl der Bahnhöfe im Gebiet.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "bikeLanes",
                "title": "Länge der Radwege",
                "type": "number",
                "unit": "km",
                "description": "Gesamtlänge der Radwege.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "carSharingStations",
                "title": "Carsharing-Stationen",
                "type": "number",
                "unit": "Stationen",
                "description": "Verfügbare Carsharing-Angebote.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "evChargingStations",
                "title": "E-Ladestationen",
                "type": "number",
                "unit": "Stationen",
                "description": "Öffentliche Ladepunkte.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "airportNearby",
                "title": "Flughafen in der Nähe",
                "type": "bool",
                "description": "Existiert ein Flughafen im Umkreis?",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "trafficVolume",
                "title": "Tägliches Verkehrsaufkommen",
                "type": "number",
                "unit": "Fahrzeuge/Tag",
                "description": "Durchschnittliches Verkehrsaufkommen.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "parkingSpaces",
                "title": "Öffentliche Parkplätze",
                "type": "number",
                "unit": "Parkplätze",
                "description": "Anzahl öffentlicher Stellplätze.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "pedestrianZones",
                "title": "Fußgängerzonen",
                "type": "number",
                "unit": "Zonen",
                "description": "Anzahl ausgewiesener Fußgängerzonen.",
                "critical": false,
                "subinputs": []
            }
        ],
        "Wasser": [
            {
                "id": "waters",
                "title": "Gewässer in der Kommune",
                "type": "multiSelection",
                "selectable": ["Fluss", "See", "Meer"],
                "description": "Lorem ipfluss dolor sit am Meer",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "treatmentPlantExists",
                "title": "Eigene Kläranlage vorhanden",
                "type": "bool",
                "description": "Lorem Abfluss dolor sit amklär",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "waterConsumption",
                "title": "Jährlicher Wasserverbrauch",
                "type": "number",
                "unit": "m³",
                "description": "Gesamtverbrauch pro Jahr.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "groundwaterLevel",
                "title": "Grundwasserspiegel",
                "type": "number",
                "unit": "m",
                "description": "Durchschnittlicher Grundwasserstand.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "floodRisk",
                "title": "Hochwasserrisiko",
                "type": "selection",
                "selectable": ["Niedrig", "Mittel", "Hoch"],
                "description": "Bewertung des Hochwasserrisikos.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "rainwaterUsage",
                "title": "Regenwassernutzung",
                "type": "bool",
                "description": "Gibt es Regenwassernutzungssysteme?",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "waterQualityIndex",
                "title": "Wasserqualitätsindex",
                "type": "number",
                "unit": "Index",
                "description": "Bewertung der Wasserqualität.",
                "critical": true,
                "subinputs": []
            },
            {
                "id": "pipeNetworkLength",
                "title": "Länge des Leitungsnetzes",
                "type": "number",
                "unit": "km",
                "description": "Gesamtlänge des Wassernetzes.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "reservoirs",
                "title": "Wasserspeicher",
                "type": "number",
                "unit": "Anlagen",
                "description": "Anzahl der Speicheranlagen.",
                "critical": false,
                "subinputs": []
            },
            {
                "id": "desalinationPlant",
                "title": "Entsalzungsanlage vorhanden",
                "type": "bool",
                "description": "Existiert eine Meerwasserentsalzungsanlage?",
                "critical": false,
                "subinputs": []
            }
        ]
    });
});

// Würde ich grundsätzlich leer lassen, kann man später zum debuggen kurz was eintragen
app.post('/api/inputs/import', (req, res) => {
    res.json({
        "population": {
            "value": 42,
            "source": "Destatis GENESIS",
            "date": "2024-12-31T10:15:30.000Z",
            "individual": true
        },
    });
});

app.get('/api/inputs/subsidies', (req, res) => {
    res.json([
        {
            "id": "S01",
            "title": "Photovoltaik Ausbau",
        },
        {
            "id": "S02",
            "title": "Anschaffung Elektrobusse",
        },
        {
            "id": "S03",
            "title": "Dachbegrünung",
        }
    ])
});

app.get('/api/communes/search', (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({
      error: 'Missing search query'
    });
  }

  res.json([
        {
            "name": "Karlsruhe",
            "postal_code": "76133",
            "key": "08212000"
        },
        {
            "name": "Karlsbad",
            "postal_code": "36001",
            "key": "08215096"
        },
        {
            "name": "Karlsdorf-Neuthard",
            "postal_code": "76689",
            "key": "08215103"
        }
    ]);
});

app.get('/api/communes/info_by_key/:key', (req, res) => {
    const communityKey = req.params.key;

    if (communityKey != "08212000") {
        return res.status(400).json({
            error: 'Community not found!'
        });
    }

    res.json({
        "name": "Karlsruhe",
        "postal_code": "76133",
        "key": "08212000"
    });
});

app.get('/api/communes/info_by_code/:code', (req, res) => {
    const postal_code = req.params.code;

    if (postal_code != "76133") {
        return res.status(400).json({
            error: 'Community not found!'
        });
    }
    res.json({
        "name": "Karlsruhe",
        "postal_code": "76133",
        "key": "08212000"
    });
});

app.get('/api/communes/:key/prefill', (req, res) => {
    const communityKey = req.params.key;

    if (communityKey != "08212000") {
        return res.status(400).json({
            error: 'Community not found!'
        });
    }
    
    res.json([
        {
            "id": "population",
            "value": 342598,
            "source": "Destatis GENESIS",
            "date": "2024-12-31T10:15:30.000Z",
            "individual": true
        },
        {
            "id": "topography",
            "value": "Flach",
            "source": "Meine Augen",
            "date": "2023-06-01T10:15:30.000Z",
            "individual": true
        },
        {
            "id": "waters",
            "value": ["Fluss", "See"],
            "source": "Google Maps",
            "date": "2024-01-15T10:15:30.000Z",
            "individual": true
        },
        {
            "id": "treatmentPlantExists",
            "value": true,
            "source": "Kommunales Verzeichnis",
            "date": "2022-11-20T10:15:30.000Z",
            "individual": true
        }
    ]);
});

app.get('/api/reference-communes/list', (req, res) => {
    res.json([
        {
            "id": "R1",
            "name": "Wiesenhall",
            "population": 40000,
            "description": "Die Gemeinde Wiesenhall liegt am Kocher und ist daher sehr schön. Genauso wie Schwäbisch Hall. Die historische Altstadt ist geprägt von Fachwerkhäusern und engen Gassen, die zum Flanieren einladen. Besonders im Frühling verwandeln blühende Obstwiesen die Umgebung in ein farbenfrohes Panorama. Entlang des Flusses führen gut ausgebaute Rad- und Wanderwege durch die idyllische Landschaft. Das kulturelle Leben wird durch kleine Theateraufführungen und regionale Musikfeste bereichert. Einmal im Jahr findet ein traditioneller Bauernmarkt statt, der Besucher aus der gesamten Region anzieht. Die Einwohner schätzen die ruhige Atmosphäre und das starke Gemeinschaftsgefühl."
        },
        {
            "id": "R2",
            "name": "Sonnenburg am Neckar",
            "population": 100000,
            "description": "Die Gemeinde Sonnenburg liegt am Neckar und ist daher auch ganz nett. Die weitläufige Uferpromenade lädt zu Spaziergängen mit Blick auf den Fluss ein. Im Sommer finden dort regelmäßig Open-Air-Konzerte und Stadtfeste statt. Die Innenstadt verbindet moderne Architektur mit liebevoll restaurierten Altbauten. Zahlreiche Cafés und Restaurants prägen das lebendige Stadtbild. Ein großer Stadtpark bietet Raum für Sport, Erholung und kulturelle Veranstaltungen. Dank eines florierenden Mittelstands gilt Sonnenburg als wirtschaftlich stabil. Bildungseinrichtungen und ein innovatives Gründerzentrum ziehen junge Menschen an."
        },
        {
            "id": "R3",
            "name": "Unbekannte Beispielkommune",
            "population": 8000,
            "description": "Diese Gemeinde ist aktuell noch nicht verfügbar. ¯\\_(ツ)_/¯ Dennoch besitzt die Beispielkommune eine charmante Ortsmitte mit einem kleinen Marktplatz. Die umliegende Landschaft ist von sanften Hügeln und Feldern geprägt. Ein reges Vereinsleben sorgt für zahlreiche Veranstaltungen im Jahresverlauf. Besonders beliebt ist das jährliche Dorffest mit regionalen Spezialitäten. Die Einwohner engagieren sich stark für Nachhaltigkeit und lokale Projekte. Kleine Handwerksbetriebe prägen die wirtschaftliche Struktur. Für Kinder und Jugendliche stehen moderne Freizeitangebote bereit. Wanderwege und Aussichtspunkte bieten schöne Ausblicke auf die Umgebung. Trotz ihrer geringen Größe überzeugt die Gemeinde durch Zusammenhalt und Lebensqualität."
        }
    ]);
});

app.get('/api/reference-communes/:id', (req, res) => {
    const refCommuneId = req.params.id;
    switch(refCommuneId) {
        case 'R1':
            res.json({
                "id": "R1",
                "name": "Wiesenhall",
                "inputs": [
                    { "id": "population", "value": 40000 },
                    { "id": "topography", "value": "Hügelig" },
                    { "id": "areaSize", "value": 85 },
                    { "id": "districts", "value": 6 },
                    { "id": "elevation", "value": 320 },
                    { "id": "urbanizationRate", "value": 65 },
                    { "id": "postalCodes", "value": 3 },
                    { "id": "climateZone", "value": "Gemäßigt" },
                    { "id": "avgTemperature", "value": 9.8 },
                    { "id": "annualRainfall", "value": 780 },

                    { "id": "nuclearReactorExists", "value": false },
                    { "id": "solarCapacity", "value": 18 },
                    { "id": "windTurbines", "value": 7 },
                    { "id": "hydroPlants", "value": 1 },
                    { "id": "biomassPlants", "value": 2 },
                    { "id": "annualConsumption", "value": 95000 },
                    { "id": "renewableShare", "value": 54 },
                    { "id": "storageCapacity", "value": 12 },
                    { "id": "districtHeatingExists", "value": true },

                    { "id": "numBusses", "value": 16 },
                    { "id": "numEletricBusses", "value": 4 },
                    { "id": "numDieselBusses", "value": 12 },
                    { "id": "tramLines", "value": 2 },
                    { "id": "trainStations", "value": 1 },
                    { "id": "bikeLanes", "value": 48 },
                    { "id": "carSharingStations", "value": 5 },
                    { "id": "evChargingStations", "value": 22 },
                    { "id": "airportNearby", "value": false },
                    { "id": "trafficVolume", "value": 18500 },
                    { "id": "parkingSpaces", "value": 2400 },
                    { "id": "pedestrianZones", "value": 3 },

                    { "id": "waters", "value": ["Fluss"] },
                    { "id": "treatmentPlantExists", "value": true },
                    { "id": "waterConsumption", "value": 2100000 },
                    { "id": "groundwaterLevel", "value": 12 },
                    { "id": "floodRisk", "value": "Mittel" },
                    { "id": "rainwaterUsage", "value": true },
                    { "id": "waterQualityIndex", "value": 82 },
                    { "id": "pipeNetworkLength", "value": 140 },
                    { "id": "reservoirs", "value": 2 },
                    { "id": "desalinationPlant", "value": false }
                ]
            });
            break;
        case 'R2':
            res.json({
                "id": "R2",
                "name": "Sonnenburg am Neckar",
                "inputs": [
                    {
                        "id": "population",
                        "value": 100000
                    },
                    {
                        "id": "topography",
                        "value": "Flach"
                    },
                    {
                        "id": "numBusses",
                        "value": 38
                    },
                    {
                        "id": "waters",
                        "value": ["Fluss", "See"]
                    },
                    {
                        "id": "treatmentPlantExists",
                        "value": true
                    }
                ]
            });
            break;
        case 'R3':
            res.json({
                "id": "R3",
                "name": "Unbekannte Beispielkommune",
                "inputs": [
                    {
                        "id": "population",
                        "value": 8000
                    },
                    {
                        "id": "topography",
                        "value": "Flach"
                    },
                    {
                        "id": "numBusses",
                        "value": 5
                    },
                    {
                        "id": "waters",
                        "value": ["Fluss", "See"]
                    },
                    {
                        "id": "treatmentPlantExists",
                        "value": true
                    }
                ]
            });
            break;
        }
});

app.get('/api/communes/average', (req, res) => {
    res.json([
        {
            "id": "population",
            "value": 42598
        },
        {
            "id": "topography",
            "value": "Hügelig"
        },
        {
            "id": "nuclearReactorExists",
            "value": false
        },
        {
            "id": "numBusses",
            "value": 12
        },
        {
            "id": "numEletricBusses",
            "value": 3
        },
        {
            "id": "numDieselBusses",
            "value": 9
        },
        {
            "id": "waters",
            "value": ["Fluss", "See"]
        },
        {
            "id": "treatmentPlantExists",
            "value": true
        }
    ]);
});

app.post('/api/results/calculate', (req, res) => {
    // Eingabe wird aktuell ignoriert. Für Testzwecke einfach nen switch-case oder sowas einfügen
    res.json({
        "levelOfIndividualisationGeneral": 0.82,
        "levelOfIndividualisationEnergy": 0.42,
        "levelOfIndividualisationMobility": 0.64,
        "levelOfIndividualisationWater": 0.64,
        "levelOfIndividualisationTotal": 0.95,
        "measureResults": [
            {
                "measureId": "M01",
                "timeScore": 35,
                "costScore": 25,
                "climateScore": 82,
                "timeScale": 4,
                "costScale": 4,
                "climateScale": 4,
                "time": 240,
                "investmentCost": 80000,
                "ongoingCost": -1200,
                "totalCost": 95000,
                "onetimeEmissionSavings": 450,
                "ongoingEmissionSavings": 3500
            },
            {
                "measureId": "M02",
                "timeScore": 85,
                "costScore": 90,
                "climateScore": 42,
                "timeScale": 1,
                "costScale": 1,
                "climateScale": 2,
                "time": 45,
                "investmentCost": 3500,
                "ongoingCost": -800,
                "totalCost": 5000,
                "onetimeEmissionSavings": 80,
                "ongoingEmissionSavings": 950
            },
            {
                "measureId": "M03",
                "timeScore": 25,
                "costScore": 18,
                "climateScore": 68,
                "timeScale": 5,
                "costScale": 4,
                "climateScale": 3,
                "time": 360,
                "investmentCost": 120000,
                "ongoingCost": 2500,
                "totalCost": 145000,
                "onetimeEmissionSavings": 280,
                "ongoingEmissionSavings": 2800
            },
            {
                "measureId": "M04",
                "timeScore": 40,
                "costScore": 15,
                "climateScore": 88,
                "timeScale": 4,
                "costScale": 4,
                "climateScale": 5,
                "time": 210,
                "investmentCost": 250000,
                "ongoingCost": -3500,
                "totalCost": 280000,
                "onetimeEmissionSavings": 600,
                "ongoingEmissionSavings": 4200
            },
            {
                "measureId": "M05",
                "timeScore": 75,
                "costScore": 55,
                "climateScore": 72,
                "timeScale": 2,
                "costScale": 3,
                "climateScale": 4,
                "time": 90,
                "investmentCost": 45000,
                "ongoingCost": -500,
                "totalCost": 52000,
                "onetimeEmissionSavings": 320,
                "ongoingEmissionSavings": 3100
            },
            {
                "measureId": "M06",
                "timeScore": 50,
                "costScore": 30,
                "climateScore": 78,
                "timeScale": 3,
                "costScale": 4,
                "climateScale": 4,
                "time": 150,
                "investmentCost": 95000,
                "ongoingCost": -1500,
                "totalCost": 110000,
                "onetimeEmissionSavings": 380,
                "ongoingEmissionSavings": 3400
            },
            {
                "measureId": "M07",
                "timeScore": 18,
                "costScore": 12,
                "climateScore": 95,
                "timeScale": 5,
                "costScale": 4,
                "climateScale": 5,
                "time": 420,
                "investmentCost": 450000,
                "ongoingCost": -5000,
                "totalCost": 500000,
                "onetimeEmissionSavings": 800,
                "ongoingEmissionSavings": 5500
            },
            {
                "measureId": "M08",
                "timeScore": 80,
                "costScore": 65,
                "climateScore": 52,
                "timeScale": 2,
                "costScale": 2,
                "climateScale": 2,
                "time": 75,
                "investmentCost": 38000,
                "ongoingCost": 800,
                "totalCost": 48000,
                "onetimeEmissionSavings": 150,
                "ongoingEmissionSavings": 1400
            },
            {
                "measureId": "M09",
                "timeScore": 92,
                "costScore": 88,
                "climateScore": 35,
                "timeScale": 1,
                "costScale": 1,
                "climateScale": 1,
                "time": 30,
                "investmentCost": 8000,
                "ongoingCost": 600,
                "totalCost": 12000,
                "onetimeEmissionSavings": 45,
                "ongoingEmissionSavings": 580
            },
            {
                "measureId": "M10",
                "timeScore": 22,
                "costScore": 15,
                "climateScore": 92,
                "timeScale": 5,
                "costScale": 4,
                "climateScale": 5,
                "time": 390,
                "investmentCost": 380000,
                "ongoingCost": -4200,
                "totalCost": 420000,
                "onetimeEmissionSavings": 720,
                "ongoingEmissionSavings": 5200
            },
            {
                "measureId": "M11",
                "timeScore": 95,
                "costScore": 98,
                "climateScore": 38,
                "timeScale": 1,
                "costScale": 1,
                "climateScale": 1,
                "time": 20,
                "investmentCost": 3000,
                "ongoingCost": 200,
                "totalCost": 4500,
                "onetimeEmissionSavings": 35,
                "ongoingEmissionSavings": 620
            },
            {
                "measureId": "M12",
                "timeScore": 45,
                "costScore": 35,
                "climateScore": 80,
                "timeScale": 3,
                "costScale": 4,
                "climateScale": 4,
                "time": 180,
                "investmentCost": 110000,
                "ongoingCost": -2000,
                "totalCost": 125000,
                "onetimeEmissionSavings": 420,
                "ongoingEmissionSavings": 3600
            },
            {
                "measureId": "M13",
                "timeScore": 70,
                "costScore": 50,
                "climateScore": 58,
                "timeScale": 2,
                "costScale": 3,
                "climateScale": 3,
                "time": 105,
                "investmentCost": 62000,
                "ongoingCost": 1200,
                "totalCost": 75000,
                "onetimeEmissionSavings": 220,
                "ongoingEmissionSavings": 2200
            },
            {
                "measureId": "M14",
                "timeScore": 55,
                "costScore": 40,
                "climateScore": 48,
                "timeScale": 3,
                "costScale": 4,
                "climateScale": 2,
                "time": 165,
                "investmentCost": 88000,
                "ongoingCost": 1800,
                "totalCost": 105000,
                "onetimeEmissionSavings": 180,
                "ongoingEmissionSavings": 1600
            },
            {
                "measureId": "M15",
                "timeScore": 88,
                "costScore": 45,
                "climateScore": 65,
                "timeScale": 1,
                "costScale": 3,
                "climateScale": 3,
                "time": 40,
                "investmentCost": 55000,
                "ongoingCost": 3500,
                "totalCost": 72000,
                "onetimeEmissionSavings": 260,
                "ongoingEmissionSavings": 2500
            }
        ]
    });
});

// conflict, neutral, synergy, dependency, prerequisite
app.get('/api/results/graph', (req, res) => {
    res.json([
        {
            "from": "M01",
            "to": "M02",
            "type": "prerequisite"
        },
        {
            "from": "M02",
            "to": "M01",
            "type": "dependency"
        },
        {
            "from": "M01",
            "to": "M05",
            "type": "synergy"
        },
        {
            "from": "M02",
            "to": "M06",
            "type": "prerequisite"
        },
        {
            "from": "M06",
            "to": "M02",
            "type": "dependency"
        },
        {
            "from": "M02",
            "to": "M04",
            "type": "conflict"
        },
        {
            "from": "M03",
            "to": "M08",
            "type": "synergy"
        },
        {
            "from": "M03",
            "to": "M13",
            "type": "synergy"
        },
        {
            "from": "M04",
            "to": "M01",
            "type": "synergy"
        },
        {
            "from": "M04",
            "to": "M07",
            "type": "prerequisite"
        },
        {
            "from": "M07",
            "to": "M04",
            "type": "dependency"
        },
        {
            "from": "M05",
            "to": "M01",
            "type": "synergy"
        },
        {
            "from": "M06",
            "to": "M08",
            "type": "conflict"
        },
        {
            "from": "M06",
            "to": "M15",
            "type": "synergy"
        },
        {
            "from": "M07",
            "to": "M10",
            "type": "conflict"
        },
        {
            "from": "M08",
            "to": "M15",
            "type": "synergy"
        },
        {
            "from": "M09",
            "to": "M14",
            "type": "synergy"
        },
        {
            "from": "M10",
            "to": "M01",
            "type": "synergy"
        },
        {
            "from": "M11",
            "to": "M12",
            "type": "prerequisite"
        },
        {
            "from": "M12",
            "to": "M11",
            "type": "dependency"
        },
        {
            "from": "M12",
            "to": "M09",
            "type": "synergy"
        },
        {
            "from": "M13",
            "to": "M15",
            "type": "synergy"
        },
        {
            "from": "M14",
            "to": "M09",
            "type": "synergy"
        },
        {
            "from": "M15",
            "to": "M03",
            "type": "synergy"
        },
    ]);
});

app.listen(PORT, () => {
  console.log(`Stub backend running at http://localhost:${PORT}`);
});