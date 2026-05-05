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
          className={`rounded-xl p-3 text-xs ${
            note.type === NoteType.EDIT_REQUEST
              ? "bg-amber-50 border border-amber-100"
              : "bg-stone-50 border border-stone-100"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {note.type === NoteType.EDIT_REQUEST ? (
                <>
                  <p className="font-semibold text-amber-700 flex items-center gap-1 mb-1">
                    <Edit3 className="w-3 h-3" aria-hidden="true" />
                    {FIELD_LABELS[note.fieldName as DonorFieldKey] || note.fieldName}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="line-through text-stone-400">{note.oldValue || "—"}</span>
                    <span className="text-stone-300">→</span>
                    <span className="font-semibold text-teal-700">{note.newValue}</span>
                  </div>
                  {note.status !== NoteStatus.PENDING && (
                    <span className={`text-[10px] mt-1.5 inline-block px-2 py-0.5 rounded-full font-semibold ${
                      note.status === NoteStatus.APPROVED
                        ? "bg-teal-100 text-teal-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {note.status === NoteStatus.APPROVED ? "Onaylandı" : "Reddedildi"}
                    </span>
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap text-stone-700 leading-relaxed">{note.content}</p>
              )}
            </div>
            <span className="text-[10px] text-stone-400 shrink-0 font-medium">{formatNoteTime(note.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
