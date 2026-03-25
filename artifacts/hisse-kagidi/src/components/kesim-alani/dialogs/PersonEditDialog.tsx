import type { KesimAlani, Donation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, ShoppingBag, Trash2, UserCog } from "lucide-react";

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
                      {matchingDonations.map((d) => (
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
                      ))}
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
