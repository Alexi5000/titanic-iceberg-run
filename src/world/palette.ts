// file: src/world/palette.ts
// description: Color palette system - one config drives ocean, sky, fog, bergs, and lighting; three selectable moods (Dusk, Night, Aurora)
// reference: src/world/sky.ts, src/world/ocean.ts, src/main.ts

import * as THREE from 'three';

export interface Palette {
  id: string;
  label: string;
  sky_top: number;
  sky_horizon: number;
  sky_bottom: number;
  ocean_deep: number;
  ocean_surface: number;
  fog_color: number;
  fog_density_base: number;
  moon_color: number;
  moon_glow: number;
  star_opacity: number;
  berg_color: number;
  berg_emissive: number;
  ambient_color: number;
  ambient_intensity: number;
  key_light_color: number;
  key_light_intensity: number;
  rim_light_color: number;
  has_aurora: boolean;
  /** 0..1 procedural cloud coverage used by the cinematic sky. */
  cloud_coverage: number;
  /** 0..1 storm severity shared by sky, water, particles, and post. */
  storm_intensity: number;
  /** 0..1 precipitation amount; zero for clear presets. */
  precipitation: number;
}

export const PALETTES: Palette[] = [
  {
    id: 'day',
    label: 'North Atlantic Day',
    sky_top: 0x4c86b5,
    sky_horizon: 0xb7d3df,
    sky_bottom: 0x6e94a9,
    ocean_deep: 0x06263a,
    ocean_surface: 0x1d6e82,
    fog_color: 0xa7bec8,
    fog_density_base: 0.00082,
    moon_color: 0xfff1c7,
    moon_glow: 0xffcf87,
    star_opacity: 0,
    berg_color: 0xe5f3fb,
    berg_emissive: 0x1e526d,
    ambient_color: 0x87a8bf,
    ambient_intensity: 1.15,
    key_light_color: 0xfff3d1,
    key_light_intensity: 2.2,
    rim_light_color: 0x9fd9f3,
    has_aurora: false,
    cloud_coverage: 0.32,
    storm_intensity: 0,
    precipitation: 0,
  },
  {
    id: 'dusk',
    label: 'Dusk',
    sky_top: 0x2b3a67,
    sky_horizon: 0xff8e6b,
    sky_bottom: 0xffc4a3,
    ocean_deep: 0x0f4d5c,
    ocean_surface: 0x2fa3a8,
    fog_color: 0x3a4a72,
    fog_density_base: 0.0013,
    moon_color: 0xfff0d8,
    moon_glow: 0xffb98a,
    star_opacity: 0.35,
    berg_color: 0xeaf6ff,
    berg_emissive: 0x2a4a5e,
    ambient_color: 0x6a6a8e,
    ambient_intensity: 1.0,
    key_light_color: 0xffc9a0,
    key_light_intensity: 1.6,
    rim_light_color: 0xff9e7a,
    has_aurora: false,
    cloud_coverage: 0.18,
    storm_intensity: 0,
    precipitation: 0,
  },
  {
    id: 'night',
    label: 'Night',
    sky_top: 0x010409,
    sky_horizon: 0x0b1626,
    sky_bottom: 0x060d18,
    ocean_deep: 0x02101e,
    ocean_surface: 0x0c2a44,
    fog_color: 0x060d18,
    fog_density_base: 0.0016,
    moon_color: 0xe8f0fa,
    moon_glow: 0x96b4d2,
    star_opacity: 0.85,
    berg_color: 0xd7e6f2,
    berg_emissive: 0x16222e,
    ambient_color: 0x2a3a52,
    ambient_intensity: 0.85,
    key_light_color: 0x9db8d6,
    key_light_intensity: 1.35,
    rim_light_color: 0x5a7ca6,
    has_aurora: false,
    cloud_coverage: 0.26,
    storm_intensity: 0,
    precipitation: 0,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    sky_top: 0x06121f,
    sky_horizon: 0x10333e,
    sky_bottom: 0x0a1c28,
    ocean_deep: 0x062430,
    ocean_surface: 0x14555c,
    fog_color: 0x0c2230,
    fog_density_base: 0.0014,
    moon_color: 0xdcf5ec,
    moon_glow: 0x7be8b8,
    star_opacity: 0.75,
    berg_color: 0xdcf2ee,
    berg_emissive: 0x1c4a44,
    ambient_color: 0x2c5448,
    ambient_intensity: 1.0,
    key_light_color: 0x9fe8c8,
    key_light_intensity: 1.45,
    rim_light_color: 0x6be0a8,
    has_aurora: true,
    cloud_coverage: 0.22,
    storm_intensity: 0,
    precipitation: 0,
  },
  {
    id: 'storm',
    label: 'Storm',
    sky_top: 0x080d16,
    sky_horizon: 0x334454,
    sky_bottom: 0x111a25,
    ocean_deep: 0x010912,
    ocean_surface: 0x0c2d40,
    fog_color: 0x202f3c,
    fog_density_base: 0.00215,
    moon_color: 0xd4e7f4,
    moon_glow: 0x8eb8d6,
    star_opacity: 0.08,
    berg_color: 0xbcd3df,
    berg_emissive: 0x173546,
    ambient_color: 0x35495b,
    ambient_intensity: 0.72,
    key_light_color: 0x9cb6cb,
    key_light_intensity: 1.25,
    rim_light_color: 0x66849d,
    has_aurora: false,
    cloud_coverage: 0.92,
    storm_intensity: 1,
    precipitation: 0.82,
  },
];

const STORAGE_KEY = 'tir.palette.v1';

export function load_palette(): Palette {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
  } catch {
    return PALETTES[0];
  }
}

export function save_palette(palette: Palette): void {
  try {
    localStorage.setItem(STORAGE_KEY, palette.id);
  } catch {
    // No persistence in private mode.
  }
}

export function next_palette(current: Palette): Palette {
  const index = PALETTES.findIndex((p) => p.id === current.id);
  return PALETTES[(index + 1) % PALETTES.length];
}

export function color(hex: number): THREE.Color {
  return new THREE.Color(hex);
}
