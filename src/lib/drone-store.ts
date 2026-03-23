export interface Drone {
  id: number;
  name: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  status: 'Idle' | 'Maintenance' | 'Active' | 'Offline';
}

export interface Prediction {
  id: number;
  droneId: number;
  name: string;
  uploadedAt: string;
  videoUrl: string;
  hasResult: boolean;
  result?: {
    detections: { label: string; confidence: number; x: number; y: number }[];
    feedback?: { accurate: boolean; comment: string };
  };
}

const DRONES_KEY = 'dd_drones';
const PREDICTIONS_KEY = 'dd_predictions';

function getInitialDrones(): Drone[] {
  return [
    { id: 1, name: 'Drone1', serialNumber: 'SN-001', model: 'DJI Mavic 3', firmwareVersion: 'v2.0.3', status: 'Idle' },
    { id: 2, name: 'Drone2', serialNumber: 'SN-002', model: 'DJI Phantom 4', firmwareVersion: 'v1.5.1', status: 'Maintenance' },
  ];
}

export function getDrones(): Drone[] {
  const data = localStorage.getItem(DRONES_KEY);
  if (!data) {
    const initial = getInitialDrones();
    localStorage.setItem(DRONES_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
}

export function saveDrones(drones: Drone[]) {
  localStorage.setItem(DRONES_KEY, JSON.stringify(drones));
}

export function addDrone(drone: Omit<Drone, 'id'>): Drone {
  const drones = getDrones();
  const newDrone = { ...drone, id: Date.now() };
  drones.push(newDrone);
  saveDrones(drones);
  return newDrone;
}

export function updateDrone(id: number, updates: Partial<Drone>) {
  const drones = getDrones();
  const idx = drones.findIndex(d => d.id === id);
  if (idx !== -1) {
    drones[idx] = { ...drones[idx], ...updates };
    saveDrones(drones);
  }
}

export function deleteDrone(id: number) {
  saveDrones(getDrones().filter(d => d.id !== id));
}

export function getDrone(id: number): Drone | undefined {
  return getDrones().find(d => d.id === id);
}

export function getPredictions(droneId: number): Prediction[] {
  const data = localStorage.getItem(PREDICTIONS_KEY);
  const all: Prediction[] = data ? JSON.parse(data) : [];
  return all.filter(p => p.droneId === droneId);
}

export function addPrediction(prediction: Omit<Prediction, 'id'>): Prediction {
  const data = localStorage.getItem(PREDICTIONS_KEY);
  const all: Prediction[] = data ? JSON.parse(data) : [];
  const newP = { ...prediction, id: Date.now() };
  all.push(newP);
  localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(all));
  return newP;
}

export function deletePrediction(id: number) {
  const data = localStorage.getItem(PREDICTIONS_KEY);
  const all: Prediction[] = data ? JSON.parse(data) : [];
  localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(all.filter(p => p.id !== id)));
}

export function getPrediction(id: number): Prediction | undefined {
  const data = localStorage.getItem(PREDICTIONS_KEY);
  const all: Prediction[] = data ? JSON.parse(data) : [];
  return all.find(p => p.id === id);
}
