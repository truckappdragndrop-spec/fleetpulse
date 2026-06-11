import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

const truckData = [
  { fleetId: "TRK-001", plate: "ABC-1234", brand: "Scania", model: "R450", year: 2022, color: "White", currentKm: "77670.0", fuelTankCapacity: 132, status: "active" as const },
  { fleetId: "TRK-002", plate: "DEF-5678", brand: "Volvo", model: "FH 540", year: 2021, color: "Blue", currentKm: "123000.0", fuelTankCapacity: 158, status: "active" as const },
  { fleetId: "TRK-003", plate: "GHI-9012", brand: "Mercedes-Benz", model: "Actros 2651", year: 2023, color: "Silver", currentKm: "27960.0", fuelTankCapacity: 145, status: "active" as const },
  { fleetId: "TRK-004", plate: "JKL-3456", brand: "Scania", model: "G410", year: 2020, color: "Red", currentKm: "174000.0", fuelTankCapacity: 119, status: "maintenance" as const },
  { fleetId: "TRK-005", plate: "MNO-7890", brand: "Iveco", model: "Stralis 480", year: 2021, color: "White", currentKm: "96900.0", fuelTankCapacity: 127, status: "active" as const },
  { fleetId: "TRK-006", plate: "PQR-1234", brand: "Volvo", model: "FM 370", year: 2023, color: "Gray", currentKm: "19880.0", fuelTankCapacity: 132, status: "active" as const },
  { fleetId: "TRK-007", plate: "STU-5678", brand: "Mercedes-Benz", model: "Atego 2430", year: 2022, color: "Blue", currentKm: "55300.0", fuelTankCapacity: 92, status: "active" as const },
  { fleetId: "TRK-008", plate: "VWX-9012", brand: "Scania", model: "P360", year: 2020, color: "Green", currentKm: "130500.0", fuelTankCapacity: 127, status: "active" as const },
  { fleetId: "TRK-009", plate: "YZA-3456", brand: "DAF", model: "XF 480", year: 2023, color: "White", currentKm: "11180.0", fuelTankCapacity: 164, status: "active" as const },
  { fleetId: "TRK-010", plate: "BCD-7890", brand: "Volvo", model: "FH 460", year: 2021, color: "Black", currentKm: "108700.0", fuelTankCapacity: 158, status: "active" as const },
  { fleetId: "TRK-011", plate: "EFG-1234", brand: "Mercedes-Benz", model: "Axor 3344", year: 2019, color: "Red", currentKm: "192600.0", fuelTankCapacity: 106, status: "active" as const },
  { fleetId: "TRK-012", plate: "HIJ-5678", brand: "Scania", model: "R500", year: 2023, color: "Silver", currentKm: "15530.0", fuelTankCapacity: 145, status: "active" as const },
  { fleetId: "TRK-013", plate: "KLM-9012", brand: "Iveco", model: "Hi-Way 560", year: 2022, color: "Blue", currentKm: "41630.0", fuelTankCapacity: 137, status: "inactive" as const },
  { fleetId: "TRK-014", plate: "NOP-3456", brand: "Volvo", model: "FMX 460", year: 2021, color: "Orange", currentKm: "88200.0", fuelTankCapacity: 132, status: "active" as const },
];

const maintData = [
  { fleetId: "TRK-001", truckBrand: "Scania", truckModel: "R450", maintenanceType: "oil_change", title: "Oil Change - 100k", scheduledDate: "2025-06-10", scheduledKm: "80780", status: "pending", priority: "medium", cost: "850.00" },
  { fleetId: "TRK-002", truckBrand: "Volvo", truckModel: "FH 540", maintenanceType: "tire_inspection", title: "Tire Inspection", scheduledDate: "2025-06-12", scheduledKm: "124280", status: "pending", priority: "high", cost: "1200.00" },
  { fleetId: "TRK-004", truckBrand: "Scania", truckModel: "G410", maintenanceType: "brake_check", title: "Brake Service", scheduledDate: "2025-05-10", scheduledKm: "177000", status: "overdue", priority: "critical", cost: "2500.00", description: "Front brakes showing significant wear" },
  { fleetId: "TRK-007", truckBrand: "Mercedes-Benz", truckModel: "Atego 2430", maintenanceType: "engine_tuneup", title: "Engine Tune-up", scheduledDate: "2025-06-15", scheduledKm: "59000", status: "pending", priority: "medium", cost: "1800.00" },
  { fleetId: "TRK-011", truckBrand: "Mercedes-Benz", truckModel: "Axor 3344", maintenanceType: "suspension", title: "Suspension Check", scheduledDate: "2025-05-20", scheduledKm: "195700", status: "overdue", priority: "high", cost: "3500.00" },
  { fleetId: "TRK-014", truckBrand: "Volvo", truckModel: "FMX 460", maintenanceType: "filter_replacement", title: "Filter Replacement", scheduledDate: "2025-06-18", scheduledKm: "93200", status: "pending", priority: "low", cost: "450.00" },
  { fleetId: "TRK-003", truckBrand: "Mercedes-Benz", truckModel: "Actros 2651", maintenanceType: "cooling_system", title: "Cooling System Service", scheduledDate: "2025-07-01", scheduledKm: "31070", status: "pending", priority: "medium", cost: "950.00" },
  { fleetId: "TRK-001", truckBrand: "Scania", truckModel: "R450", maintenanceType: "electrical", title: "Electrical Check", scheduledDate: "2025-06-20", scheduledKm: "80780", status: "pending", priority: "high", cost: "1500.00" },
  { fleetId: "TRK-008", truckBrand: "Scania", truckModel: "P360", maintenanceType: "oil_change", title: "Oil & Filter Change", scheduledDate: "2025-06-25", scheduledKm: "133600", status: "pending", priority: "medium", cost: "900.00" },
  { fleetId: "TRK-002", truckBrand: "Volvo", truckModel: "FH 540", maintenanceType: "transmission", title: "Transmission Service", scheduledDate: "2025-07-05", scheduledKm: "124280", status: "pending", priority: "high", cost: "2800.00" },
];

