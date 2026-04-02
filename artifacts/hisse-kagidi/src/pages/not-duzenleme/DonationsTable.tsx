import { useState, useCallback, useEffect, useRef, useMemo, memo, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { TableVirtuoso, type TableVirtuosoHandle } from "react-virtuoso";
import type { LocalDonation, AiResult } from "./types";

const NOTE_DEBOUNCE_MS = 150;

export interface DonationsTableHandle {
  scrollToIndex: (index: number) => void;
}

interface DonationsTableProps {
  donations: LocalDonation[];
  filteredDonations: LocalDonation[];
  searchQuery: string;
  hideEmptyNotes: boolean;
  setHideEmptyNotes: (fn: (prev: boolean) => boolean) => void;
  aiRunning: boolean;
  aiResults: Map<string, AiResult>;
  handleNoteChange: (id: string, value: string) => void;
  commitNoteChange: (id: string) => void;
  updateDonationsWithHistory: (updater: (prev: LocalDonation[]) => LocalDonation[]) => void;
  aiCategoryFilter: string | null;
  setAiCategoryFilter: (v: string | null) => void;
  idToIndexMap: Map<string, number>;
}

interface DonationRowProps {
  donation: LocalDonation;
  globalIdx: number;
  aiResult: AiResult | undefined;
  aiRunning: boolean;
  aiCategoryFilter: string | null;
  handleNoteChange: (id: string, value: string) => void;
  commitNoteChange: (id: string) => void;
  updateDonationsWithHistory: (updater: (prev: LocalDonation[]) => LocalDonation[]) => void;
  setAiCategoryFilter: (v: string | null) => void;
}

const DebouncedTextarea = memo(function DebouncedTextarea({
  id,
  value,
  handleNoteChange,
  commitNoteChange,
}: {
  id: string;
  value: string;
  handleNoteChange: (id: string, value: string) => void;
  commitNoteChange: (id: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const localDirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localValueRef = useRef(localValue);
  localValueRef.current = localValue;
  const handleNoteChangeRef = useRef(handleNoteChange);
  handleNoteChangeRef.current = handleNoteChange;
  const commitNoteChangeRef = useRef(commitNoteChange);
  commitNoteChangeRef.current = commitNoteChange;
  const idRef = useRef(id);
  idRef.current = id;

  useEffect(() => {
    if (!localDirtyRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  useEffect(() => {
    setLocalValue(value);
    localDirtyRef.current = false;
  }, [id]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (localDirtyRef.current) {
        handleNoteChangeRef.current(idRef.current, localValueRef.current);
        commitNoteChangeRef.current(idRef.current);
        localDirtyRef.current = false;
      }
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    localDirtyRef.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleNoteChangeRef.current(idRef.current, newValue);
    }, NOTE_DEBOUNCE_MS);
  }, []);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (localDirtyRef.current) {
      handleNoteChangeRef.current(idRef.current, localValueRef.current);
    }
    localDirtyRef.current = false;
    commitNoteChangeRef.current(idRef.current);
  }, []);

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="Not yok..."
      className="text-xs min-h-[36px] resize-none py-1 px-2"
      rows={1}
    />
  );
});

