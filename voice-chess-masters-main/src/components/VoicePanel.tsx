import { useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, RefreshCw, AlertTriangle, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface VoicePanelProps {
  supported: boolean;
  listening: boolean;
  interim: string;
  lastTranscript: string;
  feedback: string | null;
  feedbackKind: "ok" | "error" | null;
  ttsEnabled: boolean;
  isInIframe: boolean;
  onToggleTts: () => void;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
  onManualSubmit: (text: string) => void;
}

export function VoicePanel({
  supported,
  listening,
  interim,
  lastTranscript,
  feedback,
  feedbackKind,
  ttsEnabled,
  isInIframe,
  onToggleTts,
  onStart,
  onStop,
  onRetry,
  onManualSubmit,
}: VoicePanelProps) {
  const [manualValue, setManualValue] = useState("");
  const [showManual, setShowManual] = useState(false);
  const hasError = feedbackKind === "error" && !!feedback;

  const submitManual = () => {
    const v = manualValue.trim();
    if (!v) return;
    onManualSubmit(v);
    setManualValue("");
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur p-4 shadow-elevated">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Voice control
        </h3>
        <button
          onClick={onToggleTts}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={ttsEnabled ? "Mute voice feedback" : "Enable voice feedback"}
          title={ttsEnabled ? "Mute voice feedback" : "Enable voice feedback"}
        >
          {ttsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </div>

      {isInIframe && supported && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] text-accent">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Voice may not work in preview.{" "}
            <button
              onClick={() => window.open(window.location.href, "_blank")}
              className="underline hover:no-underline"
            >
              Open in new tab
            </button>{" "}
            for best results.
          </span>
        </div>
      )}

      {!supported ? (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Voice input isn't supported in this browser. Try Chrome or Edge — or enter moves below.
          </p>
          <ManualInput
            value={manualValue}
            onChange={setManualValue}
            onSubmit={submitManual}
          />
        </>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <Button
              onClick={listening ? onStop : onStart}
              variant={listening ? "destructive" : "default"}
              className={
                listening
                  ? ""
                  : "bg-gradient-primary text-primary-foreground hover:opacity-90 glow"
              }
            >
              {listening ? (
                <>
                  <MicOff className="size-4 mr-2" /> Stop listening
                </>
              ) : (
                <>
                  <Mic className="size-4 mr-2" /> Start listening
                </>
              )}
            </Button>
            {hasError && (
              <Button variant="outline" onClick={onRetry} title="Retry microphone">
                <RefreshCw className="size-4 mr-2" /> Retry
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowManual((v) => !v)}
              title="Type a move instead"
            >
              <Keyboard className="size-4 mr-2" /> Type
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {listening && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 mb-2 text-xs text-neon"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-current" />
                </span>
                Listening… {interim && <span className="text-muted-foreground italic">"{interim}"</span>}
              </motion.div>
            )}
          </AnimatePresence>

          {lastTranscript && (
            <div className="text-xs text-muted-foreground mb-2">
              <span className="opacity-60">Recognized:</span>{" "}
              <span className="font-mono-display text-foreground">"{lastTranscript}"</span>
            </div>
          )}

          {feedback && (
            <motion.div
              key={feedback}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs px-3 py-2 rounded-md border ${
                feedbackKind === "ok"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {feedback}
            </motion.div>
          )}

          {(showManual || hasError) && (
            <div className="mt-3">
              <ManualInput
                value={manualValue}
                onChange={setManualValue}
                onSubmit={submitManual}
              />
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
            Try: <span className="font-mono-display">"knight to f3"</span>,{" "}
            <span className="font-mono-display">"e2 to e4"</span>,{" "}
            <span className="font-mono-display">"castle kingside"</span>
          </p>
        </>
      )}
    </div>
  );
}

function ManualInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder='Type a move (e.g. "e2 to e4")'
        className="h-9 text-xs"
      />
      <Button onClick={onSubmit} variant="outline" size="sm">
        Send
      </Button>
    </div>
  );
}