const fuelData = [
  { fleetId: "TRK-001", truckBrand: "Scania", truckModel: "R450", driverName: "John Smith", fuelDate: "2025-05-28", liters: "84.6", pricePerLiter: "3.89", totalCost: "328.75", kmAtRefuel: "77670.0", kmPrevious: "77170.0", kmDriven: "500.0", efficiency: "5.9", stationName: "Shell I-95" },
  { fleetId: "TRK-002", truckBrand: "Volvo", truckModel: "FH 540", driverName: "Peter Santos", fuelDate: "2025-05-27", liters: "75.3", pricePerLiter: "3.87", totalCost: "291.10", kmAtRefuel: "123000.0", kmPrevious: "122600.0", kmDriven: "400.0", efficiency: "5.3", stationName: "Pilot Flying J" },
  { fleetId: "TRK-003", truckBrand: "Mercedes-Benz", truckModel: "Actros 2651", driverName: "Carlos Oliveira", fuelDate: "2025-05-28", liters: "55.5", pricePerLiter: "3.91", totalCost: "216.95", kmAtRefuel: "27960.0", kmPrevious: "27810.0", kmDriven: "150.0", efficiency: "2.7", stationName: "BP Truck Stop" },
  { fleetId: "TRK-005", truckBrand: "Iveco", truckModel: "Stralis 480", driverName: "Mike Costa", fuelDate: "2025-05-26", liters: "64.9", pricePerLiter: "3.88", totalCost: "251.82", kmAtRefuel: "96900.0", kmPrevious: "96530.0", kmDriven: "370.0", efficiency: "5.7", stationName: "Petro" },
  { fleetId: "TRK-006", truckBrand: "Volvo", truckModel: "FM 370", driverName: "Luke Pereira", fuelDate: "2025-05-28", liters: "51.5", pricePerLiter: "3.90", totalCost: "200.85", kmAtRefuel: "19880.0", kmPrevious: "19760.0", kmDriven: "120.0", efficiency: "2.3", stationName: "Shell" },
  { fleetId: "TRK-007", truckBrand: "Mercedes-Benz", truckModel: "Atego 2430", driverName: "Andre Souza", fuelDate: "2025-05-27", liters: "46.3", pricePerLiter: "3.88", totalCost: "179.54", kmAtRefuel: "55300.0", kmPrevious: "55120.0", kmDriven: "180.0", efficiency: "3.9", stationName: "Pilot" },
  { fleetId: "TRK-008", truckBrand: "Scania", truckModel: "P360", driverName: "Robert Lima", fuelDate: "2025-05-26", liters: "81.9", pricePerLiter: "3.86", totalCost: "316.13", kmAtRefuel: "130500.0", kmPrevious: "130070.0", kmDriven: "430.0", efficiency: "5.3", stationName: "Love's" },
  { fleetId: "TRK-009", truckBrand: "DAF", truckModel: "XF 480", driverName: "Felipe Martins", fuelDate: "2025-05-28", liters: "39.8", pricePerLiter: "3.91", totalCost: "155.62", kmAtRefuel: "11180.0", kmPrevious: "11120.0", kmDriven: "60.0", efficiency: "1.5", stationName: "TA Petro" },
  { fleetId: "TRK-010", truckBrand: "Volvo", truckModel: "FH 460", driverName: "Richard Almeida", fuelDate: "2025-05-27", liters: "76.8", pricePerLiter: "3.89", totalCost: "298.75", kmAtRefuel: "108700.0", kmPrevious: "108240.0", kmDriven: "460.0", efficiency: "6.0", stationName: "Shell" },
  { fleetId: "TRK-014", truckBrand: "Volvo", truckModel: "FMX 460", driverName: "Marcos Ferreira", fuelDate: "2025-05-28", liters: "68.8", pricePerLiter: "3.87", totalCost: "266.26", kmAtRefuel: "88200.0", kmPrevious: "87800.0", kmDriven: "400.0", efficiency: "5.8", stationName: "Pilot" },
];

export async function seedFirestore() {
  console.log("Seeding Firestore...");

  for (const truck of truckData) {
    await addDoc(collection(db, "trucks"), { ...truck, createdAt: new Date(), updatedAt: new Date() });
  }
  console.log(`Inserted ${truckData.length} trucks`);

  for (const maint of maintData) {
    await addDoc(collection(db, "maintenance"), { ...maint, createdAt: new Date(), updatedAt: new Date() });
  }
  console.log(`Inserted ${maintData.length} maintenance records`);

  for (const fuel of fuelData) {
    await addDoc(collection(db, "fuelRecords"), { ...fuel, createdAt: new Date() });
  }
  console.log(`Inserted ${fuelData.length} fuel records`);

  console.log("Seed complete!");
}
