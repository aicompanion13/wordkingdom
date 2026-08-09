"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { captureElementScreenshot } from "./capture-screenshot";
import styles from "./FeedbackOverlay.module.css";

type Phase = "capturing" | "ready" | "submitting" | "done" | "error";
type RecordState = "idle" | "recording" | "recorded" | "denied";

const MARK_COLORS = ["#ef4444", "#facc15", "#22d3ee", "#ffffff"];
const MAX_RECORD_SECONDS = 60;

export type FeedbackOverlayProps = {
  open: boolean;
  targetRef: RefObject<HTMLElement | null>;
  level: number;
  onClose: () => void;
};

export function FeedbackOverlay({ open, targetRef, level, onClose }: FeedbackOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("capturing");
  const [color, setColor] = useState(MARK_COLORS[0]);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("capturing");
    setErrorText(null);
    let cancelled = false;
    const target = targetRef.current;
    if (!target) {
      setPhase("error");
      return;
    }
    captureElementScreenshot(target)
      .then((captured) => {
        if (cancelled) return;
        baseImageRef.current = captured;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = captured.width;
        canvas.height = captured.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(captured, 0, 0);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "submitting") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  useEffect(() => {
    if (!open) resetRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phase !== "ready") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    isDrawingRef.current = true;
    const point = getCanvasPoint(event);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(5, canvas.width / 110);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.1, point.y + 0.1);
    ctx.stroke();
  }

  function onCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const point = getCanvasPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawingRef.current = false;
  }

  function clearMarks() {
    const canvas = canvasRef.current;
    const base = baseImageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !base || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setRecordState("recorded");
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordState("recording");
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((seconds) => {
          const next = seconds + 1;
          if (next >= MAX_RECORD_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch {
      setRecordState("denied");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetRecording() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    audioBlobRef.current = null;
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setRecordState("idle");
    setElapsedSec(0);
  }

  function retakeRecording() {
    resetRecording();
  }

  function handleClose() {
    resetRecording();
    onClose();
  }

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || !audioBlobRef.current) return;
    setPhase("submitting");
    setErrorText(null);
    const screenshotBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
    if (!screenshotBlob) {
      setPhase("ready");
      setErrorText("Couldn't prepare the screenshot. Try again.");
      return;
    }
    const form = new FormData();
    form.append("screenshot", screenshotBlob, "screenshot.png");
    form.append("audio", audioBlobRef.current, "note.webm");
    form.append("level", String(level));
    try {
      const response = await fetch("/api/feedback", { method: "POST", body: form });
      if (!response.ok) throw new Error("submit failed");
      setPhase("done");
      window.setTimeout(handleClose, 1100);
    } catch {
      setPhase("ready");
      setErrorText("Couldn't send feedback. Check your connection and try again.");
    }
  }

  const canSubmit = phase === "ready" && recordState === "recorded";

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Send feedback">
      <div className={styles.canvasWrap}>
        {phase === "capturing" && <div className={styles.loading}>Capturing screen…</div>}
        {phase === "error" && <div className={styles.loading}>Couldn't capture the screen.</div>}
        {(phase === "ready" || phase === "submitting" || phase === "done") && (
          <>
            <div className={styles.hint}>Draw on what you didn't like, then record a quick note</div>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          </>
        )}
        {phase === "done" && <div className={styles.successBanner}>Feedback sent — thanks!</div>}
      </div>

      {phase !== "error" && (
        <div className={styles.toolbar}>
          <div className={styles.colorRow}>
            {MARK_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Mark in ${swatch}`}
                className={`${styles.colorSwatch} ${color === swatch ? styles.colorSwatchActive : ""}`}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
              />
            ))}
          </div>
          <div className={styles.spacer} />
          <button type="button" className={styles.iconButton} onClick={clearMarks} disabled={phase !== "ready"}>
            Clear marks
          </button>
        </div>
      )}

      <div className={styles.recordRow}>
        <div className={styles.recordControls}>
          {recordState !== "recorded" && (
            <button
              type="button"
              className={`${styles.recordButton} ${recordState === "recording" ? styles.recordButtonActive : styles.recordButtonIdle}`}
              onClick={recordState === "recording" ? stopRecording : startRecording}
              disabled={phase !== "ready"}
            >
              {recordState === "recording" ? "⏹ Stop" : "🎙 Record note"}
            </button>
          )}
          {recordState === "recording" && (
            <span className={styles.timer}>
              0:{elapsedSec.toString().padStart(2, "0")}
            </span>
          )}
          {recordState === "recorded" && audioUrl && (
            <>
              <audio className={styles.audioPreview} controls src={audioUrl} />
              <button type="button" className={styles.iconButton} onClick={retakeRecording}>
                Retake
              </button>
            </>
          )}
        </div>
        {recordState === "denied" && (
          <span className={styles.statusText}>Microphone access is needed to record your note.</span>
        )}
        {errorText && <span className={styles.statusText}>{errorText}</span>}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelButton} onClick={handleClose} disabled={phase === "submitting"}>
          Cancel
        </button>
        <button type="button" className={styles.submitButton} onClick={handleSubmit} disabled={!canSubmit}>
          {phase === "submitting" ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </div>
  );
}
