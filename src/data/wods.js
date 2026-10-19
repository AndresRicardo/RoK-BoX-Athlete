export const WOD_TYPE_LABELS = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  max: 'Max',
  unknown: 'Personalizado',
};

export const WOD_CATALOG = [
  { name: 'Fran', type: 'for_time', description: '21-15-9 Thrusters y Pull-ups' },
  { name: 'Helen', type: 'for_time', description: '3 Rondas: 400m run, 21 KB swings, 12 pull-ups' },
  { name: 'Grace', type: 'for_time', description: '30 Clean & Jerks' },
  { name: 'Isabel', type: 'for_time', description: '30 Snatches' },
  { name: 'Diane', type: 'for_time', description: '21-15-9 Deadlifts y HSPU' },
  { name: 'Elizabeth', type: 'for_time', description: '21-15-9 Squat Cleans y Ring Dips' },
  { name: 'Nancy', type: 'for_time', description: '5 Rondas: 400m run, 15 OHS' },
  { name: 'Annie', type: 'for_time', description: '50-40-30-20-10 Double-unders y Sit-ups' },
  { name: 'Cindy', type: 'amrap', description: 'AMRAP-20: 5 pull-ups, 10 push-ups, 15 air squats' },
  { name: 'Mary', type: 'amrap', description: 'AMRAP-20: 5 HSPU, 10 pistols, 15 pull-ups' },
  { name: 'Kalsu', type: 'for_time', description: '100 Thrusters con Burpees' },
  { name: 'Murph', type: 'for_time', description: '1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run' },
  { name: 'DT', type: 'for_time', description: '5 Rondas: 12 DL, 9 HPC, 6 Push Jerk' },
  { name: 'Linda', type: 'for_time', description: '10-9-8-...-1 Deadlift, Bench, Squat Clean' },
  { name: 'Nate', type: 'amrap', description: 'AMRAP-20: 2 muscle-ups, 4 HSPU, 8 KB swings' },
  { name: 'Jackie', type: 'for_time', description: '1000m row, 50 thrusters, 30 pull-ups' },
  { name: 'Karen', type: 'for_time', description: '150 Wall Ball shots' },
  { name: 'Amanda', type: 'for_time', description: '9-7-5 Muscle-ups y Snatches' },
  { name: 'Kelly', type: 'amrap', description: 'AMRAP-20: 5 box jumps, 10 wall ball, 15 burpees' },
  { name: 'Chelsea', type: 'emom', description: 'EMOM-30: 5 pull-ups, 10 push-ups, 15 air squats' },
];

export function findWodByName(name) {
  if (!name) return null;
  return WOD_CATALOG.find(
    (w) => w.name.toLowerCase() === name.toLowerCase(),
  ) || null;
}

export function getWodType(name) {
  const wod = findWodByName(name);
  return wod ? wod.type : 'unknown';
}
