const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(bodyParser.json());

// Simulăm baza de date cu un fișier JSON
const dataPath = './database/clienti.json';

// Middleware pentru a citi datele din fișierul JSON
function readDataFile() {
  const rawData = fs.readFileSync(dataPath);
  return JSON.parse(rawData);
}

// Middleware pentru a scrie datele în fișierul JSON
function writeDataFile(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}


const programariDataPath = './database/programari.json';

function readProgramariDataFile() {
    try {
        const rawData = fs.readFileSync(programariDataPath);
        let programari = JSON.parse(rawData);
        if (!Array.isArray(programari)) {
            programari = [];
        }
        return programari;
    } catch (error) {
        console.error("Eroare la citirea fisierului programari:", error);
        return [];
    }
}

function writeProgramariDataFile(data) {
    fs.writeFileSync(programariDataPath, JSON.stringify(data, null, 2));
}


//Administrare clienți
// Ruta pentru obținerea tuturor clienților
app.get('/clienti', (req, res) => {
  const clienti = readDataFile();
  res.json(clienti);
});

// Ruta pentru adăugarea unui client nou
app.post('/clienti', (req, res) => {
    const clienti = readDataFile();
  
    // Determinăm lungimea listei actuale de clienți și adăugăm 1 pentru a genera noul ID
    const newClientId = clienti.length + 1;
  
    const newClient = req.body;
    newClient.id = newClientId.toString(); // Convertim ID-ul în șir de caractere
  
    // Rearanjăm ordinea câmpurilor pentru a avea ID-ul înaintea numelui
    const { id, ...rest } = newClient;
    const clientWithIdFirst = { id, ...rest };
  
    clienti.push(clientWithIdFirst);
    writeDataFile(clienti);
    res.json(clientWithIdFirst);
  });
  
  
  
  

// Ruta pentru actualizarea unui client
app.put('/clienti/:id', (req, res) => {
  const clienti = readDataFile();
  const { id } = req.params;
  const updatedClient = req.body;
  const index = clienti.findIndex(client => client.id === id);
  if (index !== -1) {
    clienti[index] = { ...clienti[index], ...updatedClient };
    writeDataFile(clienti);
    res.json(clienti[index]);
  } else {
    res.status(404).send('Clientul nu a fost găsit.');
  }
});

// Ruta pentru dezactivarea unui client
app.delete('/clienti/:id', (req, res) => {
  const clienti = readDataFile();
  const { id } = req.params;
  const index = clienti.findIndex(client => client.id === id);
  if (index !== -1) {
    clienti.splice(index, 1);
    writeDataFile(clienti);
    res.send('Clientul a fost dezactivat.');
  } else {
    res.status(404).send('Clientul nu a fost găsit.');
  }
});


//Programări clienți
// Ruta pentru obținerea tuturor programărilor
app.get('/programari', (req, res) => {
    const programari = readProgramariDataFile(); // Citim programările din fișierul JSON
    res.json(programari); // Returnăm programările în format JSON
});

// Ruta pentru adăugarea unei programări noi
app.post('/programari', (req, res) => {
  const programari = readProgramariDataFile(); // Citim datele din fișierul programari.json
  const { clientId, serieSasiu, actiune, interval } = req.body;

  // Verificăm dacă clientId-ul există în lista de clienți
  const clientExists = readDataFile().some(client => client.id === clientId);
  if (!clientExists) {
      return res.status(404).json({ error: 'Clientul nu există.' });
  }

  // Căutăm mașina corespunzătoare în lista de mașini a clientului în funcție de seria de șasiu
  const client = readDataFile().find(client => client.id === clientId);
  const masina = client.masini.find(masina => masina.serie_sasiu === serieSasiu);
  if (!masina) {
      return res.status(404).json({ error: 'Mașina nu a fost găsită.' });
  }

  // Verificăm dacă toate detaliile necesare pentru programare sunt furnizate
  if (!actiune || !interval || !interval.start || !interval.end) {
      return res.status(400).json({ error: 'Detaliile programării sunt incomplete.' });
  }

  // Verificăm dacă intervalul este în intervalul de funcționare 8-17 și este un multiplu de 30 de minute
  const startTime = new Date(interval.start);
  const endTime = new Date(interval.end);
  const startHour = startTime.getHours();
  const startMinute = startTime.getMinutes();
  const endHour = endTime.getHours();
  const endMinute = endTime.getMinutes();
  if (
      startHour < 8 || startHour > 17 || endHour < 8 || endHour > 17 ||
      startMinute % 30 !== 0 || endMinute % 30 !== 0
  ) {
      return res.status(400).json({ error: 'Intervalul trebuie să fie în intervalul de funcționare 8-17 și să fie un multiplu de 30 de minute.' });
  }

  // Generăm un ID autoincrementat pentru noua programare
  const lastProgramare = programari[programari.length - 1];
  const newProgramareId = lastProgramare ? lastProgramare.id + 1 : 1;

  // Creăm noua programare cu toate detaliile necesare
  const newProgramare = { 
      id: newProgramareId, 
      clientId, 
      serieSasiu, 
      masina, 
      actiune, 
      interval,
      istoricServicii: [] // Inițializăm istoricul serviciilor ca un array gol
  };

  // Adăugăm noua programare în lista de programări
  programari.push(newProgramare);

  // Scriem datele înapoi în fișierul programari.json
  writeProgramariDataFile(programari);
  
  res.json(newProgramare);
});


//Istoric service
// Ruta pentru adăugarea informațiilor în istoricul serviciilor pentru o anumită programare
app.post('/programari/:programareId/istoric', (req, res) => {
  const programareId = parseInt(req.params.programareId);
  const { primireMasina, procesareMasina, durataReparatie } = req.body;

  // Citim lista de programări din fișier
  const programari = readProgramariDataFile();

  // Căutăm programarea corespunzătoare în lista de programări
  const programare = programari.find(programare => programare.id === programareId);
  if (!programare) {
      return res.status(404).json({ error: 'Programarea nu există.' });
  }

  // Adăugăm informațiile despre istoricul serviciilor în programare
  programare.istoricServicii.push({ primireMasina, procesareMasina, durataReparatie });

  // Scriem datele înapoi în fișierul programari.json
  writeProgramariDataFile(programari);
  
  res.json(programare);
});






  app.listen(PORT, () => {
    console.log(`Serverul rulează la adresa http://localhost:${PORT}`);
});