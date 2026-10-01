/**
 * Daftar wilayah Kota Batam untuk dropdown lokasi tim:
 * 12 kecamatan resmi + kawasan populer yang lazim dipakai di data tim.
 * (Tabel wilayah tidak ada di DB; daftar ini sumber tunggal, tetap bisa ketik manual.)
 */
export const BATAM_AREAS: string[] = [
  // Kecamatan (resmi)
  "Batu Aji",
  "Bengkong",
  "Belakang Padang",
  "Bulang",
  "Galang",
  "Lubuk Baja",
  "Batam Kota",
  "Nongsa",
  "Sagulung",
  "Sekupang",
  "Sijangkang",
  "Sungai Beduk",
  // Kawasan populer
  "Batam Center",
  "Nagoya",
  "Jodoh",
  "Tiban",
  "Punggur",
  "Muka Kuning",
  "Tembesi",
  "Piayu",
  "Tanjung Uncang",
  "Harbour Bay",
  "Riverside",
  "Botania",
];
/**
 * Pusat koordinat perkiraan tiap wilayah (lat, lng) — untuk menghitung tim terdekat
 * dari lokasi kerusakan. Data tim hanya punya `district`, bukan lat/lng per tim.
 */
export const AREA_COORDS: Record<string, readonly [number, number]> = {
  "Batu Aji": [1.042, 103.915],
  "Bengkong": [1.033, 104.045],
  "Belakang Padang": [1.045, 103.835],
  "Bulang": [1.115, 103.905],
  "Galang": [0.925, 103.945],
  "Lubuk Baja": [1.050, 103.945],
  "Batam Kota": [1.055, 104.005],
  "Nongsa": [1.125, 104.020],
  "Sagulung": [1.018, 103.955],
  "Sekupang": [1.045, 103.895],
  "Sijangkang": [0.995, 103.895],
  "Sungai Beduk": [1.015, 104.055],
  "Batam Center": [1.047, 103.985],
  "Nagoya": [1.055, 103.955],
  "Jodoh": [1.058, 103.968],
  "Tiban": [1.070, 103.975],
  "Punggur": [1.063, 103.972],
  "Muka Kuning": [1.028, 103.955],
  "Tembesi": [1.035, 103.975],
  "Piayu": [1.040, 104.065],
  "Tanjung Uncang": [1.010, 103.935],
  "Harbour Bay": [1.075, 103.915],
  "Riverside": [1.058, 103.998],
  "Botania": [1.073, 103.995],
};

/** Jarak lurus (km) antara dua titik koordinat — haversine. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}