import type { KesimAlani, Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, ShoppingBag, Trash2, UserCog, AlertTriangle } from "lucide-react";

interface PersonEditDialogProps {
  kesim: KesimAlani;
  personEditDesc: string | null;
  setPersonEditDesc: (val: string | null) => void;
  updateDonationField: (id: string, field: string, value: any) => void;
  updateGroupDonation: (groupIdx: number, dIdx: number, field: string, value: any) => void;
  bulkExcludeByDesc: (desc: string, exclude: boolean) => void;
  setPersonBulkDeleteConfirm: (val: string | null) => void;
  deleteDonation: (id: string) => void;
  basketItemIds: Set<string>;
  removeFromBasket: (id: string) => void;
  addDonorToBasket: (id: string) => void;
  addToBasket: (groupIdx: number, dIdx: number) => void;
}

export default function PersonEditDialog({
  kesim,
  personEditDesc,
  setPersonEditDesc,
  updateDonationField,
  updateGroupDonation,
  bulkExcludeByDesc,
  setPersonBulkDeleteConfirm,
  deleteDonation,
  basketItemIds,
  removeFromBasket,
  addDonorToBasket,
  addToBasket,
}: PersonEditDialogProps) {
  return (
    <Dialog open={personEditDesc !== null} onOpenChange={(open) => { if (!open) setPersonEditDesc(null); }}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Kişi Düzenleme: {personEditDesc}
          </DialogTitle>
        </DialogHeader>
        {personEditDesc && (() => {
          const key = personEditDesc.trim().toLowerCase();
          const matchingDonations = kesim.donations.filter(
            d => d.description.trim().toLowerCase() === key
          );
          const allExcluded = matchingDonations.length > 0 && matchingDonations.every(d => d.excluded);
          const matchingGroupEntries: { groupIdx: number; dIdx: number; donation: Donation; animalNo: number }[] = [];
          kesim.animalGroups.forEach((group, groupIdx) => {
            group.donations.forEach((d, dIdx) => {
              if (d.description.trim().toLowerCase() === key) {
                matchingGroupEntries.push({ groupIdx, dIdx, donation: d, animalNo: group.animalNo });
              }
            });
          });
          return (
            <div className="space-y-4">
              {matchingDonations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Bağışçı Listesindeki Kayıtlar ({matchingDonations.length})</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => bulkExcludeByDesc(personEditDesc, !allExcluded)}
                      >
                        {allExcluded ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                        {allExcluded ? "Tümünü Dahil Et" : "Tümünü Hariç Tut"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPersonBulkDeleteConfirm(personEditDesc)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Tümünü Sil
                      </Button>
                    </div>
                  </div>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="p-2 text-left">Vekalet</th>
                        <th className="p-2 text-left">Vekaleti Veren</th>
                        <th className="p-2 text-left">Adına Kesilen</th>
                        <th className="p-2 text-left">Cinsi</th>
                        <th className="p-2 text-left">Notlar</th>
                        <th className="p-2 text-center">Durum</th>
                        <th className="p-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingDonations.map((d) => {
                        const aiCats: string[] = d.aiCategories
                          ? (Array.isArray(d.aiCategories)
                              ? d.aiCategories
                              : (typeof d.aiCategories === "string" && d.aiCategories
                                  ? (() => { try { return JSON.parse(d.aiCategories as string); } catch { return []; } })()
                                  : []))
                          : [];
                        const hasAi = aiCats.length > 0 || (d.aiWarnings && d.aiWarnings.trim()) || d.aiConfidenceScore != null;
                        return (
                          <>
                            <tr key={d.id} className={`border-b ${d.excluded ? "opacity-40" : ""}`}>
                              <td className="p-2">
                                <Input className="h-7 text-sm" value={d.vekalet || ""} onChange={(e) => updateDonationField(d.id, "vekalet", e.target.value)} />
                              </td>
                              <td className="p-2">
                                <Input className="h-7 text-sm" value={d.description} onChange={(e) => updateDonationField(d.id, "description", e.target.value)} />
                              </td>
                              <td className="p-2">
                                <Input className="h-7 text-sm" value={d.name} onChange={(e) => updateDonationField(d.id, "name", e.target.value)} />
                              </td>
                              <td className="p-2">
                                <Input className="h-7 text-sm" value={d.donationType} onChange={(e) => updateDonationField(d.id, "donationType", e.target.value)} />
                              </td>
                              <td className="p-2">
                                <Input className="h-7 text-sm" value={d.notes || ""} onChange={(e) => updateDonationField(d.id, "notes", e.target.value)} />
                              </td>
                              <td className="p-2 text-center">
                                <Button variant="ghost" size="sm" className="h-7" onClick={() => updateDonationField(d.id, "excluded", !d.excluded)}>
                                  {d.excluded ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                                </Button>
                              </td>
                              <td className="p-2">
                                <div className="flex gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 w-7 p-0 ${basketItemIds.has(d.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                                    title={basketItemIds.has(d.id) ? "Sepetten Çıkar" : "Keseye Ekle"}
                                    onClick={() => basketItemIds.has(d.id) ? removeFromBasket(d.id) : addDonorToBasket(d.id)}
                                    disabled={d.excluded}
                                  >
                                    <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(d.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteDonation(d.id)}>
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            {hasAi && (
                              <tr key={`${d.id}-ai`} className={`border-b bg-primary/3 ${d.excluded ? "opacity-40" : ""}`}>
                                <td colSpan={7} className="px-3 py-1.5">
                                  <div className="flex flex-wrap items-start gap-2">
                                    {aiCats.length > 0 && (
                                      <div className="flex flex-wrap gap-1 items-center">
                                        <span className="text-[10px] text-muted-foreground font-medium mr-0.5">AI:</span>
                                        {aiCats.map((cat) => (
                                          <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                            {cat.replace(/_/g, " ")}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    {d.aiConfidenceScore != null && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground">Güven:</span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${
                                            d.aiConfidenceScore >= 7 ? "border-green-500 text-green-700 dark:text-green-400"
                                            : d.aiConfidenceScore >= 4 ? "border-amber-500 text-amber-700 dark:text-amber-400"
                                            : "border-red-500 text-red-700 dark:text-red-400"
                                          }`}
                                        >
                                          {d.aiConfidenceScore}/10
                                        </Badge>
                                      </div>
                                    )}
                                    {d.aiWarnings && d.aiWarnings.trim() && (
                                      <div className="flex items-start gap-1 text-[10px] text-destructive">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                        <span>{d.aiWarnings}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {matchingGroupEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Hayvan Gruplarındaki Konumu ({matchingGroupEntries.length} satır)</h3>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="p-2 text-left">Hayvan No</th>
                        <th className="p-2 text-left">Sıra</th>
                        <th className="p-2 text-left">Vekalet</th>
                        <th className="p-2 text-left">Vekaleti Veren</th>
                        <th className="p-2 text-left">Adına Kesilen</th>
                        <th className="p-2 text-left">Cinsi</th>
                        <th className="p-2 text-left">Notlar</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingGroupEntries.map((entry, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-semibold text-primary">{entry.animalNo}</td>
                          <td className="p-2">{entry.dIdx + 1}</td>
                          <td className="p-2">
                            <Input className="h-7 text-sm" value={entry.donation.vekalet || ""} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "vekalet", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-7 text-sm" value={entry.donation.description} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "description", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-7 text-sm" value={entry.donation.name} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "name", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-7 text-sm" value={entry.donation.donationType} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "donationType", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Input className="h-7 text-sm" value={entry.donation.notes || ""} onChange={(e) => updateGroupDonation(entry.groupIdx, entry.dIdx, "notes", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 ${basketItemIds.has(entry.donation.id) ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                              title={basketItemIds.has(entry.donation.id) ? "Sepetten Çıkar" : "Keseye Ekle"}
                              onClick={() => basketItemIds.has(entry.donation.id) ? removeFromBasket(entry.donation.id) : addToBasket(entry.groupIdx, entry.dIdx)}
                            >
                              <ShoppingBag className={`w-3 h-3 ${basketItemIds.has(entry.donation.id) ? "text-emerald-600" : "text-muted-foreground"}`} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {matchingDonations.length === 0 && matchingGroupEntries.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Bu kişiye ait kayıt bulunamadı.</p>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
