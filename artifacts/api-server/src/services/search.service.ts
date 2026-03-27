import { db } from "@workspace/db";
import {
  kesimAlanlariTable,
  donationsTable,
  animalGroupsTable,
  animalGroupDonationsTable,
  projectsTable,
} from "@workspace/db/schema";
import { eq, inArray, isNull, and } from "drizzle-orm";

interface SearchResult {
  donationId: string;
  name: string;
  description: string;
  donationType: string;
  vekalet: string;
  notes: string;
  phone: string;
  shareCount: number;
  kesimAlaniId: string;
  kesimAlaniName: string;
  projectId: string | null;
  projectName: string | null;
  animalGroupId: string | null;
  animalNo: number | null;
}

export async function globalSearch(q: string, column: string, projectId?: string): Promise<SearchResult[]> {
  if (!q) return [];

  const kaWhere = projectId
    ? and(isNull(kesimAlanlariTable.deletedAt), eq(kesimAlanlariTable.projectId, projectId))
    : isNull(kesimAlanlariTable.deletedAt);

  const allKA = await db.select({
    id: kesimAlanlariTable.id,
    name: kesimAlanlariTable.name,
    projectId: kesimAlanlariTable.projectId,
  }).from(kesimAlanlariTable).where(kaWhere);

  if (allKA.length === 0) return [];

  const kaIds = allKA.map(ka => ka.id);
  const kaMap = new Map(allKA.map(ka => [ka.id, ka]));

  const allDonations = await db.select().from(donationsTable)
    .where(and(
      inArray(donationsTable.kesimAlaniId, kaIds),
      isNull(donationsTable.deletedAt),
    ));

  const allGroups = await db.select().from(animalGroupsTable)
    .where(inArray(animalGroupsTable.kesimAlaniId, kaIds));

  const allGroupDonationLinks = allGroups.length > 0
    ? await db.select({
        groupId: animalGroupDonationsTable.groupId,
        donationId: animalGroupDonationsTable.donationId,
      }).from(animalGroupDonationsTable)
        .where(inArray(animalGroupDonationsTable.groupId, allGroups.map(g => g.id)))
    : [];

  const donationToGroup = new Map<string, { groupId: string; animalNo: number }>();
  const groupMap = new Map(allGroups.map(g => [g.id, g]));
  for (const link of allGroupDonationLinks) {
    const group = groupMap.get(link.groupId);
    if (group) {
      donationToGroup.set(link.donationId, { groupId: group.id, animalNo: group.animalNo });
    }
  }

  let projectNames: Map<string, string> | undefined;
  const projectIds = [...new Set(allKA.map(ka => ka.projectId).filter(Boolean))] as string[];
  if (projectIds.length > 0) {
    const projects = await db.select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable).where(inArray(projectsTable.id, projectIds));
    projectNames = new Map(projects.map(p => [p.id, p.name]));
  }

  const results: SearchResult[] = [];

  for (const d of allDonations) {
    const matchFields: Record<string, string> = {
      name: d.name,
      description: d.description,
      donationType: d.donationType,
      vekalet: d.vekalet,
      notes: d.notes,
      phone: d.phone || "",
    };

    let matches = false;
    if (column === "all") {
      matches = Object.values(matchFields).some(v => v.toLocaleLowerCase("tr").includes(q));
    } else if (column in matchFields) {
      matches = matchFields[column].toLocaleLowerCase("tr").includes(q);
    }

    if (matches) {
      const ka = kaMap.get(d.kesimAlaniId);
      if (!ka) continue;
      const groupInfo = donationToGroup.get(d.id);
      results.push({
        donationId: d.id,
        name: d.name,
        description: d.description,
        donationType: d.donationType,
        vekalet: d.vekalet,
        notes: d.notes,
        phone: d.phone || "",
        shareCount: d.shareCount,
        kesimAlaniId: ka.id,
        kesimAlaniName: ka.name,
        projectId: ka.projectId || null,
        projectName: ka.projectId && projectNames ? projectNames.get(ka.projectId) || null : null,
        animalGroupId: groupInfo?.groupId || null,
        animalNo: groupInfo?.animalNo || null,
      });
    }
  }

  return results;
}
