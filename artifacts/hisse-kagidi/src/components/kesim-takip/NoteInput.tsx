import { useState } from "react";
import { Loader2, Mic, MicOff, Send } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { createTrackingNote } from "@/lib/api";
import type { TrackingNote } from "@/lib/api";
import { NoteType } from "@/lib/constants";

export function NoteInput({
  groupId,
  token,
  onNoteAdded,
  createNote,
}: {
  groupId?: string;
  token: string;
  onNoteAdded: (note: TrackingNote) => void;
  createNote?: (data: Parameters<typeof createTrackingNote>[1]) => Promise<TrackingNote | null>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const speech = useSpeechRecognition();

  const handleSend = async () => {
    const content = (speech.isListening ? speech.transcript : text).trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const noteData = {
        animalGroupId: groupId,
        type: NoteType.NOTE,
        content,
      };
      let note: TrackingNote | null = null;
      if (createNote) {
        note = await createNote(noteData);
      } else {
        note = await createTrackingNote(token, noteData);
      }
      if (note) onNoteAdded(note);
      setText("");
      speech.setTranscript("");
      if (speech.isListening) speech.stopListening();
    } catch {
    } finally {
      setSending(false);
    }
  };

  const handleMicToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
      if (speech.transcript) {
        setText(prev => (prev ? prev + " " : "") + speech.transcript);
      }
    } else {
      speech.startListening();
    }
  };

  const displayText = speech.isListening ? speech.transcript : text;

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 relative">
        <textarea
          placeholder="Not yazın..."
          value={displayText}
          onChange={(e) => {
            if (!speech.isListening) setText(e.target.value);
          }}
          className="w-full min-h-[40px] max-h-[100px] text-sm px-3 py-2 pr-8 bg-stone-50 border border-stone-200 rounded-xl resize-none outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-stone-400 text-stone-800 transition-all"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        {speech.isListening && (
          <span className="absolute right-2 top-2 text-[9px] text-red-500 font-bold animate-pulse">REC</span>
        )}
      </div>
      {speech.isSupported && (
        <button
          className={`w-10 h-10 min-h-[40px] flex items-center justify-center rounded-xl border font-medium text-sm transition-all ${
            speech.isListening
              ? "bg-red-500 border-red-500 text-white"
              : "bg-white border-stone-200 text-stone-500 hover:border-stone-300"
          }`}
          onClick={handleMicToggle}
          aria-label={speech.isListening ? "Kaydı durdur" : "Sesle not yaz"}
        >
          {speech.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}
      <button
        className="w-10 h-10 min-h-[40px] flex items-center justify-center rounded-xl bg-teal-600 text-white transition-all hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleSend}
        disabled={!displayText.trim() || sending}
        aria-label="Notu gönder"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}