const DonationRow = memo(function DonationRow({
  donation: d,
  globalIdx,
  aiResult,
  aiRunning,
  aiCategoryFilter,
  handleNoteChange,
  commitNoteChange,
  updateDonationsWithHistory,
  setAiCategoryFilter,
}: DonationRowProps) {
  const hasWarning = aiResult?.warnings && aiResult.warnings.trim() !== "";

  return (
    <>
      <TableCell className="text-xs text-muted-foreground">{globalIdx + 1}</TableCell>
      <TableCell>
        <span className="text-sm font-medium">{d.description || d.name || "(İsimsiz)"}</span>
      </TableCell>
      <TableCell>
        {d.donationType && <Badge variant="outline" className="text-xs">{d.donationType}</Badge>}
      </TableCell>
      <TableCell>
        {d.vekalet && <span className="text-xs text-muted-foreground">{d.vekalet}</span>}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <DebouncedTextarea
            id={d.id}
            value={d.notes || ""}
            handleNoteChange={handleNoteChange}
            commitNoteChange={commitNoteChange}
          />
          {(d.notes || "").trim() !== "" && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0 h-6 w-6 p-0" onClick={() => { updateDonationsWithHistory(prev => prev.map(x => x.id === d.id ? { ...x, notes: "" } : x)); }}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        {aiRunning && !aiResult && (d.notes || "").trim() !== "" && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
        {aiResult && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors w-full">
                {hasWarning ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
                <div className="flex flex-wrap gap-0.5 min-w-0">
                  {aiResult.categories && aiResult.categories.length > 0 ? (
                    aiResult.categories.slice(0, 2).map(cat => (
                      <Badge
                        key={cat}
                        variant={aiCategoryFilter && cat.toLocaleLowerCase("tr") === aiCategoryFilter.toLocaleLowerCase("tr") ? "default" : "secondary"}
                        className="text-[10px] px-1 py-0 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setAiCategoryFilter(aiCategoryFilter && cat.toLocaleLowerCase("tr") === aiCategoryFilter.toLocaleLowerCase("tr") ? null : cat); }}
                      >
                        {cat.replace(/_/g, " ")}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground">sonuç var</span>
                  )}
                  {aiResult.categories && aiResult.categories.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{aiResult.categories.length - 2}</span>
                  )}
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-2" side="left">
              <div className="text-sm font-medium">{d.description || d.name}</div>
              {aiResult.summary && <p className="text-xs text-muted-foreground">{aiResult.summary}</p>}
              {aiResult.categories && aiResult.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiResult.categories.map(cat => (
                    <Badge
                      key={cat}
                      variant={aiCategoryFilter && cat.toLocaleLowerCase("tr") === aiCategoryFilter.toLocaleLowerCase("tr") ? "default" : "secondary"}
                      className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setAiCategoryFilter(aiCategoryFilter && cat.toLocaleLowerCase("tr") === aiCategoryFilter.toLocaleLowerCase("tr") ? null : cat)}
                    >
                      {cat.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              )}
              {aiResult.requests && aiResult.requests.trim() !== "" && (
                <div>
                  <span className="text-xs font-semibold text-blue-600">İstekler:</span>
                  <p className="text-xs mt-0.5">{aiResult.requests}</p>
                </div>
              )}
              {hasWarning && (
                <div className="bg-destructive/10 rounded p-2 border border-destructive/20">
                  <span className="text-xs font-semibold text-destructive flex items-center gap-1 mb-0.5">
                    <AlertTriangle className="w-3 h-3" />Uyarı:
                  </span>
                  <p className="text-xs text-destructive">{aiResult.warnings}</p>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </TableCell>
    </>
  );
});

const ScrollerComponent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties }>((props, ref) => (
  <div {...props} ref={ref} style={{ ...props.style, overflowX: "auto" }} />
));
ScrollerComponent.displayName = "ScrollerComponent";

const TableBodyComponent = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
  <TableBody ref={ref} {...props} />
));
TableBodyComponent.displayName = "TableBodyComponent";

const TableRowComponent = (props: React.HTMLAttributes<HTMLTableRowElement> & { "data-index"?: number; item?: LocalDonation; context?: { aiResults: Map<string, AiResult> } }) => {
  const { item, context, ...rest } = props;
  const donationId = item?.id;
  const aiResult = donationId && context?.aiResults ? context.aiResults.get(donationId) : undefined;
  const hasWarning = aiResult?.warnings && aiResult.warnings.trim() !== "";
  return <TableRow {...rest} data-donation-id={donationId} className={`${rest.className || ""} transition-all ${hasWarning ? "bg-destructive/5" : ""}`} />;
};

const FixedHeaderContent = () => (
  <TableRow>
    <TableHead className="w-10 text-xs">#</TableHead>
    <TableHead className="text-xs min-w-[150px]">Ad / Açıklama</TableHead>
    <TableHead className="text-xs w-24">Bağış Türü</TableHead>
    <TableHead className="text-xs w-24">Vekalet No</TableHead>
    <TableHead className="text-xs min-w-[200px]">Not</TableHead>
    <TableHead className="text-xs w-[180px]">AI Sonucu</TableHead>
  </TableRow>
);

export const DonationsTable = forwardRef<DonationsTableHandle, DonationsTableProps>(function DonationsTable({
  donations, filteredDonations, searchQuery, hideEmptyNotes, setHideEmptyNotes,
  aiRunning, aiResults, handleNoteChange, commitNoteChange, updateDonationsWithHistory,
  aiCategoryFilter, setAiCategoryFilter, idToIndexMap,
}, ref) {

  const virtuosoRef = useRef<TableVirtuosoHandle>(null);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => {
      virtuosoRef.current?.scrollToIndex({ index, align: "center", behavior: "smooth" });
    },
  }), []);

  const itemContent = useCallback((_index: number, d: LocalDonation) => {
    const aiResult = aiResults.get(d.id);
    const globalIdx = idToIndexMap.get(d.id) ?? 0;

    return (
      <DonationRow
        donation={d}
        globalIdx={globalIdx}
        aiResult={aiResult}
        aiRunning={aiRunning}
        aiCategoryFilter={aiCategoryFilter}
        handleNoteChange={handleNoteChange}
        commitNoteChange={commitNoteChange}
        updateDonationsWithHistory={updateDonationsWithHistory}
        setAiCategoryFilter={setAiCategoryFilter}
      />
    );
  }, [aiResults, idToIndexMap, aiRunning, aiCategoryFilter, handleNoteChange, commitNoteChange, updateDonationsWithHistory, setAiCategoryFilter]);

  const emptyPlaceholder = useMemo(() => () => (
    <TableBody>
      <TableRow>
        <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
          {aiCategoryFilter ? `"${aiCategoryFilter.replace(/_/g, " ")}" kategorisinde bağışçı bulunamadı` : searchQuery ? "Arama sonucu bulunamadı" : "Bağışçı yok"}
        </TableCell>
      </TableRow>
    </TableBody>
  ), [aiCategoryFilter, searchQuery]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {filteredDonations.length}/{donations.length} bağışçı gösteriliyor
          {searchQuery && ` ("${searchQuery}" araması)`}
          {hideEmptyNotes && " (notu olmayanlar gizli)"}
          {aiCategoryFilter && ` (${aiCategoryFilter.replace(/_/g, " ")} filtresi)`}
        </div>
        <Button variant={hideEmptyNotes ? "default" : "outline"} size="sm" onClick={() => setHideEmptyNotes(prev => !prev)} className="text-xs h-7">
          {hideEmptyNotes ? "Tümünü Göster" : "Notu Olmayanları Gizle"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {filteredDonations.length === 0 ? (
          <Table>
            <TableHeader>
              <FixedHeaderContent />
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-sm">
                  {aiCategoryFilter ? `"${aiCategoryFilter.replace(/_/g, " ")}" kategorisinde bağışçı bulunamadı` : searchQuery ? "Arama sonucu bulunamadı" : "Bağışçı yok"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <TableVirtuoso
            ref={virtuosoRef}
            style={{ height: Math.min(filteredDonations.length * 52, 600) }}
            data={filteredDonations}
            context={{ aiResults }}
            overscan={20}
            computeItemKey={(_index, item) => item?.id ?? _index}
            components={{
              Scroller: ScrollerComponent,
              Table: ({ style, ...props }) => <Table {...props} style={style} />,
              TableBody: TableBodyComponent,
              TableRow: TableRowComponent as any,
              EmptyPlaceholder: emptyPlaceholder,
            }}
            fixedHeaderContent={FixedHeaderContent}
            itemContent={itemContent}
          />
        )}
      </div>
    </>
  );
});
