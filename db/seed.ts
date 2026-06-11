import { getDb } from "../api/queries/connection";
import { trucks, maintenanceRecords, fuelRecords, driverChecklists } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Insert sample trucks
  const truckData = [
    { fleetId: "TRK-001", plate: "ABC-1234", brand: "Scania", model: "R450", year: 2022, color: "Branco", currentKm: "125000.0", fuelTankCapacity: 500, status: "active" as const, nextMaintenanceDate: "2025-07-15", nextMaintenanceKm: "130000.0" },
    { fleetId: "TRK-002", plate: "DEF-5678", brand: "Volvo", model: "FH 540", year: 2021, color: "Azul", currentKm: "198000.0", fuelTankCapacity: 600, status: "active" as const, nextMaintenanceDate: "2025-06-20", nextMaintenanceKm: "200000.0" },
    { fleetId: "TRK-003", plate: "GHI-9012", brand: "Mercedes-Benz", model: "Actros 2651", year: 2023, color: "Prata", currentKm: "45000.0", fuelTankCapacity: 550, status: "active" as const, nextMaintenanceDate: "2025-08-01", nextMaintenanceKm: "50000.0" },
    { fleetId: "TRK-004", plate: "JKL-3456", brand: "Scania", model: "G410", year: 2020, color: "Vermelho", currentKm: "280000.0", fuelTankCapacity: 450, status: "maintenance" as const, nextMaintenanceDate: "2025-05-10", nextMaintenanceKm: "285000.0" },
    { fleetId: "TRK-005", plate: "MNO-7890", brand: "Iveco", model: "Stralis 480", year: 2021, color: "Branco", currentKm: "156000.0", fuelTankCapacity: 480, status: "active" as const, nextMaintenanceDate: "2025-07-01", nextMaintenanceKm: "160000.0" },
    { fleetId: "TRK-006", plate: "PQR-1234", brand: "Volvo", model: "FM 370", year: 2023, color: "Cinza", currentKm: "32000.0", fuelTankCapacity: 500, status: "active" as const, nextMaintenanceDate: "2025-09-15", nextMaintenanceKm: "40000.0" },
    { fleetId: "TRK-007", plate: "STU-5678", brand: "Mercedes-Benz", model: "Atego 2430", year: 2022, color: "Azul", currentKm: "89000.0", fuelTankCapacity: 350, status: "active" as const, nextMaintenanceDate: "2025-06-30", nextMaintenanceKm: "95000.0" },
    { fleetId: "TRK-008", plate: "VWX-9012", brand: "Scania", model: "P360", year: 2020, color: "Verde", currentKm: "210000.0", fuelTankCapacity: 480, status: "active" as const, nextMaintenanceDate: "2025-07-20", nextMaintenanceKm: "215000.0" },
    { fleetId: "TRK-009", plate: "YZA-3456", brand: "DAF", model: "XF 480", year: 2023, color: "Branco", currentKm: "18000.0", fuelTankCapacity: 620, status: "active" as const, nextMaintenanceDate: "2025-10-01", nextMaintenanceKm: "25000.0" },
    { fleetId: "TRK-010", plate: "BCD-7890", brand: "Volvo", model: "FH 460", year: 2021, color: "Preto", currentKm: "175000.0", fuelTankCapacity: 600, status: "active" as const, nextMaintenanceDate: "2025-06-15", nextMaintenanceKm: "180000.0" },
    { fleetId: "TRK-011", plate: "EFG-1234", brand: "Mercedes-Benz", model: "Axor 3344", year: 2019, color: "Vermelho", currentKm: "310000.0", fuelTankCapacity: 400, status: "active" as const, nextMaintenanceDate: "2025-05-25", nextMaintenanceKm: "315000.0" },
    { fleetId: "TRK-012", plate: "HIJ-5678", brand: "Scania", model: "R500", year: 2023, color: "Prata", currentKm: "25000.0", fuelTankCapacity: 550, status: "active" as const, nextMaintenanceDate: "2025-11-01", nextMaintenanceKm: "30000.0" },
    { fleetId: "TRK-013", plate: "KLM-9012", brand: "Iveco", model: "Hi-Way 560", year: 2022, color: "Azul", currentKm: "67000.0", fuelTankCapacity: 520, status: "inactive" as const, nextMaintenanceDate: "2025-08-15", nextMaintenanceKm: "75000.0" },
    { fleetId: "TRK-014", plate: "NOP-3456", brand: "Volvo", model: "FMX 460", year: 2021, color: "Laranja", currentKm: "142000.0", fuelTankCapacity: 500, status: "active" as const, nextMaintenanceDate: "2025-07-10", nextMaintenanceKm: "150000.0" },
  ];

  for (const truck of truckData) {
    await db.insert(trucks).values(truck);
  }
  console.log(`Inserted ${truckData.length} trucks`);

  // Get truck IDs
  const allTrucks = await db.select().from(trucks);
  const truckMap = new Map(allTrucks.map((t) => [t.fleetId, t.id]));

  // Insert maintenance records
  const maintenanceData = [
    { truckId: truckMap.get("TRK-001")!, maintenanceType: "oil_change" as const, title: "Troca de oleo", scheduledDate: "2025-06-10", scheduledKm: "130000.0", status: "pending" as const, priority: "medium" as const, cost: "850.00" },
    { truckId: truckMap.get("TRK-002")!, maintenanceType: "tire_inspection" as const, title: "Inspecao de pneus", scheduledDate: "2025-06-12", scheduledKm: "200000.0", status: "pending" as const, priority: "high" as const, cost: "1200.00" },
    { truckId: truckMap.get("TRK-004")!, maintenanceType: "brake_check" as const, title: "Revisao de freios", scheduledDate: "2025-05-10", scheduledKm: "285000.0", status: "overdue" as const, priority: "critical" as const, cost: "2500.00", description: "Freios dianteiros com desgaste acentuado" },
    { truckId: truckMap.get("TRK-007")!, maintenanceType: "engine_tuneup" as const, title: "Regulagem de motor", scheduledDate: "2025-06-15", scheduledKm: "95000.0", status: "pending" as const, priority: "medium" as const, cost: "1800.00" },
    { truckId: truckMap.get("TRK-011")!, maintenanceType: "suspension" as const, title: "Revisao de suspensao", scheduledDate: "2025-05-20", scheduledKm: "315000.0", status: "overdue" as const, priority: "high" as const, cost: "3500.00" },
    { truckId: truckMap.get("TRK-014")!, maintenanceType: "filter_replacement" as const, title: "Troca de filtros", scheduledDate: "2025-06-18", scheduledKm: "150000.0", status: "pending" as const, priority: "low" as const, cost: "450.00" },
    { truckId: truckMap.get("TRK-003")!, maintenanceType: "cooling_system" as const, title: "Revisao do sistema de arrefecimento", scheduledDate: "2025-07-01", scheduledKm: "50000.0", status: "pending" as const, priority: "medium" as const, cost: "950.00" },
    { truckId: truckMap.get("TRK-001")!, maintenanceType: "electrical" as const, title: "Revisao eletrica", scheduledDate: "2025-06-20", scheduledKm: "130000.0", status: "pending" as const, priority: "high" as const, cost: "1500.00" },
    { truckId: truckMap.get("TRK-008")!, maintenanceType: "oil_change" as const, title: "Troca de oleo e filtros", scheduledDate: "2025-06-25", scheduledKm: "215000.0", status: "pending" as const, priority: "medium" as const, cost: "900.00" },
    { truckId: truckMap.get("TRK-002")!, maintenanceType: "transmission" as const, title: "Revisao da transmissao", scheduledDate: "2025-07-05", scheduledKm: "200000.0", status: "pending" as const, priority: "high" as const, cost: "2800.00" },
  ];

  for (const record of maintenanceData) {
    await db.insert(maintenanceRecords).values(record);
  }
  console.log(`Inserted ${maintenanceData.length} maintenance records`);

  // Insert fuel records
  const fuelData = [
    { truckId: truckMap.get("TRK-001")!, driverName: "Joao Silva", fuelDate: "2025-05-28", liters: "320.50", pricePerLiter: "5.89", totalCost: "1887.75", kmAtRefuel: "125000.0", kmPrevious: "124200.0", kmDriven: "800.0", efficiency: "2.50", stationName: "Posto Shell BR-101" },
    { truckId: truckMap.get("TRK-002")!, driverName: "Pedro Santos", fuelDate: "2025-05-27", liters: "285.00", pricePerLiter: "5.85", totalCost: "1667.25", kmAtRefuel: "198000.0", kmPrevious: "197350.0", kmDriven: "650.0", efficiency: "2.28", stationName: "Posto Ipiranga" },
    { truckId: truckMap.get("TRK-003")!, driverName: "Carlos Oliveira", fuelDate: "2025-05-28", liters: "210.30", pricePerLiter: "5.92", totalCost: "1244.98", kmAtRefuel: "45000.0", kmPrevious: "44750.0", kmDriven: "250.0", efficiency: "1.19", stationName: "Posto BR" },
    { truckId: truckMap.get("TRK-005")!, driverName: "Miguel Costa", fuelDate: "2025-05-26", liters: "245.80", pricePerLiter: "5.87", totalCost: "1442.85", kmAtRefuel: "156000.0", kmPrevious: "155400.0", kmDriven: "600.0", efficiency: "2.44", stationName: "Posto Petrobras" },
    { truckId: truckMap.get("TRK-006")!, driverName: "Lucas Pereira", fuelDate: "2025-05-28", liters: "195.00", pricePerLiter: "5.90", totalCost: "1150.50", kmAtRefuel: "32000.0", kmPrevious: "31800.0", kmDriven: "200.0", efficiency: "1.03", stationName: "Posto Shell" },
    { truckId: truckMap.get("TRK-007")!, driverName: "Andre Souza", fuelDate: "2025-05-27", liters: "175.20", pricePerLiter: "5.88", totalCost: "1030.18", kmAtRefuel: "89000.0", kmPrevious: "88700.0", kmDriven: "300.0", efficiency: "1.71", stationName: "Posto Ipiranga" },
    { truckId: truckMap.get("TRK-008")!, driverName: "Roberto Lima", fuelDate: "2025-05-26", liters: "310.00", pricePerLiter: "5.86", totalCost: "1816.60", kmAtRefuel: "210000.0", kmPrevious: "209300.0", kmDriven: "700.0", efficiency: "2.26", stationName: "Posto BR" },
    { truckId: truckMap.get("TRK-009")!, driverName: "Felipe Martins", fuelDate: "2025-05-28", liters: "150.50", pricePerLiter: "5.91", totalCost: "889.46", kmAtRefuel: "18000.0", kmPrevious: "17900.0", kmDriven: "100.0", efficiency: "0.66", stationName: "Posto Petrobras" },
    { truckId: truckMap.get("TRK-010")!, driverName: "Ricardo Almeida", fuelDate: "2025-05-27", liters: "290.80", pricePerLiter: "5.89", totalCost: "1712.81", kmAtRefuel: "175000.0", kmPrevious: "174250.0", kmDriven: "750.0", efficiency: "2.58", stationName: "Posto Shell" },
    { truckId: truckMap.get("TRK-014")!, driverName: "Marcos Ferreira", fuelDate: "2025-05-28", liters: "260.40", pricePerLiter: "5.87", totalCost: "1528.55", kmAtRefuel: "142000.0", kmPrevious: "141350.0", kmDriven: "650.0", efficiency: "2.50", stationName: "Posto Ipiranga" },
    { truckId: truckMap.get("TRK-001")!, driverName: "Joao Silva", fuelDate: "2025-05-20", liters: "335.00", pricePerLiter: "5.90", totalCost: "1976.50", kmAtRefuel: "124200.0", kmPrevious: "123400.0", kmDriven: "800.0", efficiency: "2.39", stationName: "Posto BR-101" },
    { truckId: truckMap.get("TRK-002")!, driverName: "Pedro Santos", fuelDate: "2025-05-18", liters: "295.50", pricePerLiter: "5.88", totalCost: "1737.54", kmAtRefuel: "197350.0", kmPrevious: "196700.0", kmDriven: "650.0", efficiency: "2.20", stationName: "Posto Shell" },
    { truckId: truckMap.get("TRK-003")!, driverName: "Carlos Oliveira", fuelDate: "2025-05-15", liters: "200.00", pricePerLiter: "5.91", totalCost: "1182.00", kmAtRefuel: "44750.0", kmPrevious: "44500.0", kmDriven: "250.0", efficiency: "1.25", stationName: "Posto Petrobras" },
  ];

  for (const record of fuelData) {
    await db.insert(fuelRecords).values(record);
  }
  console.log(`Inserted ${fuelData.length} fuel records`);

  // Insert driver checklists
  const today = "2025-06-03";
  const yesterday = "2025-06-02";

  const checklistData = [
    { truckId: truckMap.get("TRK-001")!, driverName: "Joao Silva", checklistDate: today, shift: "morning" as const, kmAtStart: "124800.0", kmAtEnd: "125000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-002")!, driverName: "Pedro Santos", checklistDate: today, shift: "morning" as const, kmAtStart: "197800.0", kmAtEnd: "198000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-003")!, driverName: "Carlos Oliveira", checklistDate: today, shift: "morning" as const, kmAtStart: "44850.0", kmAtEnd: "45000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-005")!, driverName: "Miguel Costa", checklistDate: today, shift: "morning" as const, kmAtStart: "155800.0", kmAtEnd: "156000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-006")!, driverName: "Lucas Pereira", checklistDate: today, shift: "afternoon" as const, kmAtStart: "31850.0", kmAtEnd: "32000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-007")!, driverName: "Andre Souza", checklistDate: today, shift: "morning" as const, kmAtStart: "88800.0", kmAtEnd: "89000.0", tiresOk: true, brakesOk: false, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "issues_reported" as const, issuesFound: true, issuesDescription: "Freios com desgaste leve, recomendado acompanhamento" },
    { truckId: truckMap.get("TRK-008")!, driverName: "Roberto Lima", checklistDate: today, shift: "morning" as const, kmAtStart: "209750.0", kmAtEnd: "210000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-009")!, driverName: "Felipe Martins", checklistDate: today, shift: "afternoon" as const, kmAtStart: "17900.0", kmAtEnd: "18000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-010")!, driverName: "Ricardo Almeida", checklistDate: today, shift: "morning" as const, kmAtStart: "174800.0", kmAtEnd: "175000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-012")!, driverName: "Bruno Castro", checklistDate: today, shift: "morning" as const, kmAtStart: "24800.0", kmAtEnd: "25000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-014")!, driverName: "Marcos Ferreira", checklistDate: today, shift: "morning" as const, kmAtStart: "141800.0", kmAtEnd: "142000.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-001")!, driverName: "Joao Silva", checklistDate: yesterday, shift: "morning" as const, kmAtStart: "124600.0", kmAtEnd: "124800.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
    { truckId: truckMap.get("TRK-002")!, driverName: "Pedro Santos", checklistDate: yesterday, shift: "morning" as const, kmAtStart: "197600.0", kmAtEnd: "197800.0", tiresOk: true, brakesOk: true, lightsOk: true, oilLevelOk: true, coolantLevelOk: true, wipersOk: true, hornOk: true, mirrorsOk: true, seatbeltOk: true, fireExtinguisherOk: true, emergencyKitOk: true, documentsOk: true, status: "completed" as const },
  ];

  for (const checklist of checklistData) {
    await db.insert(driverChecklists).values(checklist);
  }
  console.log(`Inserted ${checklistData.length} checklists`);

  console.log("Seed completed!");
}

seed().catch(console.error);
