import { Edit3 } from "lucide-react";
import { formatNoteTime } from "@/lib/formatting";
import { FIELD_LABELS, NoteType, NoteStatus } from "@/lib/constants";
import type { DonorFieldKey } from "@/lib/constants";
import type { TrackingNote } from "@/lib/api";

export function NotesList({ notes, groupId }: { notes: TrackingNote[]; groupId?: string }) {
  const filtered = groupId ? notes.filter(n => n.animalGroupId === groupId) : notes;
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {filtered.map(note => (
        <div
          key={note.id}
          className={`rounded-lg p-2 text-xs ${
            note.type === NoteType.EDIT_REQUEST
              ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
              : "bg-muted/50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {note.type === NoteType.EDIT_REQUEST ? (
                <>
                  <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-0.5 mb-0.5">
                    <Edit3 className="w-2.5 h-2.5" /> {FIELD_LABELS[note.fieldName as DonorFieldKey] || note.fieldName}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="line-through text-red-400">{note.oldValue || "—"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-emerald-600">{note.newValue}</span>
                  </div>
                  {note.status !== NoteStatus.PENDING && (
                    <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded-full font-semibold ${
                      note.status === NoteStatus.APPROVED ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>
                      {note.status === NoteStatus.APPROVED ? "Onaylandı" : "Reddedildi"}
                    </span>
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{note.content}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatNoteTime(note.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
