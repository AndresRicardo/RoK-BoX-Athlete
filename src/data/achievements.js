import { lbToKg } from '../utils/units';

export const ACHIEVEMENTS = [
  {
    id: 'first_pr',
    name: 'Primer PR',
    description: 'Registraste tu primera marca personal',
    icon: '⭐',
    tier: 'bronze',
    check: ({ prs }) => prs.length >= 1,
  },
  {
    id: 'prs_5',
    name: '5 PRs',
    description: '5 marcas personales registradas',
    icon: '⭐',
    tier: 'bronze',
    check: ({ prs }) => prs.length >= 5,
  },
  {
    id: 'prs_10',
    name: '10 PRs',
    description: '10 marcas personales registradas',
    icon: '🏆',
    tier: 'silver',
    check: ({ prs }) => prs.length >= 10,
  },
  {
    id: 'prs_25',
    name: '25 PRs',
    description: '25 marcas personales registradas',
    icon: '🏆',
    tier: 'gold',
    check: ({ prs }) => prs.length >= 25,
  },
  {
    id: 'prs_50',
    name: '50 PRs',
    description: '50 marcas personales registradas',
    icon: '👑',
    tier: 'platinum',
    check: ({ prs }) => prs.length >= 50,
  },
  {
    id: 'first_wod',
    name: 'Primer WOD',
    description: 'Registraste tu primer benchmark',
    icon: '🔥',
    tier: 'bronze',
    check: ({ benchmarks }) => benchmarks.length >= 1,
  },
  {
    id: 'wods_5',
    name: '5 WODs',
    description: '5 benchmarks registrados',
    icon: '🔥',
    tier: 'silver',
    check: ({ benchmarks }) => benchmarks.length >= 5,
  },
  {
    id: 'wods_20',
    name: '20 WODs',
    description: '20 benchmarks registrados',
    icon: '🏆',
    tier: 'gold',
    check: ({ benchmarks }) => benchmarks.length >= 20,
  },
  {
    id: 'bs_2x_bw',
    name: 'Back Squat 2x BW',
    description: 'Back Squat al menos 2x tu peso corporal',
    icon: '💪',
    tier: 'gold',
    check: ({ prs, profile }) => {
      if (!profile?.weight_kg) return false;
      const bs = prs.find((p) => p.movement === 'Back Squat' && p.type === 'strength');
      return bs && lbToKg(bs.value_numeric) >= profile.weight_kg * 2;
    },
  },
  {
    id: 'dl_2x_bw',
    name: 'Deadlift 2x BW',
    description: 'Deadlift al menos 2x tu peso corporal',
    icon: '💪',
    tier: 'gold',
    check: ({ prs, profile }) => {
      if (!profile?.weight_kg) return false;
      const dl = prs.find((p) => p.movement === 'Deadlift' && p.type === 'strength');
      return dl && lbToKg(dl.value_numeric) >= profile.weight_kg * 2;
    },
  },
  {
    id: 'cj_1x_bw',
    name: 'Clean & Jerk 1x BW',
    description: 'Clean & Jerk al menos igual a tu peso corporal',
    icon: '💪',
    tier: 'silver',
    check: ({ prs, profile }) => {
      if (!profile?.weight_kg) return false;
      const cj = prs.find((p) => p.movement === 'Clean & Jerk' && p.type === 'strength');
      return cj && lbToKg(cj.value_numeric) >= profile.weight_kg;
    },
  },
  {
    id: 'fran_sub_5',
    name: 'Fran sub-5:00',
    description: 'Completaste Fran en menos de 5:00 (RX)',
    icon: '⚡',
    tier: 'gold',
    check: ({ benchmarks }) => {
      const f = benchmarks.find(
        (b) => b.name === 'Fran' && b.scaling === 'rx' && b.type === 'for_time',
      );
      return f && f.result_value < 300;
    },
  },
  {
    id: 'fran_sub_3',
    name: 'Fran sub-3:00',
    description: 'Completaste Fran en menos de 3:00 (RX)',
    icon: '⚡',
    tier: 'platinum',
    check: ({ benchmarks }) => {
      const f = benchmarks.find(
        (b) => b.name === 'Fran' && b.scaling === 'rx' && b.type === 'for_time',
      );
      return f && f.result_value < 180;
    },
  },
  {
    id: 'cindy_15',
    name: 'Cindy 15+ rounds',
    description: '15 o más rondas en Cindy',
    icon: '🔥',
    tier: 'silver',
    check: ({ benchmarks }) => {
      const c = benchmarks.find((b) => b.name === 'Cindy' && b.type === 'amrap');
      return c && c.result_value >= 15000;
    },
  },
  {
    id: 'murph_done',
    name: 'Murph completado',
    description: 'Has registrado un Murph',
    icon: '🎖️',
    tier: 'gold',
    check: ({ benchmarks }) => benchmarks.some((b) => b.name === 'Murph'),
  },
  {
    id: 'rx_discipline',
    name: 'Disciplina RX',
    description: 'Tu perfil indica disciplina RX',
    icon: '🎯',
    tier: 'bronze',
    check: ({ profile }) => profile?.discipline === 'rx',
  },
  {
    id: 'first_skill',
    name: 'Primera skill',
    description: 'Desbloqueaste tu primer movimiento',
    icon: '💪',
    tier: 'bronze',
    check: ({ movements }) => movements && movements.length >= 1,
  },
  {
    id: 'skills_10',
    name: '10 skills',
    description: '10 movimientos desbloqueados',
    icon: '💪',
    tier: 'silver',
    check: ({ movements }) => movements && movements.length >= 10,
  },
  {
    id: 'skills_25',
    name: '25 skills',
    description: '25 movimientos desbloqueados',
    icon: '💪',
    tier: 'gold',
    check: ({ movements }) => movements && movements.length >= 25,
  },
  {
    id: 'skills_50',
    name: '50 skills',
    description: '50 movimientos desbloqueados',
    icon: '👑',
    tier: 'platinum',
    check: ({ movements }) => movements && movements.length >= 50,
  },
];

export function getAchievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

export function getAllAchievementsStatus({ prs, benchmarks, profile }) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.check({ prs, benchmarks, profile }),
  }));
}
