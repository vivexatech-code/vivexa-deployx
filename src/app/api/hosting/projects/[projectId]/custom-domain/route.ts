import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices, authenticateApiRequest } from '@/lib/firebase/admin';
import { VercelService } from '@/lib/vercel/vercelService';
import { EntitlementService } from '@/lib/entitlements/entitlementService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await authenticateApiRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain name is required' }, { status: 400 });
    }

    const { adminDb } = getAdminServices();

    const ent = await EntitlementService.canAddCustomDomain(adminDb, user.uid);
    if (!ent.allowed) {
      return NextResponse.json({ error: ent.reason }, { status: 403 });
    }

    const projSnap = await adminDb.collection('projects').doc(projectId).get();
    if (!projSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projSnap.data();
    if (project.userId !== user.uid && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

    if (cleanDomain === 'vivexatech.in' || cleanDomain.endsWith('.vivexatech.in')) {
      return NextResponse.json(
        {
          error:
            'Free *.vivexatech.in subdomains are no longer supported. Please enter your own custom domain (e.g. yourbrand.com or app.yourbrand.com).',
        },
        { status: 400 }
      );
    }

    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
    if (!domainRegex.test(cleanDomain)) {
      return NextResponse.json(
        { error: 'Invalid domain format. Example: example.com or app.example.com' },
        { status: 400 }
      );
    }

    const existingDomainSnap = await adminDb.collection('domains').where('domain', '==', cleanDomain).get();
    if (!existingDomainSnap.empty) {
      const existingDoc = existingDomainSnap.docs[0].data();
      if (existingDoc.status !== 'removed') {
        if (existingDoc.projectId === projectId) {
          return NextResponse.json({
            success: true,
            domain: existingDoc,
            message: 'Domain is already configured for this project.',
          });
        } else {
          return NextResponse.json(
            { error: `Domain "${cleanDomain}" is already attached to another project.` },
            { status: 409 }
          );
        }
      }
    }

    let vercelResult: any = null;
    let vercelError: string | null = null;

    if (project.vercelProjectId && VercelService.isConfigured()) {
      try {
        vercelResult = await VercelService.addDomainToProject(project.vercelProjectId, cleanDomain);
      } catch (domErr: any) {
        console.warn(`Vercel addDomain error for ${cleanDomain}:`, domErr.message);
        vercelError = domErr.message;
      }
    }

    const isApex = cleanDomain.split('.').length === 2;
    const domainId = `dom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();

    const existingCustom = project.customDomains || [];
    const isFirstDomain = existingCustom.length === 0;

    const domainStatus = vercelError ? 'error' : vercelResult?.verified ? 'active' : 'pending';

    const domainRecord = {
      id: domainId,
      domain: cleanDomain,
      domainName: cleanDomain,
      type: 'custom',
      projectId,
      projectName: project.name,
      userId: user.uid,
      vercelProjectId: project.vercelProjectId || '',
      status: domainStatus,
      verified: Boolean(vercelResult?.verified),
      isPrimary: isFirstDomain,
      dnsRecords: vercelResult?.dnsRecords || [
        {
          type: isApex ? 'A' : 'CNAME',
          host: isApex ? '@' : cleanDomain.split('.')[0],
          value: isApex ? '76.76.21.21' : 'cname.vercel-dns.com',
          status: 'pending',
          reason: isApex ? 'Apex A record' : 'Subdomain CNAME record',
        },
      ],
      dnsRecordType: vercelResult?.dnsRecords?.[0]?.type || (isApex ? 'A' : 'CNAME'),
      dnsHost: vercelResult?.dnsRecords?.[0]?.host || (isApex ? '@' : cleanDomain.split('.')[0]),
      dnsValue: vercelResult?.dnsRecords?.[0]?.value || (isApex ? '76.76.21.21' : 'cname.vercel-dns.com'),
      verification: vercelResult?.verification || [],
      error: vercelError || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await adminDb.collection('domains').doc(domainId).set(domainRecord);

    if (!existingCustom.includes(cleanDomain)) {
      const updates: any = {
        customDomains: [...existingCustom, cleanDomain],
        updatedAt: now.toISOString(),
      };
      if (domainStatus === 'active' && isFirstDomain) {
        updates.productionUrl = `https://${cleanDomain}`;
      }
      await adminDb.collection('projects').doc(projectId).update(updates);
    }

    return NextResponse.json({ success: !vercelError, domain: domainRecord, error: vercelError });
  } catch (err: any) {
    console.error('Error adding custom domain:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
