import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="flex gap-1.5 items-end">
      <div className="flex-1 relative">
        <Textarea
          placeholder="Not yazın..."
          value={displayText}
          onChange={(e) => {
            if (!speech.isListening) setText(e.target.value);
          }}
          className="min-h-[40px] max-h-[100px] text-sm pr-10 resize-none"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        {speech.isListening && (
          <span className="absolute right-2 top-2 text-[10px] text-red-500 font-semibold animate-pulse">REC</span>
        )}
      </div>
      {speech.isSupported && (
        <Button
          variant={speech.isListening ? "destructive" : "outline"}
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={handleMicToggle}
        >
          {speech.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
      <Button
        size="sm"
        className="h-9 w-9 p-0 shrink-0"
        onClick={handleSend}
        disabled={!displayText.trim() || sending}
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  );
}
