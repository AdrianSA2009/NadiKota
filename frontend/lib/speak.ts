/**
 * TTS sederhana via Web Speech API (browser).
 * - Di Windows/Edge, voice "Microsoft ..." (id-ID) tersedia otomatis — ini suara
 *   Microsoft yang sama dipakai Edge; tanpa API key.
 * - Kalau mau kualitas neural Azure (Microsoft TTS cloud) → butuh key Azure Speech
 *   (endpoint REST/WS) — bisa disambung belakangan di fungsi yang sama.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoices.length === 0) cachedVoices = window.speechSynthesis.getVoices();
  return (
    // Prioritas: voice Microsoft berbahasa Indonesia → Indonesia apa saja → Microsoft apa saja.
    cachedVoices.find((v) => /microsoft/i.test(v.name) && v.lang.toLowerCase().startsWith("id")) ??
    cachedVoices.find((v) => v.lang.toLowerCase().startsWith("id")) ??
    cachedVoices.find((v) => /microsoft/i.test(v.name)) ??
    null
  );
}

/** Ucapkan teks (Bahasa Indonesia) — suara dipilih otomatis, suara sebelumnya dibatalkan. */
export function speakId(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  // Voice list bisa belum siap saat panggilan pertama → muat dulu lalu bicara.
  if (cachedVoices.length === 0) {
    cachedVoices = synth.getVoices();
    synth.addEventListener?.(
      "voiceschanged",
      () => {
        cachedVoices = synth.getVoices();
      },
      { once: true },
    );
  }
  synth.cancel(); // jangan tumpuk peringatan
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1;
  utterance.pitch = 1;
  synth.speak(utterance);
}
