import { getAdminServices } from './firebaseAdmin';

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
        subdomainsSnap.docs.forEach((doc) => {
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

        domainsSnap.docs.forEach((doc) => {
          const data = doc.data();
          const domainName = (data.domain || data.domainName || '').toLowerCase();
          const isLegacySubdomain =
            data.type === 'vivexa_subdomain' ||
            domainName.endsWith('.vivexatech.in') ||
            doc.id.startsWith('dom_') && domainName.includes('vivexatech.in');

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

    // 3. Remove legacy subdomain references from 'projects' collection
    try {
      const projectsSnap = await adminDb.collection('projects').get();
      if (!projectsSnap.empty) {
        const batch = adminDb.batch();
        let projectCountInBatch = 0;

        projectsSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.vivexaSubdomain !== undefined || data.subdomain !== undefined) {
            batch.update(doc.ref, {
              vivexaSubdomain: null,
              subdomain: null,
              subdomainStatus: null,
            });
            updatedProjects++;
            projectCountInBatch++;
          }
        });

        if (projectCountInBatch > 0) {
          await batch.commit();
          console.log(`[Migration] Cleaned legacy subdomain fields on ${updatedProjects} projects.`);
        }
      }
    } catch (err: any) {
      console.warn('[Migration] Error cleaning projects collection:', err?.message || err);
    }

    return { deletedSubdomains, deletedLegacyDomains, updatedProjects };
  } catch (err: any) {
    console.error('[Migration] Failed to execute purgeLegacySubdomains:', err?.message || err);
    return { deletedSubdomains, deletedLegacyDomains, updatedProjects };
  }
}
