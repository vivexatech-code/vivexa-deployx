import { getAdminServices } from '../firebase/admin';

/**
 * Migration utility to purge all legacy *.vivexatech.in free subdomain records
 * from Firestore, including:
 * 1. The 'subdomains' collection
 * 2. Legacy 'vivexa_subdomain' records in the 'domains' collection
 * 3. Cleaning legacy subdomain fields from 'projects'
 */
export async function purgeLegacySubdomains(): Promise<{
  deletedSubdomains: number;
  deletedLegacyDomains: number;
  updatedProjects: number;
}> {
  let deletedSubdomains = 0;
  let deletedLegacyDomains = 0;
  let updatedProjects = 0;

  try {
    const { adminDb } = getAdminServices();

    // 1. Purge all documents in the deprecated 'subdomains' collection
    try {
      const subdomainsSnap = await adminDb.collection('subdomains').get();
      if (!subdomainsSnap.empty) {
        const batch = adminDb.batch();
        subdomainsSnap.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
          deletedSubdomains++;
        });
        await batch.commit();
        console.log(`[Migration] Deleted ${deletedSubdomains} documents from 'subdomains' collection.`);
      }
    } catch (err: any) {
      console.warn('[Migration] Error purging subdomains collection:', err?.message || err);
    }

    // 2. Purge legacy 'vivexa_subdomain' records in 'domains'
    try {
      const domainsSnap = await adminDb.collection('domains').get();
      if (!domainsSnap.empty) {
        const batch = adminDb.batch();
        let domainCountInBatch = 0;

        domainsSnap.docs.forEach((doc: any) => {
          const data = doc.data();
          const domainName = (data.domain || data.domainName || '').toLowerCase();
          const isLegacySubdomain =
            data.type === 'vivexa_subdomain' ||
            domainName.endsWith('.vivexatech.in') ||
            (doc.id.startsWith('dom_') && domainName.includes('vivexatech.in'));

          if (isLegacySubdomain) {
            batch.delete(doc.ref);
            deletedLegacyDomains++;
            domainCountInBatch++;
          }
        });

        if (domainCountInBatch > 0) {
          await batch.commit();
          console.log(`[Migration] Deleted ${deletedLegacyDomains} legacy subdomain records from 'domains' collection.`);
        }
      }
    } catch (err: any) {
      console.warn('[Migration] Error purging legacy domains:', err?.message || err);
    }

    // 3. Clear legacy subdomain fields from all projects
    try {
      const projectsSnap = await adminDb.collection('projects').get();
      if (!projectsSnap.empty) {
        const batch = adminDb.batch();
        let projectUpdateCount = 0;

        projectsSnap.docs.forEach((doc: any) => {
          const p = doc.data();
          const needsCleanup =
            p.subdomain !== undefined ||
            p.vivexaSubdomain !== undefined ||
            (p.productionUrl && p.productionUrl.includes('.vivexatech.in'));

          if (needsCleanup) {
            const updates: Record<string, any> = {
              subdomain: null,
              vivexaSubdomain: null,
            };
            if (p.productionUrl && p.productionUrl.includes('.vivexatech.in')) {
              updates.productionUrl = p.customDomains && p.customDomains.length > 0 ? `https://${p.customDomains[0]}` : '';
            }
            batch.update(doc.ref, updates);
            updatedProjects++;
            projectUpdateCount++;
          }
        });

        if (projectUpdateCount > 0) {
          await batch.commit();
          console.log(`[Migration] Cleaned legacy subdomain properties from ${updatedProjects} projects.`);
        }
      }
    } catch (err: any) {
      console.warn('[Migration] Error cleaning project documents:', err?.message || err);
    }

    return { deletedSubdomains, deletedLegacyDomains, updatedProjects };
  } catch (err: any) {
    console.error('[Migration] Failed to run legacy subdomain purge:', err);
    return { deletedSubdomains, deletedLegacyDomains, updatedProjects };
  }
}
