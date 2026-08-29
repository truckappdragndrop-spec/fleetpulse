import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCpHKIcovSnpS-O6KTUJDT78ejGvyGZWP8",
  authDomain: "fleetpulse-d1bf6.firebaseapp.com",
  projectId: "fleetpulse-d1bf6",
  storageBucket: "fleetpulse-d1bf6.firebasestorage.app",
  messagingSenderId: "449658354500",
  appId: "1:449658354500:web:4579e0941d599be71a3511",
  measurementId: "G-F9946FER98"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function recalcFuelRecords() {
  console.log("Buscando registros de fuel...");

  const fuelRef = collection(db, "fuelRecords");
  const snapshot = await getDocs(fuelRef);

  const records = [];
  snapshot.forEach(doc => {
    records.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Total de registros: ${records.length}`);

  // Agrupar por truckId
  const byTruck = {};
  records.forEach(r => {
    if (!byTruck[r.truckId]) byTruck[r.truckId] = [];
    byTruck[r.truckId].push(r);
  });

  // Para cada caminhão, ordenar por data e recalcular
  for (const [truckId, truckRecords] of Object.entries(byTruck)) {
    // Ordenar por data (mais antigo primeiro)
    truckRecords.sort((a, b) => new Date(a.fuelDate) - new Date(b.fuelDate));

    let prevKm = 0;

    for (let i = 0; i < truckRecords.length; i++) {
      const record = truckRecords[i];
      const kmAt = Number(record.kmAtRefuel) || 0;
      const gal = Number(record.liters) || 0;

      // Se for o primeiro registro, usar kmPrevious existente ou 0
      if (i === 0) {
        prevKm = Number(record.kmPrevious) || 0;
      } else {
        // kmPrevious = kmAtRefuel do registro anterior
        prevKm = Number(truckRecords[i-1].kmAtRefuel) || 0;
      }

      const miDriven = kmAt - prevKm;
      let mpg = "0";

      if (miDriven > 0 && gal > 0) {
        const rawMpg = miDriven / gal;
        if (rawMpg > 0 && rawMpg < 50) {
          mpg = rawMpg.toFixed(1);
        }
      }

      console.log(`Truck ${truckId} | Data: ${record.fuelDate} | kmAt: ${kmAt} | prev: ${prevKm} | mi: ${miDriven} | gal: ${gal} | MPG: ${mpg}`);

      // Atualizar no Firebase
      const docRef = doc(db, "fuelRecords", record.id);
      await updateDoc(docRef, {
        kmPrevious: String(prevKm),
        kmDriven: miDriven > 0 ? String(miDriven) : "",
        efficiency: mpg
      });
    }
  }

  console.log("\n✅ Recálculo completo!");
}

recalcFuelRecords().catch(console.error);
