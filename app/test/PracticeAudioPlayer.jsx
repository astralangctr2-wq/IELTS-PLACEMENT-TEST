"use client";

// Audio controls for PRACTICE mode only (exam mode keeps its own limited,
// no-pause player in TestRunner / AptisRunner). Play/pause, stop (back to
// the start), rewind 5 seconds and a seek bar, with unlimited replays.
// Only one practice player plays at a time on the page, and playback stops
// when the player unmounts (e.g. the student moves to the next part).

import { useEffect, useRef, useState } from "react";

const EVT = "practice-audio-play";
const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export default function PracticeAudioPlayer({ src, script }) {
  const audioRef = useRef(null);
  const idRef = useRef(Math.random().toString(36).slice(2));
  const [state, setState] = useState("idle"); // idle | playing | paused
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const tts = !src && !!script;

  // Pause this player when another practice player starts.
  useEffect(() => {
    const onOther = (e) => {
      if (e.detail === idRef.current) return;
      if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); setState("paused"); }
    };
    window.addEventListener(EVT, onOther);
    return () => window.removeEventListener(EVT, onOther);
  }, []);

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (tts && typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [tts]);

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(src);
    a.preload = "auto";
    a.ontimeupdate = () => setTime(a.currentTime);
    a.onloadedmetadata = () => setDuration(a.duration);
    a.onended = () => { setState("idle"); setTime(0); a.currentTime = 0; };
    a.onerror = () => { setError(true); setState("idle"); };
    audioRef.current = a;
    return a;
  };

  // Load metadata up front so the length and seek bar show before playing.
  useEffect(() => {
    if (src) ensureAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const announce = () => window.dispatchEvent(new CustomEvent(EVT, { detail: idRef.current }));

  const playPause = () => {
    setError(false);
    if (tts) {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (state === "playing") { synth.pause(); setState("paused"); return; }
      if (state === "paused") { synth.resume(); setState("playing"); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(script);
      u.lang = "en-GB";
      u.onend = () => setState("idle");
      synth.speak(u);
      setState("playing");
      return;
    }
    const a = ensureAudio();
    if (state === "playing") { a.pause(); setState("paused"); return; }
    announce();
    a.play().then(() => setState("playing")).catch(() => { setError(true); setState("idle"); });
  };

  const stop = () => {
    if (tts) { window.speechSynthesis && window.speechSynthesis.cancel(); setState("idle"); return; }
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setTime(0);
    setState("idle");
  };

  const rewind = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, a.currentTime - 5);
    setTime(a.currentTime);
  };

  const seek = (v) => {
    const a = ensureAudio();
    a.currentTime = Number(v);
    setTime(a.currentTime);
  };

  return (
    <div className="practice-audio">
      <div className="practice-audio-btns">
        <button type="button" className="btn" onClick={playPause}>
          {state === "playing" ? "⏸ Tạm dừng" : state === "paused" ? "▶ Tiếp tục" : "▶ Phát"}
        </button>
        <button type="button" className="btn-ghost" onClick={stop} disabled={state === "idle" && time === 0}>⏹ Dừng</button>
        {!tts && (
          <button type="button" className="btn-ghost" onClick={rewind} disabled={time === 0} title="Lùi 5 giây">⟲ 5s</button>
        )}
      </div>
      {!tts && (
        <div className="practice-audio-bar">
          <span className="mono">{fmt(time)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(e.target.value)}
            disabled={!duration}
            aria-label="Tua audio"
          />
          <span className="mono">{fmt(duration)}</span>
        </div>
      )}
      <span className="mono muted practice-audio-note">Chế độ luyện tập — nghe không giới hạn</span>
      {error && <span className="accent" style={{ fontSize: 13 }}>Không phát được audio — báo giáo viên.</span>}
    </div>
  );
}
