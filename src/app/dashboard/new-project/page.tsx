import { redirect } from 'next/navigation';

/** Legacy path used by older UI links */
export default function LegacyNewProjectRedirect() {
  redirect('/dashboard/projects/new');
}
